const pool = require("../config/db");
const log = require("../utils/log");
const cloudinary = require("../services/cloudinary.service");

const PERFIS_GESTAO = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "COMUNICADOR"];

function verificarGestao(req) {
  const perfil = (req.user?.perfil_acesso || "").toUpperCase();
  return PERFIS_GESTAO.includes(perfil);
}

exports.listar = async (req, res) => {
  const method = "GET";
  const endpoint = "/api/noticias";
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;
  const queryParams = req.query;

  let query = "";
  let params = [];

  try {
    const { status } = req.query;
    const isGestao = verificarGestao(req);

    if (status && typeof status !== 'string') {
      return res.status(400).json({ message: "Parâmetro 'status' inválido." });
    }

    query = `
      SELECT n.*, f.nome as autor_nome
      FROM noticias n
      LEFT JOIN filiados f ON n.autor_id = f.id
    `;

    if (!isGestao) {
      query += " WHERE n.status = 'PUBLICADA'";
    } else if (status) {
      query += " WHERE n.status = $1";
      params.push(status.toUpperCase());
    }

    query += " ORDER BY n.published_at DESC, n.created_at DESC";

    const { rows } = await pool.query(query, params);
    return res.json(rows);
  } catch (err) {
    log.error("NOTICIAS_GET_FAILED", {
      endpoint,
      method,
      userId,
      profile,
      queryParams,
      errorMessage: err.message,
      stack: err.stack,
      sql: query,
      sqlParams: params
    });
    return res.status(500).json({ message: "Erro ao buscar notícias." });
  }
};

exports.detalhar = async (req, res) => {
  const { id } = req.params;
  const method = "GET";
  const endpoint = `/api/noticias/${id}`;
  const userId = req.user?.id;
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
      return res.status(404).json({ message: "Notícia não encontrada." });
    }

    const noticia = newsRows[0];

    const { rows: midiaRows } = await pool.query(
      "SELECT * FROM noticia_midias WHERE noticia_id = $1 ORDER BY ordem ASC",
      [id]
    );

    noticia.midias = midiaRows;

    return res.json(noticia);
  } catch (err) {
    log.error("NOTICIAS_DETAIL_FAILED", {
      endpoint,
      method,
      userId,
      profile,
      id,
      errorMessage: err.message,
      stack: err.stack
    });
    return res.status(500).json({ message: "Erro ao detalhar notícia." });
  }
};

exports.criar = async (req, res) => {
  const method = "POST";
  const endpoint = "/api/noticias";
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { titulo, conteudo, capa_url } = req.body;

    if (!titulo || !conteudo) {
      return res.status(400).json({ message: "Título e conteúdo são obrigatórios." });
    }

    const { rows } = await pool.query(
      `INSERT INTO noticias (titulo, conteudo, status, autor_id, capa_url)
       VALUES ($1, $2, 'RASCUNHO', $3, $4)
       RETURNING *`,
      [titulo, conteudo, req.user.id, capa_url]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    log.error("NOTICIAS_CREATE_FAILED", {
      endpoint,
      method,
      userId,
      profile,
      errorMessage: err.message,
      stack: err.stack,
      body: req.body
    });
    return res.status(500).json({ message: "Erro ao criar notícia." });
  }
};

exports.atualizar = async (req, res) => {
  const { id } = req.params;
  const method = "PUT";
  const endpoint = `/api/noticias/${id}`;
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { titulo, conteudo, capa_url, status } = req.body;

    const { rows } = await pool.query(
      `UPDATE noticias
       SET titulo = COALESCE($1, titulo),
           conteudo = COALESCE($2, conteudo),
           capa_url = COALESCE($3, capa_url),
           status = COALESCE($4, status)
       WHERE id = $5
       RETURNING *`,
      [titulo, conteudo, capa_url, status, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Notícia não encontrada." });
    }

    return res.json(rows[0]);
  } catch (err) {
    log.error("NOTICIAS_UPDATE_FAILED", {
      endpoint,
      method,
      userId,
      profile,
      id,
      errorMessage: err.message,
      stack: err.stack,
      body: req.body
    });
    return res.status(500).json({ message: "Erro ao atualizar notícia." });
  }
};

