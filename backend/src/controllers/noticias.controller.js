const pool = require("../config/db");
const log = require("../utils/log");
const cloudinary = require("../services/cloudinary.service");
const { v4: uuidv4 } = require("uuid");
const { handleDbError } = require("../utils/dbError");
const { parseUuid } = require("../utils/parseUuid");
const { ehPerfilGestao } = require("../shared/canon");

const NOTICIAS_POR_PAGINA = 3;

async function gerarPublicRefNoticia(client, noticia) {
  if (noticia.public_ref) return noticia.public_ref;

  const date = new Date(noticia.published_at || noticia.created_at || new Date());
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const datePart = `${yyyy}${mm}${dd}`;
  const prefix = `${datePart}-noticia-`;

  // Busca o último sequencial do dia para este prefixo
  const { rows } = await client.query(
    `SELECT public_ref
     FROM noticias
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
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(2, "0")}`;
}

async function garantirPublicRef(client, noticia) {
  if (!noticia || noticia.public_ref) {
    return noticia;
  }

  const publicRef = await gerarPublicRefNoticia(client, noticia);
  const { rows } = await client.query(
    `UPDATE noticias
     SET public_ref = $1
     WHERE id = $2
     RETURNING *`,
    [publicRef, noticia.id]
  );
  return rows[0] || noticia;
}

function parseNoticiaId(req, res, requestId) {
    const id = parseUuid(String(req.params.id || ""));
    if (!id) {
        res.status(400).json({ success: false, message: "ID de notícia inválido.", requestId });
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
  const endpoint = "/api/noticias";
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
      log.warn("NOTICIAS_GET_INVALID_PARAMS", { requestId, atorId, queryParams, receivedStatusType: typeof status, receivedStatusValue: receivedValue.substring(0, 500) });
      return res.status(400).json({ success: false, message: "Parâmetro 'status' inválido. Deve ser uma string.", code: "INVALID_QUERY_PARAMS", requestId });
    }

    query = `
      SELECT n.*, f.nome as autor_nome
      FROM noticias n
      LEFT JOIN filiados f ON n.autor_id = f.id
    `;

    const paginaSolicitada = Number.parseInt(String(pagina || "1"), 10);
    const paginaAtual = Number.isNaN(paginaSolicitada) || paginaSolicitada < 1 ? 1 : paginaSolicitada;

    if (!isAutenticado || !isGestao) {
      // Público ou Filiado comum: apenas PUBLICADA
      query += ` WHERE n.status = 'PUBLICADA'`;
      if (statusEditorialNorm) {
        params.push(statusEditorialNorm);
        query += ` AND n.status_editorial = $${params.length}`;
      }
    } else {
      query += " WHERE 1=1";
      if (status) {
        params.push(status.toUpperCase());
        query += ` AND n.status = $${params.length}`;
      }
      if (statusEditorialNorm) {
        params.push(statusEditorialNorm);
        query += ` AND n.status_editorial = $${params.length}`;
      }
    }

    query += " ORDER BY COALESCE(n.sort_date, n.published_at, n.created_at) DESC, n.created_at DESC";

    const forcarPaginacao = Boolean(pagina);
    const paginacaoPublica = !isAutenticado || !isGestao || forcarPaginacao;

    let total = null;
    if (paginacaoPublica) {
      const countQuery = `SELECT COUNT(*)::int AS total FROM (${query}) noticias_filtradas`;
      const countResult = await pool.query(countQuery, params);
      total = countResult.rows[0]?.total || 0;
      params.push(NOTICIAS_POR_PAGINA);
      query += ` LIMIT $${params.length}`;
      params.push((paginaAtual - 1) * NOTICIAS_POR_PAGINA);
      query += ` OFFSET $${params.length}`;
    }

    let { rows: noticias } = await pool.query(query, params);

    const noticiasSemRef = noticias.filter((n) => n.status === "PUBLICADA" && !n.public_ref);
    if (noticiasSemRef.length > 0) {
      const client = await pool.connect();
      try {
        for (const noticia of noticiasSemRef) {
          const noticiaAtualizada = await garantirPublicRef(client, noticia);
          noticias = noticias.map((item) => (item.id === noticiaAtualizada.id ? noticiaAtualizada : item));
        }
      } finally {
        client.release();
      }
    }

    if (noticias.length > 0) {
      const ids = noticias.map(n => n.id);
      const { rows: allMidias } = await pool.query(
        "SELECT * FROM noticia_midias WHERE noticia_id = ANY($1) ORDER BY ordem ASC",
        [ids]
      );

      const midiasMap = new Map();
      allMidias.forEach(m => {
        if (!midiasMap.has(m.noticia_id)) {
          midiasMap.set(m.noticia_id, []);
        }
        midiasMap.get(m.noticia_id).push(m);
      });

      noticias.forEach(n => {
        n.midias = midiasMap.get(n.id) || [];
      });
    }

    log.info("NOTICIAS_GET_SUCCESS", { endpoint, method, requestId, atorId, durationMs: Date.now() - start, count: noticias.length });

    if (!paginacaoPublica) {
      return res.json(noticias);
    }

    const totalPaginas = Math.max(1, Math.ceil(total / NOTICIAS_POR_PAGINA));
    return res.json({
      items: noticias,
      pagination: {
        page: paginaAtual,
        perPage: NOTICIAS_POR_PAGINA,
        totalItems: total,
        totalPages: totalPaginas,
      },
    });
  } catch (err) {
    log.error("NOTICIAS_GET_FAILED", { endpoint, method, requestId, atorId, profile, queryParams, durationMs: Date.now() - start, errorMessage: err.message });
    return res.status(500).json({ success: false, message: "Erro interno ao processar notícias.", requestId });
  }
};

