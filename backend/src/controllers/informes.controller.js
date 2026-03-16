const pool = require("../config/db");
const log = require("../utils/log");
const cloudinary = require("../services/cloudinary.service");
const { v4: uuidv4 } = require("uuid");
const { handleDbError } = require("../utils/dbError");
const { parseUuid } = require("../utils/parseUuid");
const { ehPerfilGestao } = require("../shared/canon");

const AUDIENCIAS_VALIDAS = ["INTERNA", "PUBLICA"];
const INFORMES_POR_PAGINA = 3;

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
  // Meio-dia UTC evita virada indevida de dia em clientes com timezone local.
  return `${dateOnly}T12:00:00.000Z`;
}

function serializeInformeRow(row) {
  return {
    ...row,
    data_informe: toDateOnly(row.data_noticia || row.published_at || row.created_at),
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

function resolverAudienciaEscopo(req, fallback) {
  const fromScope = req.audienciaEscopo ? String(req.audienciaEscopo).toUpperCase() : null;
  if (fromScope && AUDIENCIAS_VALIDAS.includes(fromScope)) return fromScope;
  return fallback;
}

exports.listar = async (req, res) => {
  const start = Date.now();
  const method = "GET";
  const endpoint = "/api/informes";
  const requestId = req.requestId || uuidv4();
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;
  const queryParams = req.query;

  let query = "";
  let params = [];

  try {
    const { status, audiencia, pagina, status_editorial } = req.query;
    const audienciaNorm = audiencia ? String(audiencia).toUpperCase() : null;
    const statusEditorialNorm = status_editorial ? String(status_editorial).toUpperCase() : null;
    const audienciaEscopo = resolverAudienciaEscopo(req, null);
    const isGestao = verificarGestao(req);
    const isAutenticado = Boolean(req.user?.id);

    if (statusEditorialNorm && !['ATUAL', 'ARQUIVADA'].includes(statusEditorialNorm)) {
      return res.status(400).json({
        success: false,
        message: "Parâmetro 'status_editorial' inválido. Use ATUAL ou ARQUIVADA.",
        code: "INVALID_QUERY_PARAMS",
        requestId
      });
    }

    // Validação estrita: se vier algo que não seja string, é erro 400.
    if (status && typeof status !== 'string') {
      // Sanitização básica do valor recebido para o log (se for objeto, vira string)
      const receivedValue = typeof status === 'object' ? JSON.stringify(status) : String(status);

      log.warn("INFORMES_GET_INVALID_PARAMS", {
        requestId,
        userId,
        queryParams,
        receivedStatusType: typeof status,
        receivedStatusValue: receivedValue.substring(0, 500) // Limita tamanho no log
      });

      return res.status(400).json({
        success: false,
        message: "Parâmetro 'status' inválido. Deve ser uma string.",
        details: `Recebido tipo: ${typeof status}`,
        code: "INVALID_QUERY_PARAMS",
        requestId
      });
    }

    if (audienciaNorm && !AUDIENCIAS_VALIDAS.includes(audienciaNorm)) {
      return res.status(400).json({
        success: false,
        message: "Parâmetro 'audiencia' inválido. Use INTERNA ou PUBLICA.",
        code: "INVALID_QUERY_PARAMS",
        requestId
      });
    }

    query = `
      SELECT n.*, f.nome as autor_nome
      FROM noticias n
      LEFT JOIN filiados f ON n.autor_id = f.id
    `;

    const paginaSolicitada = Number.parseInt(String(pagina || "1"), 10);
    const paginaAtual = Number.isNaN(paginaSolicitada) || paginaSolicitada < 1 ? 1 : paginaSolicitada;

    if (!isAutenticado) {
      const audienciaLeitura = resolverAudienciaEscopo(req, "PUBLICA");
      params.push(audienciaLeitura);
      query += ` WHERE n.status = 'PUBLICADA' AND n.audiencia = $${params.length}`;
    } else if (!isGestao) {
      const audienciaLeitura = resolverAudienciaEscopo(req, "INTERNA");
      params.push(audienciaLeitura);
      query += ` WHERE n.status = 'PUBLICADA' AND n.audiencia = $${params.length}`;
      const statusEditorialLeitura = statusEditorialNorm || 'ATUAL';
      params.push(statusEditorialLeitura);
      query += ` AND n.status_editorial = $${params.length}`;
    } else {
      query += " WHERE 1=1";
      if (audienciaEscopo) {
        params.push(audienciaEscopo);
        query += ` AND n.audiencia = $${params.length}`;
      }
      if (status) {
        params.push(status.toUpperCase());
        query += ` AND n.status = $${params.length}`;
      }
      if (audienciaNorm && !audienciaEscopo) {
        params.push(audienciaNorm);
        query += ` AND n.audiencia = $${params.length}`;
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
      params.push(INFORMES_POR_PAGINA);
      query += ` LIMIT $${params.length}`;
      params.push((paginaAtual - 1) * INFORMES_POR_PAGINA);
      query += ` OFFSET $${params.length}`;
    }

    const { rows: noticias } = await pool.query(query, params);

    // Busca as mídias para todas as informes listadas
    if (noticias.length > 0) {
      const ids = noticias.map(n => n.id);
      const { rows: allMidias } = await pool.query(
        "SELECT * FROM noticia_midias WHERE noticia_id = ANY($1) ORDER BY ordem ASC",
        [ids]
      );

      // Otimização Bolt: Substituição de filtro aninhado (O(N*M)) por agrupamento via Map (O(N+M))
      // Isso evita percorrer toda a lista de mídias para cada informe.
      const midiasMap = new Map();
      allMidias.forEach(m => {
        if (!midiasMap.has(m.noticia_id)) {
          midiasMap.set(m.noticia_id, []);
        }
        midiasMap.get(m.noticia_id).push(m);
      });

      noticias.forEach(n => {
        n.midias = annotateMidiasCover(midiasMap.get(n.id) || [], n.capa_midia_id);
      });
    }

    log.info("INFORMES_GET_SUCCESS", {
      endpoint,
      method,
      requestId,
      userId,
      durationMs: Date.now() - start,
      count: noticias.length
    });

    if (!paginacaoPublica) {
      return res.json(noticias.map(serializeInformeRow));
    }

    const totalPaginas = Math.max(1, Math.ceil(total / INFORMES_POR_PAGINA));
    return res.json({
      items: noticias.map(serializeInformeRow),
      pagination: {
        page: paginaAtual,
        perPage: INFORMES_POR_PAGINA,
        totalItems: total,
        totalPages: totalPaginas,
      },
    });
  } catch (err) {
    log.error("INFORMES_GET_FAILED", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      queryParams,
      durationMs: Date.now() - start,
      errorMessage: err.message,
      stack: err.stack,
      sql: query,
      sqlParams: params
    });

    return res.status(500).json({
      success: false,
      message: "Erro interno ao processar informes.",
      errorId: requestId, // Correlaciona com o log
      code: "INTERNAL_SERVER_ERROR",
      requestId
    });
  }
};

exports.detalhar = async (req, res) => {
  const start = Date.now();
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  const method = "GET";
  const endpoint = `/api/informes/${id}`;
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: informeRows } = await pool.query(
      `SELECT n.*, f.nome as autor_nome
       FROM noticias n
       LEFT JOIN filiados f ON n.autor_id = f.id
       WHERE n.id = $1`,
      [id]
    );

    if (informeRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    const informe = informeRows[0];
    const isGestao = verificarGestao(req);
    const isAutenticado = Boolean(req.user?.id);
    const audienciaEscopo = resolverAudienciaEscopo(req, null);

    const podeVisualizar = !isAutenticado
      ? informe.status === "PUBLICADA" && informe.audiencia === "PUBLICA"
      : (isGestao || (informe.status === "PUBLICADA" && informe.audiencia === "INTERNA"));

    const respeitaEscopo = !audienciaEscopo || informe.audiencia === audienciaEscopo;

    if (!podeVisualizar || !respeitaEscopo) {
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    const { rows: midiaRows } = await pool.query(
      "SELECT * FROM noticia_midias WHERE noticia_id = $1 ORDER BY ordem ASC",
      [id]
    );

    informe.midias = annotateMidiasCover(midiaRows, informe.capa_midia_id);

    log.info("INFORMES_DETAIL_SUCCESS", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      id,
      durationMs: Date.now() - start
    });
    return res.json({ ...serializeInformeRow(informe), requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao detalhar informe.");
  }
};

exports.criar = async (req, res) => {
  const start = Date.now();
  const method = "POST";
  const endpoint = "/api/informes";
  const requestId = req.requestId || uuidv4();
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { titulo, conteudo, capa_url, audiencia, subtitulo, destaque, data_noticia, data_informe } = req.body;
    const audienciaFinal = resolverAudienciaEscopo(req, audiencia ? String(audiencia).toUpperCase() : "INTERNA");

    if (!titulo || !conteudo) {
      return res.status(400).json({ success: false, message: "Título e conteúdo são obrigatórios.", requestId });
    }

    if (!AUDIENCIAS_VALIDAS.includes(audienciaFinal)) {
      return res.status(400).json({ success: false, message: "Audiência inválida. Use INTERNA ou PUBLICA.", requestId });
    }

    const dataNoticiaCanonica = toDateOnlyTimestamp(data_informe || data_noticia);


    const { rows: atuais } = await pool.query(
      `SELECT id FROM noticias WHERE audiencia = $1 AND status_editorial = 'ATUAL' LIMIT 1`,
      [audienciaFinal]
    );
    if (atuais.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Já existe uma informe atual para a audiência ${audienciaFinal}. Arquive a informe atual antes de criar outra.`,
        code: "CURRENT_NEWS_ALREADY_EXISTS",
        requestId,
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO noticias (titulo, subtitulo, conteudo, status, autor_id, capa_url, audiencia, destaque, data_noticia, status_editorial, is_editable, sort_date)
       VALUES ($1, $2, $3, 'RASCUNHO', $4, $5, $6, $7, COALESCE($8, NOW()), 'ATUAL', true, COALESCE($8, NOW()))
       RETURNING *`,
      [titulo, subtitulo || null, conteudo, req.user.id, capa_url, audienciaFinal, Boolean(destaque), dataNoticiaCanonica || null]
    );

    log.info("INFORMES_CREATE_SUCCESS", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      durationMs: Date.now() - start
    });
    return res.status(201).json({ ...serializeInformeRow(rows[0]), requestId });
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
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { titulo, subtitulo, conteudo, capa_url, audiencia, destaque, data_noticia, data_informe } = req.body;
    const audienciaEscopo = resolverAudienciaEscopo(req, null);
    const audienciaFinal = audienciaEscopo || (audiencia ? String(audiencia).toUpperCase() : null);

    if (audienciaFinal && !AUDIENCIAS_VALIDAS.includes(audienciaFinal)) {
      return res.status(400).json({ success: false, message: "Audiência inválida. Use INTERNA ou PUBLICA.", requestId });
    }

    const dataNoticiaCanonica = toDateOnlyTimestamp(data_informe || data_noticia);

    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable, audiencia FROM noticias WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    const noticiaAlvo = estadoRows[0];
    if (noticiaAlvo.status_editorial === "ARQUIVADA" || noticiaAlvo.is_editable === false) {
      return res.status(409).json({
        success: false,
        message: "Esta informe está arquivada e não pode mais ser editada.",
        code: "ARCHIVED_NEWS_IMMUTABLE",
        requestId,
      });
    }

    if (audienciaFinal && audienciaFinal !== noticiaAlvo.audiencia) {
      const { rows: atuais } = await pool.query(
        `SELECT id FROM noticias WHERE audiencia = $1 AND status_editorial = 'ATUAL' AND id != $2 LIMIT 1`,
        [audienciaFinal, id]
      );
      if (atuais.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Já existe uma informe atual para a audiência ${audienciaFinal}. Não é possível mover esta informe atual para lá sem antes arquivar a existente.`,
          code: "CURRENT_NEWS_ALREADY_EXISTS",
          requestId,
        });
      }
    }

    const { rows } = await pool.query(
      `UPDATE noticias
       SET titulo = COALESCE($1, titulo),
           subtitulo = COALESCE($2, subtitulo),
           conteudo = COALESCE($3, conteudo),
           capa_url = COALESCE($4, capa_url),
           audiencia = COALESCE($5, audiencia),
           destaque = COALESCE($6, destaque),
           data_noticia = COALESCE($7, data_noticia),
           sort_date = COALESCE($7, sort_date)
       WHERE id = $8
       RETURNING *`,
      [titulo, subtitulo, conteudo, capa_url, audienciaFinal, destaque, dataNoticiaCanonica, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    log.info("INFORMES_UPDATE_SUCCESS", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      id,
      durationMs: Date.now() - start
    });
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
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM noticias WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Informe arquivada não pode ser publicada novamente.", requestId });
    }

    const { rows } = await pool.query(
      `UPDATE noticias
       SET status = 'PUBLICADA',
           status_editorial = 'ATUAL',
           is_editable = true,
           published_at = COALESCE(published_at, NOW())
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    log.info("INFORMES_PUBLISH_SUCCESS", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      id,
      durationMs: Date.now() - start
    });
    return res.json({ ...serializeInformeRow(rows[0]), requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao publicar informe.");
  }
};

exports.arquivar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, status_editorial, audiencia
       FROM noticias
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    const informe = rows[0];

    if (informe.status_editorial === "ARQUIVADA") {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "A informe já está arquivada.", requestId });
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
    return res.json({ success: true, requestId });
  } catch (err) {
    await client.query("ROLLBACK");
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
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: lockRows } = await pool.query("SELECT status_editorial FROM noticias WHERE id = $1", [id]);
    if (lockRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    if (lockRows[0].status_editorial === "ARQUIVADA") {
      return res.status(409).json({
        success: false,
        message: "Informe arquivada não pode ser excluída.",
        code: "ARCHIVED_NEWS_IMMUTABLE",
        requestId,
      });
    }

    const { rowCount } = await pool.query("DELETE FROM noticias WHERE id = $1", [id]);

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    log.info("INFORMES_DELETE_SUCCESS", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      id,
      durationMs: Date.now() - start
    });
    return res.json({ success: true, requestId });
  } catch (err) {
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
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM noticias WHERE id = $1",
      [id]
    );

    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Informe arquivada não permite adição de mídias.", requestId });
    }

    const { tipo, ordem } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Arquivo não enviado.", requestId });
    }

    const resourceType = tipo === "VIDEO" ? "video" : "image";
    const result = await cloudinary.uploadFileBuffer(req.file.buffer, {
      resource_type: resourceType,
      folder: "noticias"
    });

    const { rows } = await pool.query(
      `INSERT INTO noticia_midias (noticia_id, tipo, url, ordem)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, tipo || (resourceType === "video" ? "VIDEO" : "IMAGEM"), result.secure_url, ordem || 0]
    );

    log.info("NOTICIAS_ADD_MEDIA_SUCCESS", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      id,
      durationMs: Date.now() - start
    });
    return res.status(201).json({ ...rows[0], is_capa: false, requestId });
  } catch (err) {
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
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { rows: midiaRows } = await pool.query(
      "SELECT n.id as noticia_id, n.status_editorial, n.is_editable, n.capa_midia_id FROM noticias n JOIN noticia_midias nm ON n.id = nm.noticia_id WHERE nm.id = $1",
      [midiaId]
    );

    if (midiaRows.length > 0) {
      if (midiaRows[0].status_editorial === "ARQUIVADA" || midiaRows[0].is_editable === false) {
        return res.status(409).json({ success: false, message: "Mídia de informe arquivada não pode ser removida.", requestId });
      }
    }

    if (midiaRows.length > 0 && midiaRows[0].capa_midia_id === midiaId) {
      await pool.query("UPDATE noticias SET capa_midia_id = NULL, capa_url = NULL WHERE id = $1", [midiaRows[0].noticia_id]);
    }

    const { rowCount } = await pool.query("DELETE FROM noticia_midias WHERE id = $1", [midiaId]);

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: "Mídia não encontrada.", requestId });
    }

    log.info("NOTICIAS_REMOVE_MEDIA_SUCCESS", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      midiaId,
      durationMs: Date.now() - start
    });
    return res.json({ success: true, requestId });
  } catch (err) {
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
  const userId = req.user?.id;
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
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }

    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Informe arquivada não permite adição de mídias externas.", requestId });
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

    log.info("NOTICIAS_ADD_EXTERNAL_MEDIA_SUCCESS", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      id,
      durationMs: Date.now() - start
    });
    return res.status(201).json({ ...rows[0], is_capa: false, requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao associar mídia externa.");
  }
};

exports.obterAssinaturaUpload = async (req, res) => {
  const start = Date.now();
  const method = "POST";
  const endpoint = "/api/informes/upload-signature";
  const requestId = req.requestId || uuidv4();
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    if (!verificarGestao(req)) {
      return res.status(403).json({ success: false, message: "Acesso negado.", requestId });
    }

    const { folder, tags, resource_type } = req.body;

    // Configurações canônicas de upload para Informes
    const params = {
      folder: folder || "noticias",
      tags: tags || "noticia",
    };

    if (resource_type !== "video") {
      params.transformation = cloudinary.STANDARD_IMAGE_TRANSFORMATION_STRING;
    }

    const signatureData = cloudinary.gerarAssinaturaUpload(params);
    log.info("NOTICIAS_GET_SIGNATURE_SUCCESS", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      durationMs: Date.now() - start
    });
    return res.json({ ...signatureData, requestId });
  } catch (err) {
    log.error("NOTICIAS_GET_SIGNATURE_FAILED", {
      endpoint,
      method,
      requestId,
      userId,
      profile,
      durationMs: Date.now() - start,
      errorMessage: err.message,
      stack: err.stack
    });
    return res.status(500).json({
      success: false,
      message: "Erro ao gerar assinatura.",
      code: "INTERNAL_SERVER_ERROR",
      requestId
    });
  }
};

exports.definirCapa = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const id = parseInformeId(req, res, requestId);
  if (id === null) return;

  try {
    const { rows: estadoRows } = await pool.query(
      "SELECT status_editorial, is_editable FROM noticias WHERE id = $1",
      [id]
    );
    if (estadoRows.length === 0) {
      return res.status(404).json({ success: false, message: "Informe não encontrada.", requestId });
    }
    if (estadoRows[0].status_editorial === "ARQUIVADA" || estadoRows[0].is_editable === false) {
      return res.status(409).json({ success: false, message: "Informe arquivada não permite alteração de capa.", requestId });
    }

    const coverMediaId = parseUuid(String(req.body?.coverMediaId || ""));
    if (!coverMediaId) {
      await pool.query("UPDATE noticias SET capa_midia_id = NULL, capa_url = NULL WHERE id = $1", [id]);
      return res.json({ success: true, capa_midia_id: null, capa_url: null, requestId });
    }

    const { rows: midiaRows } = await pool.query(
      "SELECT id, url, tipo FROM noticia_midias WHERE id = $1 AND noticia_id = $2",
      [coverMediaId, id]
    );
    if (midiaRows.length === 0) {
      return res.status(404).json({ success: false, message: "Mídia de capa não encontrada para este informe.", requestId });
    }
    if (midiaRows[0].tipo !== "IMAGEM") {
      return res.status(400).json({ success: false, message: "A capa deve ser uma imagem anexada ao informe.", requestId });
    }

    await pool.query(
      "UPDATE noticias SET capa_midia_id = $1, capa_url = $2 WHERE id = $3",
      [coverMediaId, midiaRows[0].url, id]
    );

    return res.json({ success: true, capa_midia_id: coverMediaId, capa_url: midiaRows[0].url, requestId });
  } catch (err) {
    return handleDbError(err, res, requestId, "Erro ao definir capa do informe.");
  }
};