exports.publicar = async (req, res) => {
  const { id } = req.params;
  const method = "POST";
  const endpoint = `/api/noticias/${id}/publicar`;
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { rows } = await pool.query(
      `UPDATE noticias
       SET status = 'PUBLICADA',
           published_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Notícia não encontrada." });
    }

    return res.json(rows[0]);
  } catch (err) {
    log.error("NOTICIAS_PUBLISH_FAILED", {
      endpoint,
      method,
      userId,
      profile,
      id,
      errorMessage: err.message,
      stack: err.stack
    });
    return res.status(500).json({ message: "Erro ao publicar notícia." });
  }
};

exports.excluir = async (req, res) => {
  const { id } = req.params;
  const method = "DELETE";
  const endpoint = `/api/noticias/${id}`;
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { rowCount } = await pool.query("DELETE FROM noticias WHERE id = $1", [id]);

    if (rowCount === 0) {
      return res.status(404).json({ message: "Notícia não encontrada." });
    }

    return res.json({ success: true });
  } catch (err) {
    log.error("NOTICIAS_DELETE_FAILED", {
      endpoint,
      method,
      userId,
      profile,
      id,
      errorMessage: err.message,
      stack: err.stack
    });
    return res.status(500).json({ message: "Erro ao excluir notícia." });
  }
};

exports.adicionarMidia = async (req, res) => {
  const { id } = req.params; // noticia_id
  const method = "POST";
  const endpoint = `/api/noticias/${id}/midias`;
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { tipo, ordem } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Arquivo não enviado." });
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

    return res.status(201).json(rows[0]);
  } catch (err) {
    log.error("NOTICIAS_ADD_MEDIA_FAILED", {
      endpoint,
      method,
      userId,
      profile,
      id,
      errorMessage: err.message,
      stack: err.stack
    });
    return res.status(500).json({ message: "Erro ao adicionar mídia." });
  }
};

exports.removerMidia = async (req, res) => {
  const { midiaId } = req.params;
  const method = "DELETE";
  const endpoint = `/api/noticias/midias/${midiaId}`;
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    const { rowCount } = await pool.query("DELETE FROM noticia_midias WHERE id = $1", [midiaId]);

    if (rowCount === 0) {
      return res.status(404).json({ message: "Mídia não encontrada." });
    }

    return res.json({ success: true });
  } catch (err) {
    log.error("NOTICIAS_REMOVE_MEDIA_FAILED", {
      endpoint,
      method,
      userId,
      profile,
      midiaId,
      errorMessage: err.message,
      stack: err.stack
    });
    return res.status(500).json({ message: "Erro ao remover mídia." });
  }
};

exports.adicionarMidiaExterna = async (req, res) => {
  const { id } = req.params; // noticia_id
  const method = "POST";
  const endpoint = `/api/noticias/${id}/midias_external`;
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    if (!verificarGestao(req)) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const { tipo, url, ordem } = req.body;

    if (!url) {
      return res.status(400).json({ message: "URL da mídia não fornecida." });
    }

    const { rows } = await pool.query(
      `INSERT INTO noticia_midias (noticia_id, tipo, url, ordem)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, tipo, url, ordem || 0]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    log.error("NOTICIAS_ADD_EXTERNAL_MEDIA_FAILED", {
      endpoint,
      method,
      userId,
      profile,
      id,
      errorMessage: err.message,
      stack: err.stack,
      body: req.body
    });
    return res.status(500).json({ message: "Erro ao associar mídia externa." });
  }
};

exports.obterAssinaturaUpload = async (req, res) => {
  const method = "POST";
  const endpoint = "/api/noticias/upload-signature";
  const userId = req.user?.id;
  const profile = req.user?.perfil_acesso;

  try {
    if (!verificarGestao(req)) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const { folder, tags } = req.body;

    // Configurações canônicas de upload para Notícias
    const params = {
      folder: folder || "noticias",
      tags: tags || "noticia",
      // Padronização Cloudinary (f_auto, q_auto via presets ou params se suportado na assinatura)
      // Nota: f_auto/q_auto são geralmente aplicados na entrega (URL), não no upload.
      // Mas podemos definir um eager transformation se quisermos.
    };

    const signatureData = cloudinary.gerarAssinaturaUpload(params);
    return res.json(signatureData);
  } catch (err) {
    log.error("NOTICIAS_GET_SIGNATURE_FAILED", {
      endpoint,
      method,
      userId,
      profile,
      errorMessage: err.message,
      stack: err.stack
    });
    return res.status(500).json({ message: "Erro ao gerar assinatura." });
  }
};