exports.detalhar = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseNoticiaId(req, res, requestId);
  if (id === null) return;

  const method = "GET";
  const endpoint = `/api/noticias/${id}`;
  const atorId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: newsRows } = await pool.query(
      `SELECT n.*, f.nome as autor_nome
       FROM noticias n
       LEFT JOIN filiados f ON n.autor_id = f.id
       WHERE n.id = $1`,
      [id]
    );

    if (newsRows.length === 0) {
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    const noticia = newsRows[0];
    const isGestao = verificarGestao(req);

    const podeVisualizar = isGestao || noticia.status === "PUBLICADA";

    if (!podeVisualizar) {
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    const { rows: midiaRows } = await pool.query(
      "SELECT * FROM noticia_midias WHERE noticia_id = $1 ORDER BY ordem ASC",
      [id]
    );

    noticia.midias = midiaRows;

    log.info("NOTICIAS_DETAIL_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.json({ ...noticia, requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao detalhar notícia.");
  }
};

exports.criar = async (req, res) => {
  const start = Date.now();
  const method = "POST";
  const endpoint = "/api/noticias";
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { titulo, conteudo, capa_url, subtitulo, destaque, data_noticia } = req.body;

    if (!titulo || !conteudo) {
      return res.status(400).json({ success: false, message: "Título e conteúdo são obrigatórios.", requestId });
    }

    const publishedAtBase = data_noticia || new Date().toISOString();
    const client = await pool.connect();
    let createdRow;

    try {
      await client.query("BEGIN");

      // Rotação Editorial: Ao criar uma nova, a anterior deixa de ser ATUAL
      const { rows: atuais } = await client.query(
        `SELECT id FROM noticias WHERE status_editorial = 'ATUAL' FOR UPDATE`
      );

      if (atuais.length > 0) {
        const idsToArchive = atuais.map(r => r.id);
        await client.query(
          `UPDATE noticias
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
        `INSERT INTO noticias (titulo, subtitulo, conteudo, status, autor_id, capa_url, destaque, data_noticia, status_editorial, is_editable, sort_date)
         VALUES ($1, $2, $3, 'RASCUNHO', $4, $5, $6, COALESCE($7, NOW()), 'ATUAL', true, COALESCE($7, NOW()))
         RETURNING *`,
        [titulo, subtitulo || null, conteudo, req.user.id, capa_url, Boolean(destaque), publishedAtBase]
      );

      createdRow = createdRows[0];
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    log.info("NOTICIAS_CREATE_SUCCESS", { endpoint, method, requestId, atorId, profile, durationMs: Date.now() - start });
    return res.status(201).json({ ...createdRow, requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao criar notícia.");
  }
};

exports.atualizar = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseNoticiaId(req, res, requestId);
  if (id === null) return;

  const method = "PUT";
  const endpoint = `/api/noticias/${id}`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { titulo, subtitulo, conteudo, capa_url, status, destaque, data_noticia } = req.body;

    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM noticias WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    const noticiaAlvo = estadoRows[0];
    if (noticiaAlvo.status_editorial === "ARQUIVADA" || noticiaAlvo.is_editable === false) {
      return res.status(409).json({ success: false, message: "Esta notícia está arquivada e não pode mais ser editada.", code: "ARCHIVED_NEWS_IMMUTABLE", requestId });
    }

    const { rows } = await pool.query(
      `UPDATE noticias
       SET titulo = COALESCE($1, titulo),
           subtitulo = COALESCE($2, subtitulo),
           conteudo = COALESCE($3, conteudo),
           capa_url = COALESCE($4, capa_url),
           status = COALESCE($5, status),
           destaque = COALESCE($6, destaque),
           data_noticia = COALESCE($7, data_noticia),
           sort_date = COALESCE($7, sort_date)
       WHERE id = $8
       RETURNING *`,
      [titulo, subtitulo, conteudo, capa_url, status, destaque, data_noticia, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    const noticiaAtualizada = rows[0];

    log.info("NOTICIAS_UPDATE_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.json({ ...noticiaAtualizada, requestId });
  } catch (err) {
    log.error("NOTICIAS_UPDATE_FAILED", { endpoint, method, requestId, atorId, profile, id, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao atualizar notícia.");
  }
};

exports.publicar = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseNoticiaId(req, res, requestId);
  if (id === null) return;

  const method = "POST";
  const endpoint = `/api/noticias/${id}/publicar`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM noticias WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Notícia arquivada não pode ser publicada novamente.", requestId });
    }

    const client = await pool.connect();
    let publishRows;
    try {
      await client.query("BEGIN");

      // Rotação Editorial na Publicação: Garante que apenas esta seja ATUAL
      const { rows: atuais } = await client.query(
        `SELECT id FROM noticias
         WHERE status_editorial = 'ATUAL'
           AND id <> $1
         FOR UPDATE`,
        [id]
      );

      if (atuais.length > 0) {
        const idsToArchive = atuais.map(r => r.id);
        await client.query(
          `UPDATE noticias
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
        `UPDATE noticias
         SET status = 'PUBLICADA',
             published_at = COALESCE(published_at, NOW()),
             status_editorial = 'ATUAL',
             is_editable = true,
             archived_at = NULL,
             sort_date = COALESCE(sort_date, published_at, created_at)
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (baseRows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
      }

      const noticiaBase = baseRows[0];
      const publicRef = await gerarPublicRefNoticia(client, noticiaBase);

      const { rows: publishedRows } = await client.query(
        `UPDATE noticias SET public_ref = $1 WHERE id = $2 RETURNING *`,
        [publicRef, noticiaBase.id]
      );

      publishRows = publishedRows;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    log.info("NOTICIAS_PUBLISH_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.json({ ...publishRows[0], requestId });
  } catch (err) {
    log.error("NOTICIAS_PUBLISH_FAILED", { endpoint, method, requestId, atorId, profile, id, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao publicar notícia.");
  }
};

exports.detalharPublicaPorRef = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const publicRef = String(req.params.publicRef || "").trim();

  if (!publicRef) {
    return res.status(400).json({ success: false, message: "Referência pública inválida.", requestId });
  }
  if (!/^\d{8}-noticia-\d+$/i.test(publicRef)) {
    return res.status(400).json({ success: false, message: "Referência pública inválida para notícia.", requestId });
  }

  try {
    const { rows: newsRows } = await pool.query(
      `SELECT n.*, f.nome AS autor_nome
       FROM noticias n
       LEFT JOIN filiados f ON n.autor_id = f.id
       WHERE n.public_ref = $1
         AND n.status = 'PUBLICADA'
       LIMIT 1`,
      [publicRef]
    );

    if (newsRows.length === 0) {
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    const noticia = newsRows[0];
    const { rows: midiaRows } = await pool.query(
      "SELECT * FROM noticia_midias WHERE noticia_id = $1 ORDER BY ordem ASC",
      [noticia.id]
    );

    noticia.midias = midiaRows;
    return res.json({ ...noticia, requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao detalhar notícia.");
  }
};

exports.arquivar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const id = parseNoticiaId(req, res, requestId);
  if (id === null) return;

  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, status_editorial FROM noticias WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    const noticia = rows[0];

    if (noticia.status_editorial === "ARQUIVADA") {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "A notícia já está arquivada.", requestId });
    }

    await client.query(
      `UPDATE noticias
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
    log.info("NOTICIAS_ARCHIVE_SUCCESS", { requestId, atorId, id });
    return res.json({ success: true, requestId });
  } catch (err) {
    await client.query("ROLLBACK");
    log.error("NOTICIAS_ARCHIVE_FAILED", { requestId, atorId, id, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao arquivar notícia atual.");
  } finally {
    client.release();
  }
};

exports.excluir = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseNoticiaId(req, res, requestId);
  if (id === null) return;

  const method = "DELETE";
  const endpoint = `/api/noticias/${id}`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: lockRows } = await pool.query("SELECT status_editorial FROM noticias WHERE id = $1", [id]);
    if (lockRows.length === 0) {
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    if (lockRows[0].status_editorial === "ARQUIVADA") {
      return res.status(409).json({ success: false, message: "Notícia arquivada não pode ser excluída.", code: "ARCHIVED_NEWS_IMMUTABLE", requestId });
    }

    const { rowCount } = await pool.query("DELETE FROM noticias WHERE id = $1", [id]);

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    log.info("NOTICIAS_DELETE_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.json({ success: true, requestId });
  } catch (err) {
    log.error("NOTICIAS_DELETE_FAILED", { endpoint, method, requestId, atorId, profile, id, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao excluir notícia.");
  }
};

exports.adicionarMidia = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseNoticiaId(req, res, requestId);
  if (id === null) return;

  const method = "POST";
  const endpoint = `/api/noticias/${id}/midias`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM noticias WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Notícia arquivada não permite adição de mídias.", requestId });
    }

    const { tipo, ordem } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Arquivo não enviado.", requestId });
    }

    const resourceType = tipo === "VIDEO" ? "video" : "image";
    const result = await cloudinary.uploadFileBuffer(req.file.buffer, {
      resource_type: resourceType,
      folder: "noticias",
      standardizeImage: false,
    });

    const { rows } = await pool.query(
      `INSERT INTO noticia_midias (noticia_id, tipo, url, ordem)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, tipo || (resourceType === "video" ? "VIDEO" : "IMAGEM"), result.secure_url, ordem || 0]
    );

    log.info("NOTICIAS_ADD_MEDIA_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.status(201).json({ ...rows[0], requestId });
  } catch (err) {
    log.error("NOTICIAS_ADD_MEDIA_FAILED", { endpoint, method, requestId, atorId, profile, id, errorMessage: err.message });
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
  const endpoint = `/api/noticias/midias/${midiaId}`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: midiaRows } = await pool.query(
      "SELECT n.status_editorial, n.is_editable FROM noticias n JOIN noticia_midias nm ON n.id = nm.noticia_id WHERE nm.id = $1",
      [midiaId]
    );

    if (midiaRows.length > 0) {
      if (midiaRows[0].status_editorial === "ARQUIVADA" || midiaRows[0].is_editable === false) {
        return res.status(409).json({ success: false, message: "Mídia de notícia arquivada não pode ser removida.", requestId });
      }
    }

    const { rowCount } = await pool.query("DELETE FROM noticia_midias WHERE id = $1", [midiaId]);

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: "Mídia não encontrada.", requestId });
    }

    log.info("NOTICIAS_REMOVE_MEDIA_SUCCESS", { endpoint, method, requestId, atorId, profile, midiaId, durationMs: Date.now() - start });
    return res.json({ success: true, requestId });
  } catch (err) {
    log.error("NOTICIAS_REMOVE_MEDIA_FAILED", { endpoint, method, requestId, atorId, profile, midiaId, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao remover mídia.");
  }
};

exports.adicionarMidiaExterna = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseNoticiaId(req, res, requestId);
  if (id === null) return;

  const method = "POST";
  const endpoint = `/api/noticias/${id}/midias_external`;
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });
  const profile = req.user?.perfil_acesso;

  try {
    if (!verificarGestao(req)) {
      return res.status(403).json({ success: false, message: "Acesso negado.", requestId });
    }

    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM noticias WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Notícia não encontrada.", requestId });
    }

    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Notícia arquivada não permite adição de mídias externas.", requestId });
    }

    const { tipo, url, ordem } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, message: "URL da mídia não fornecida.", requestId });
    }

    const { rows } = await pool.query(
      `INSERT INTO noticia_midias (noticia_id, tipo, url, ordem)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, tipo, url, ordem || 0]
    );

    log.info("NOTICIAS_ADD_EXTERNAL_MEDIA_SUCCESS", { endpoint, method, requestId, atorId, profile, id, durationMs: Date.now() - start });
    return res.status(201).json({ ...rows[0], requestId });
  } catch (err) {
    log.error("NOTICIAS_ADD_EXTERNAL_MEDIA_FAILED", { endpoint, method, requestId, atorId, profile, id, errorMessage: err.message });
    return handleDbError(err, res, requestId, "Erro ao associar mídia externa.");
  }
};

exports.obterAssinaturaUpload = async (req, res) => {
  const start = Date.now();
  const method = "POST";
  const endpoint = "/api/noticias/upload-signature";
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
      folder: folder || "noticias",
      tags: tags || "noticia",
    };

    if (resource_type !== "video") {
      params.transformation = cloudinary.STANDARD_IMAGE_TRANSFORMATION_STRING;
    }

    const signatureData = cloudinary.gerarAssinaturaUpload(params);
    log.info("NOTICIAS_GET_SIGNATURE_SUCCESS", { endpoint, method, requestId, atorId, profile, durationMs: Date.now() - start });
    return res.json({ ...signatureData, requestId });
  } catch (err) {
    log.error("NOTICIAS_GET_SIGNATURE_FAILED", { endpoint, method, requestId, atorId, profile, durationMs: Date.now() - start, errorMessage: err.message });
    return res.status(500).json({ success: false, message: "Erro ao gerar assinatura.", code: "INTERNAL_SERVER_ERROR", requestId });
  }
};
