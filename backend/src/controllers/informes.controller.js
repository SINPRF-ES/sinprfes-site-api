const pool = require("../config/db");
const log = require("../utils/log");
const cloudinary = require("../services/cloudinary.service");
const { v4: uuidv4 } = require("uuid");
const { handleDbError } = require("../utils/dbError");
const { parseUuid } = require("../utils/parseUuid");
const { ehPerfilGestao } = require("../shared/canon");

const INFORMES_POR_PAGINA = 3;

async function gerarPublicRefInforme(client, informe) {
  if (informe.public_ref) return informe.public_ref;

  const date = new Date(informe.published_at || informe.data_informe || informe.data_noticia || informe.created_at || new Date());
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const datePart = `${yyyy}${mm}${dd}`;
  const prefix = `${datePart}-informe-`;

  const { rows } = await client.query(
    `SELECT public_ref
     FROM informes
     WHERE public_ref LIKE $1 || '%'
     ORDER BY public_ref DESC
     LIMIT 1`,
    [prefix]
  );

  let nextSeq = 1;
  if (rows.length > 0) {
    const lastRef = rows[0].public_ref;
    const parts = lastRef.split("-");
    const lastSeqString = parts[parts.length - 1];
    const lastSeq = parseInt(lastSeqString, 10);
    if (!Number.isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(2, "0")}`;
}

async function garantirPublicRef(client, informe) {
  if (!informe || informe.public_ref) {
    return informe;
  }

  const publicRef = await gerarPublicRefInforme(client, informe);
  const { rows } = await client.query(
    `UPDATE informes
     SET public_ref = $1
     WHERE id = $2
     RETURNING *`,
    [publicRef, informe.id]
  );
  return rows[0] || informe;
}

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toDateOnlyTimestamp(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return null;
  return `${dateOnly}T12:00:00.000Z`;
}

function serializeInformeRow(row) {
  if (!row) return row;
  const data_informe = toDateOnly(row.data_informe || row.data_noticia || row.published_at || row.created_at);
  const { data_noticia, ...rest } = row;
  return {
    ...rest,
    data_informe
  };
}

function annotateMidiasCover(midias = [], capaMidiaId) {
  return midias.map((midia) => ({
    ...midia,
    is_capa: Boolean(capaMidiaId && midia.id === capaMidiaId),
  }));
}

function parseInformeId(req, res, requestId) {
    const id = parseUuid(String(req.params.id || ""));
    if (!id) {
        res.status(400).json({ success: false, message: "ID de informe inválido.", requestId });
        return null;
    }
    return id;
}

function verificarGestao(req) {
  const perfil = (req.user?.perfil_acesso || "").toUpperCase();
  return ehPerfilGestao(perfil) || perfil === "COMUNICADOR";
}

exports.listar = async (req, res) => {
  const start = Date.now();
  const method = "GET";
  const endpoint = "/api/informes";
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  const profile = req.user?.perfil_acesso;
  const queryParams = req.query;

  let query = "";
  let params = [];

  try {
    const { status, pagina, status_editorial } = req.query;
    const statusEditorialNorm = status_editorial ? String(status_editorial).toUpperCase() : null;
    const isGestao = verificarGestao(req);
    const isAutenticado = Boolean(atorId);

    if (statusEditorialNorm && !['ATUAL', 'ARQUIVADA'].includes(statusEditorialNorm)) {
      return res.status(400).json({
        success: false,
        message: "Parâmetro 'status_editorial' inválido. Use ATUAL ou ARQUIVADA.",
        code: "INVALID_QUERY_PARAMS",
        requestId
      });
    }

    if (status && typeof status !== 'string') {
      const receivedValue = typeof status === 'object' ? JSON.stringify(status) : String(status);
      log.warn("INFORMES_GET_INVALID_PARAMS", { requestId, atorId, queryParams, receivedStatusType: typeof status, receivedStatusValue: receivedValue.substring(0, 500) });
      return res.status(400).json({ success: false, message: "Parâmetro 'status' inválido. Deve ser uma string.", code: "INVALID_QUERY_PARAMS", requestId });
    }

    query = `
      SELECT i.*, f.nome as autor_nome
      FROM informes i
      LEFT JOIN filiados f ON i.autor_id = f.id
    `;

    const paginaSolicitada = Number.parseInt(String(pagina || "1"), 10);
    const paginaAtual = Number.isNaN(paginaSolicitada) || paginaSolicitada < 1 ? 1 : paginaSolicitada;

    if (!isAutenticado) {
       return res.status(401).json({ success: false, message: "Acesso restrito a usuários autenticados.", requestId });
    } else if (!isGestao) {
      query += ` WHERE i.status = 'PUBLICADA'`;
      const statusEditorialLeitura = statusEditorialNorm || 'ATUAL';
      params.push(statusEditorialLeitura);
      query += ` AND i.status_editorial = $${params.length}`;
    } else {
      query += " WHERE 1=1";
      if (status) {
        params.push(status.toUpperCase());
        query += ` AND i.status = $${params.length}`;
      }
      if (statusEditorialNorm) {
        params.push(statusEditorialNorm);
        query += ` AND i.status_editorial = $${params.length}`;
      }
    }

    query += " ORDER BY COALESCE(i.sort_date, i.published_at, i.created_at) DESC, i.created_at DESC";

    const forcarPaginacao = Boolean(pagina);
    const paginacaoPublica = !isGestao || forcarPaginacao;

    let total = null;
    if (paginacaoPublica) {
      const countQuery = `SELECT COUNT(*)::int AS total FROM (${query}) informes_filtrados`;
      const countResult = await pool.query(countQuery, params);
      total = countResult.rows[0]?.total || 0;
      params.push(INFORMES_POR_PAGINA);
      query += ` LIMIT $${params.length}`;
      params.push((paginaAtual - 1) * INFORMES_POR_PAGINA);
      query += ` OFFSET $${params.length}`;
    }

    let { rows: informes } = await pool.query(query, params);

    const informesSemRef = informes.filter((i) => i.status === "PUBLICADA" && !i.public_ref);
    if (informesSemRef.length > 0) {
      const client = await pool.connect();
      try {
        for (const informe of informesSemRef) {
          const informeAtualizado = await garantirPublicRef(client, informe);
          informes = informes.map((item) => (item.id === informeAtualizado.id ? informeAtualizado : item));
        }
      } finally {
        client.release();
      }
    }

    if (informes.length > 0) {
      const ids = informes.map(i => i.id);
      const { rows: allMidias } = await pool.query(
        "SELECT * FROM informe_midias WHERE informe_id = ANY($1) ORDER BY ordem ASC",
        [ids]
      );

      const midiasMap = new Map();
      allMidias.forEach(m => {
        if (!midiasMap.has(m.informe_id)) {
          midiasMap.set(m.informe_id, []);
        }
        midiasMap.get(m.informe_id).push(m);
      });

      informes.forEach(i => {
        i.midias = annotateMidiasCover(midiasMap.get(i.id) || [], i.capa_midia_id);
      });
    }

    log.info("INFORMES_GET_SUCCESS", { endpoint, method, requestId, atorId, durationMs: Date.now() - start, count: informes.length });

    if (!paginacaoPublica) {
      return res.json(informes.map(serializeInformeRow));
    }

    const totalPaginas = Math.max(1, Math.ceil(total / INFORMES_POR_PAGINA));
    return res.json({
      items: informes.map(serializeInformeRow),
      pagination: {
        page: paginaAtual,
        perPage: INFORMES_POR_PAGINA,
        totalItems: total,
        totalPages: totalPaginas,
      },
    });
  } catch (err) {
    log.error("INFORMES_GET_FAILED", { endpoint, method, requestId, atorId, profile, queryParams, durationMs: Date.now() - start, errorMessage: err.message });
    return res.status(500).json({ success: false, message: "Erro interno ao processar informes.", requestId });
  }
};

exports.detalhar = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  const method = "GET";
  const endpoint = `/api/informes/${id}`;
  const atorId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: informeRows } = await pool.query(
      `SELECT i.*, f.nome as autor_nome
       FROM informes i
       LEFT JOIN filiados f ON i.autor_id = f.id
       WHERE i.id = $1`,
      [id]
    );

    if (informeRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    const informe = informeRows[0];
    const isGestao = verificarGestao(req);

    const podeVisualizar = isGestao || informe.status === "PUBLICADA";

    if (!podeVisualizar) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    const { rows: midiaRows } = await pool.query(
      "SELECT * FROM informe_midias WHERE informe_id = $1 ORDER BY ordem ASC",
      [id]
    );

    informe.midias = annotateMidiasCover(midiaRows, informe.capa_midia_id);

    log.info("INFORMES_DETAIL_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.json({ ...serializeInformeRow(informe), requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao detalhar informe.");
  }
};

exports.detalharPorRef = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const publicRef = String(req.params.publicRef || "").trim();
  const method = "GET";
  const endpoint = `/api/informes/ref/${publicRef}`;
  const atorId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  if (!publicRef) {
    return res.status(400).json({ success: false, message: "Referência de informe inválida.", requestId });
  }

  try {
    const { rows: informeRows } = await pool.query(
      `SELECT i.*, f.nome as autor_nome
       FROM informes i
       LEFT JOIN filiados f ON i.autor_id = f.id
       WHERE i.public_ref = $1
       LIMIT 1`,
      [publicRef]
    );

    if (informeRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    const informe = informeRows[0];
    const isGestao = verificarGestao(req);
    const podeVisualizar = isGestao || informe.status === "PUBLICADA";

    if (!podeVisualizar) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    const { rows: midiaRows } = await pool.query(
      "SELECT * FROM informe_midias WHERE informe_id = $1 ORDER BY ordem ASC",
      [informe.id]
    );

    informe.midias = annotateMidiasCover(midiaRows, informe.capa_midia_id);

    log.info("INFORMES_DETAIL_BY_REF_SUCCESS", { endpoint, method, requestId, atorId, profile, publicRef, durationMs: Date.now() - start });
    return res.json({ ...serializeInformeRow(informe), requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao detalhar informe por referência.");
  }
};

exports.criar = async (req, res) => {
  const start = Date.now();
  const method = "POST";
  const endpoint = "/api/informes";
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { titulo, conteudo, capa_url, subtitulo, destaque, data_informe } = req.body;

    if (!titulo || !conteudo) {
      return res.status(400).json({ success: false, message: "Título e conteúdo são obrigatórios.", requestId });
    }

    const dataInformeCanonico = toDateOnlyTimestamp(data_informe);

    const client = await pool.connect();
    let createdRow;

    try {
      await client.query("BEGIN");

      // Rotação Editorial: Arquiva o atual antes de criar novo
      const { rows: atuais } = await client.query(
        `SELECT id FROM informes WHERE status_editorial = 'ATUAL' FOR UPDATE`
      );

      if (atuais.length > 0) {
        const idsToArchive = atuais.map(r => r.id);
        await client.query(
          `UPDATE informes
           SET status_editorial = 'ARQUIVADA',
               is_editable = false,
               archived_at = NOW(),
               status = 'PUBLICADA',
               published_at = COALESCE(published_at, NOW()),
               sort_date = COALESCE(sort_date, published_at, created_at)
           WHERE id = ANY($1)`,
          [idsToArchive]
        );
      }

      const { rows: createdRows } = await client.query(
        `INSERT INTO informes (titulo, subtitulo, conteudo, status, autor_id, capa_url, destaque, data_noticia, status_editorial, is_editable, sort_date)
         VALUES ($1, $2, $3, 'RASCUNHO', $4, $5, $6, COALESCE($7, NOW()), 'ATUAL', true, COALESCE($7, NOW()))
         RETURNING *`,
        [titulo, subtitulo || null, conteudo, req.user.id, capa_url, Boolean(destaque), dataInformeCanonico || null]
      );

      createdRow = createdRows[0];
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    log.info("INFORMES_CREATE_SUCCESS", { endpoint, method, requestId, atorId, profile, durationMs: Date.now() - start });
    return res.status(201).json({ ...serializeInformeRow(createdRow), requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao criar informe.");
  }
};

exports.atualizar = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  const method = "PUT";
  const endpoint = `/api/informes/${id}`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { titulo, subtitulo, conteudo, capa_url, destaque, data_informe } = req.body;
    const dataInformeCanonico = toDateOnlyTimestamp(data_informe);

    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM informes WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    const informeAlvo = estadoRows[0];
    if (informeAlvo.status_editorial === "ARQUIVADA" || informeAlvo.is_editable === false) {
      return res.status(409).json({ success: false, message: "Este informe está arquivado e não pode mais ser editado.", code: "ARCHIVED_NEWS_IMMUTABLE", requestId });
    }

    const { rows } = await pool.query(
      `UPDATE informes
       SET titulo = COALESCE($1, titulo),
           subtitulo = COALESCE($2, subtitulo),
           conteudo = COALESCE($3, conteudo),
           capa_url = COALESCE($4, capa_url),
           destaque = COALESCE($5, destaque),
           data_noticia = COALESCE($6, data_noticia),
           sort_date = COALESCE($6, sort_date)
       WHERE id = $7
       RETURNING *`,
      [titulo, subtitulo, conteudo, capa_url, destaque, dataInformeCanonico, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    log.info("INFORMES_UPDATE_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.json({ ...serializeInformeRow(rows[0]), requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao atualizar informe.");
  }
};

exports.publicar = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  const method = "POST";
  const endpoint = `/api/informes/${id}/publicar`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM informes WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Informe arquivado não pode ser publicado novamente.", requestId });
    }

    const client = await pool.connect();
    let publishRows;

    try {
      await client.query("BEGIN");

      const { rows: atuais } = await client.query(
        `SELECT id FROM informes
         WHERE status_editorial = 'ATUAL'
           AND id <> $1
         FOR UPDATE`,
        [id]
      );

      if (atuais.length > 0) {
        const idsToArchive = atuais.map(r => r.id);
        await client.query(
          `UPDATE informes
           SET status_editorial = 'ARQUIVADA',
               is_editable = false,
               archived_at = NOW(),
               status = 'PUBLICADA',
               published_at = COALESCE(published_at, NOW()),
               sort_date = COALESCE(sort_date, published_at, created_at)
           WHERE id = ANY($1)`,
          [idsToArchive]
        );
      }

      const { rows: baseRows } = await client.query(
        `UPDATE informes
         SET status = 'PUBLICADA',
             status_editorial = 'ATUAL',
             is_editable = true,
             published_at = COALESCE(published_at, NOW()),
             sort_date = COALESCE(sort_date, published_at, created_at)
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (baseRows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
      }

      const informeBase = baseRows[0];
      const publicRef = await gerarPublicRefInforme(client, informeBase);

      const { rows: publishedRows } = await client.query(
        `UPDATE informes SET public_ref = $1 WHERE id = $2 RETURNING *`,
        [publicRef, informeBase.id]
      );

      publishRows = publishedRows;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    log.info("INFORMES_PUBLISH_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.json({ ...serializeInformeRow(publishRows[0]), requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao publicar informe.");
  }
};

exports.arquivar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, status_editorial FROM informes WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    const informe = rows[0];

    if (informe.status_editorial === "ARQUIVADA") {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "O informe já está arquivado.", requestId });
    }

    await client.query(
      `UPDATE informes
       SET status_editorial = 'ARQUIVADA',
           is_editable = false,
           archived_at = NOW(),
           status = 'PUBLICADA',
           published_at = COALESCE(published_at, NOW()),
           sort_date = COALESCE(sort_date, published_at, created_at)
       WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");
    log.info("INFORMES_ARCHIVE_SUCCESS", { requestId, atorId, id });
    return res.json({ success: true, requestId });
  } catch (err) {
    await client.query("ROLLBACK");
    log.error("INFORMES_ARCHIVE_FAILED", { requestId, atorId, id, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao arquivar informe atual.");
  } finally {
    client.release();
  }
};

exports.excluir = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  const method = "DELETE";
  const endpoint = `/api/informes/${id}`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: lockRows } = await pool.query("SELECT status_editorial FROM informes WHERE id = $1", [id]);
    if (lockRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    if (lockRows[0].status_editorial === "ARQUIVADA") {
      return res.status(409).json({ success: false, message: "Informe arquivado não pode ser excluído.", code: "ARCHIVED_NEWS_IMMUTABLE", requestId });
    }

    const { rowCount } = await pool.query("DELETE FROM informes WHERE id = $1", [id]);

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    log.info("INFORMES_DELETE_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.json({ success: true, requestId });
  } catch (err) {
    log.error("INFORMES_DELETE_FAILED", { endpoint, method, requestId, atorId, profile, id, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao excluir informe.");
  }
};

exports.adicionarMidia = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  const method = "POST";
  const endpoint = `/api/informes/${id}/midias`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM informes WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Informe arquivado não permite adição de mídias.", requestId });
    }

    const { tipo, ordem } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Arquivo não enviado.", requestId });
    }

    const resourceType = tipo === "VIDEO" ? "video" : "image";
    const result = await cloudinary.uploadFileBuffer(req.file.buffer, { resource_type: resourceType, folder: "informes" });

    const { rows } = await pool.query(
      `INSERT INTO informe_midias (informe_id, tipo, url, ordem)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, tipo || (resourceType === "video" ? "VIDEO" : "IMAGEM"), result.secure_url, ordem || 0]
    );

    log.info("INFORMES_ADD_MEDIA_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.status(201).json({ ...rows[0], is_capa: false, requestId });
  } catch (err) {
    log.error("INFORMES_ADD_MEDIA_FAILED", { endpoint, method, requestId, atorId, profile, id, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao adicionar mídia.");
  }
};

exports.removerMidia = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const midiaId = parseUuid(String(req.params.midiaId || ""));
  if (!midiaId) {
      return res.status(400).json({ success: false, message: "ID de mídia inválido.", requestId });
  }

  const method = "DELETE";
  const endpoint = `/api/informes/midias/${midiaId}`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: midiaRows } = await pool.query(
      "SELECT i.id as informe_id, i.status_editorial, i.is_editable, i.capa_midia_id FROM informes i JOIN informe_midias im ON i.id = im.informe_id WHERE im.id = $1",
      [midiaId]
    );

    if (midiaRows.length > 0) {
      if (midiaRows[0].status_editorial === "ARQUIVADA" || midiaRows[0].is_editable === false) {
        return res.status(409).json({ success: false, message: "Mídia de informe arquivado não pode ser removida.", requestId });
      }
    }

    if (midiaRows.length > 0 && midiaRows[0].capa_midia_id === midiaId) {
      await pool.query("UPDATE informes SET capa_midia_id = NULL, capa_url = NULL WHERE id = $1", [midiaRows[0].informe_id]);
    }

    const { rowCount } = await pool.query("DELETE FROM informe_midias WHERE id = $1", [midiaId]);

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: "Mídia não encontrada.", requestId });
    }

    log.info("INFORMES_REMOVE_MEDIA_SUCCESS", { endpoint, method, requestId, atorId, profile, midiaId, durationMs: Date.now() - start });
    return res.json({ success: true, requestId });
  } catch (err) {
    log.error("INFORMES_REMOVE_MEDIA_FAILED", { endpoint, method, requestId, atorId, profile, midiaId, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao remover mídia.");
  }
};

exports.adicionarMidiaExterna = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  const method = "POST";
  const endpoint = `/api/informes/${id}/midias_external`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    if (!verificarGestao(req)) {
      return res.status(403).json({ success: false, message: "Acesso negado.", requestId });
    }

    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM informes WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }

    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Informe arquivado não permite adição de mídias externas.", requestId });
    }

    const { tipo, url, ordem } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, message: "URL da mídia não fornecida.", requestId });
    }

    const { rows } = await pool.query(
      `INSERT INTO informe_midias (informe_id, tipo, url, ordem)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, tipo, url, ordem || 0]
    );

    log.info("INFORMES_ADD_EXTERNAL_MEDIA_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.status(201).json({ ...rows[0], is_capa: false, requestId });
  } catch (err) {
    log.error("INFORMES_ADD_EXTERNAL_MEDIA_FAILED", { endpoint, method, requestId, atorId, profile, id, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao associar mídia externa.");
  }
};

exports.obterAssinaturaUpload = async (req, res) => {
  const start = Date.now();
  const method = "POST";
  const endpoint = "/api/informes/upload-signature";
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    if (!verificarGestao(req)) {
      return res.status(403).json({ success: false, message: "Acesso negado.", requestId });
    }

    const { folder, tags, resource_type } = req.body;

    const params = {
      folder: folder || "informes",
      tags: tags || "informe",
    };

    if (resource_type !== "video") {
      params.transformation = cloudinary.STANDARD_IMAGE_TRANSFORMATION_STRING;
    }

    const signatureData = cloudinary.gerarAssinaturaUpload(params);
    log.info("INFORMES_GET_SIGNATURE_SUCCESS", { endpoint, method, requestId, atorId, profile, durationMs: Date.now() - start });
    return res.json({ ...signatureData, requestId });
  } catch (err) {
    log.error("INFORMES_GET_SIGNATURE_FAILED", { endpoint, method, requestId, atorId, profile, durationMs: Date.now() - start, errorMessage: err.message });
    return res.status(500).json({ success: false, message: "Erro ao gerar assinatura.", code: "INTERNAL_SERVER_ERROR", requestId });
  }
};

exports.definirCapa = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM informes WHERE id = $1",
      [id]
    );
    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrado.", requestId });
    }
    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Informe arquivado não permite alteração de capa.", requestId });
    }

    const coverMediaId = parseUuid(String(req.body?.coverMediaId || ""));
    if (!coverMediaId) {
      await pool.query("UPDATE informes SET capa_midia_id = NULL, capa_url = NULL WHERE id = $1", [id]);
      return res.json({ success: true, capa_midia_id: null, capa_url: null, requestId });
    }

    const { rows: midiaRows } = await pool.query(
      "SELECT id, url, tipo FROM informe_midias WHERE id = $1 AND informe_id = $2",
      [coverMediaId, id]
    );
    if (midiaRows.length === 0) {
      return res.status(404).json({ success: false, message: "Mídia de capa não encontrada para este informe.", requestId });
    }
    if (midiaRows[0].tipo !== "IMAGEM") {
      return res.status(400).json({ success: false, message: "A capa deve ser uma imagem anexada ao informe.", requestId });
    }

    await pool.query(
      "UPDATE informes SET capa_midia_id = $1, capa_url = $2 WHERE id = $3",
      [coverMediaId, midiaRows[0].url, id]
    );

    log.info("INFORMES_SET_COVER_SUCCESS", { requestId, atorId, id, coverMediaId });
    return res.json({ success: true, capa_midia_id: coverMediaId, capa_url: midiaRows[0].url, requestId });
  } catch (err) {
    log.error("INFORMES_SET_COVER_FAILED", { requestId, atorId, id, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao definir capa do informe.");
  }
};
