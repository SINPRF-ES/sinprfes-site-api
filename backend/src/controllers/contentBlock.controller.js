// src/controllers/contentBlock.controller.js
const cloudinary = require('../services/cloudinary.service');
const pool = require('../config/db');

const VALID_PAGES = ['home', 'convenios'];

const DEFAULT_BLOCKS_BY_PAGE = {
  home: [
    {
      title: 'Bem-vindo ao SINPRF-ES',
      body: 'Sindicato dos Policiais Rodoviários Federais no Estado do Espírito Santo.',
      media_type: 'image',
      media_url: '',
      link_url: '',
      link_text: '',
      is_active: true,
      ordenacao: 1,
      slot: 'home-1'
    },
    {
      title: 'Ações e Informes',
      body: 'Acompanhe as ações institucionais e os principais informes aos filiados.',
      media_type: 'image',
      media_url: '',
      link_url: '',
      link_text: '',
      is_active: false,
      ordenacao: 2,
      slot: 'home-2'
    }
  ],
  convenios: [
    {
      title: 'Convênio exemplo',
      body: 'Descrição do convênio e condições para filiados.',
      media_type: 'image',
      media_url: '',
      link_url: '',
      link_text: '',
      is_active: true,
      ordenacao: 1,
      slot: 'convenios-1'
    },
    {
      title: 'Outro convênio',
      body: 'Use este bloco para cadastrar novos parceiros e benefícios.',
      media_type: 'image',
      media_url: '',
      link_url: '',
      link_text: '',
      is_active: false,
      ordenacao: 2,
      slot: 'convenios-2'
    }
  ]
};

const sanitizeBody = (html) => {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, '')
    .replace(/href\s*=\s*'javascript:[^']*'/gi, '')
    .replace(/href\s*=\s*javascript:[^\s>]+/gi, '');
};

const mapRow = (row) => ({
  id: String(row.id),
  page: row.page,
  title: row.title,
  body: row.body,
  media_type: row.media_type,
  media_url: row.media_url,
  link_url: row.link_url,
  link_text: row.link_text,
  is_active: row.is_active,
  ordenacao: row.ordenacao,
  updated_at: row.updated_at
});

const toInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const ensurePageDefaults = async (page, updatedBy) => {
  const defaultRows = DEFAULT_BLOCKS_BY_PAGE[page] || [];
  if (!defaultRows.length) return;

  const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM content_blocks WHERE page = $1', [page]);
  const count = toInteger(countRes.rows?.[0]?.count);
  if (count > 0) return;

  for (const block of defaultRows) {
    await pool.query(
      `INSERT INTO content_blocks (page, slot, title, body, media_type, media_url, link_url, link_text, is_active, ordenacao, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (page, slot) DO NOTHING`,
      [
        page,
        block.slot,
        block.title,
        block.body,
        block.media_type,
        block.media_url,
        block.link_url,
        block.link_text,
        block.is_active,
        block.ordenacao,
        updatedBy || null
      ]
    );
  }
};

const obterAssinaturaUpload = async (req, res) => {
  try {
    const { folder, tags } = req.body || {};
    const params = {
      folder: folder || 'sinprfes/avatars/cms',
      tags: tags || 'cms,site-publico',
      transformation: cloudinary.STANDARD_IMAGE_TRANSFORMATION_STRING,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const signatureData = cloudinary.gerarAssinaturaUpload(params);
    return res.json({
      success: true,
      ...signatureData,
      folder: params.folder,
      tags: params.tags,
      transformation: params.transformation,
    });
  } catch (err) {
    console.error('Erro ao gerar assinatura CMS:', err);
    return res.status(500).json({ success: false, error: 'Erro ao gerar assinatura de upload' });
  }
};

const getBlocks = async (req, res) => {
  const { page, includeInactive } = req.query;
  if (page && !VALID_PAGES.includes(page)) return res.status(400).json({ error: 'Página inválida' });

  try {
    if (page) {
      await ensurePageDefaults(page);
    }

    const params = [];
    const where = [];

    if (page) {
      params.push(page);
      where.push(`page = $${params.length}`);
    }

    if (includeInactive !== 'true') {
      where.push('is_active = true');
    }

    const query = `
      SELECT id, page, title, body, media_type, media_url, link_url, link_text, is_active, ordenacao, updated_at
      FROM content_blocks
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY page ASC, ordenacao ASC, id ASC
    `;

    const result = await pool.query(query, params);
    return res.json(result.rows.map(mapRow));
  } catch (err) {
    console.error('Erro ao buscar blocos de conteúdo:', err);
    return res.status(500).json({ error: 'Erro interno ao buscar conteúdo' });
  }
};

const updateBlock = async (req, res) => {
  const { id } = req.params;
  const { title, body, media_type, media_url, link_url, link_text, is_active, ordenacao, page } = req.body;
  const updatedBy = req.user.id;

  if (title && title.length > 120) return res.status(400).json({ error: 'Título muito longo (máx 120)' });
  if (body && body.length > 5000) return res.status(400).json({ error: 'Corpo muito longo (máx 5000)' });
  if (media_type && !['image', 'video'].includes(media_type)) return res.status(400).json({ error: 'Tipo de mídia inválido' });
  if (page && !VALID_PAGES.includes(page)) return res.status(400).json({ error: 'Página inválida' });
  if (media_url) {
    if (typeof media_url !== 'string' || media_url.length > 500) return res.status(400).json({ error: 'URL de mídia inválida ou muito longa' });
    if (media_url.toLowerCase().includes('javascript:')) return res.status(400).json({ error: 'URL de mídia perigosa detectada' });
  }

  try {
    const result = await pool.query(
      `UPDATE content_blocks
       SET
         title = COALESCE($1, title),
         body = COALESCE($2, body),
         media_type = COALESCE($3, media_type),
         media_url = COALESCE($4, media_url),
         link_url = COALESCE($5, link_url),
         link_text = COALESCE($6, link_text),
         is_active = COALESCE($7, is_active),
         ordenacao = COALESCE($8, ordenacao),
         page = COALESCE($9, page),
         updated_by = $10,
         updated_at = NOW()
       WHERE id = $11
       RETURNING id, page, title, body, media_type, media_url, link_url, link_text, is_active, ordenacao, updated_at`,
      [
        title,
        body !== undefined ? sanitizeBody(body) : null,
        media_type,
        media_url,
        link_url,
        link_text,
        typeof is_active === 'boolean' ? is_active : null,
        Number.isFinite(Number(ordenacao)) ? Number(ordenacao) : null,
        page,
        updatedBy,
        id
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Bloco não encontrado' });
    return res.json(mapRow(result.rows[0]));
  } catch (err) {
    console.error('Erro ao atualizar bloco de conteúdo:', err);
    return res.status(500).json({ error: 'Erro interno ao atualizar conteúdo' });
  }
};

const uploadMedia = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'Arquivo não enviado' });
    }

    const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';

    const result = await cloudinary.uploadFileBuffer(req.file.buffer, {
      folder: 'sinprfes/avatars/cms',
      resource_type: resourceType,
      tags: 'cms,site-publico',
      standardizeImage: false
    });

    return res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (err) {
    console.error('Erro no upload CMS:', err);
    return res.status(500).json({ success: false, error: 'Erro ao processar upload' });
  }
};

const createBlock = async (req, res) => {
  const { page, title, body, media_type, media_url, link_url, link_text, is_active, ordenacao } = req.body || {};
  const updatedBy = req.user.id;

  if (!VALID_PAGES.includes(page)) return res.status(400).json({ error: 'Página inválida' });
  if (title && title.length > 120) return res.status(400).json({ error: 'Título muito longo (máx 120)' });
  if (body && body.length > 5000) return res.status(400).json({ error: 'Corpo muito longo (máx 5000)' });
  if (media_type && !['image', 'video'].includes(media_type)) return res.status(400).json({ error: 'Tipo de mídia inválido' });
  if (media_url) {
    if (typeof media_url !== 'string' || media_url.length > 500) return res.status(400).json({ error: 'URL de mídia inválida ou muito longa' });
    if (media_url.toLowerCase().includes('javascript:')) return res.status(400).json({ error: 'URL de mídia perigosa detectada' });
  }

  try {
    await ensurePageDefaults(page, updatedBy);

    const maxOrderResult = await pool.query('SELECT COALESCE(MAX(ordenacao), 0) AS max_order FROM content_blocks WHERE page = $1', [page]);
    const maxOrder = Number(maxOrderResult.rows?.[0]?.max_order || 0);
    const finalOrder = Number.isFinite(Number(ordenacao)) ? Number(ordenacao) : maxOrder + 1;

    const slot = `${page}-${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO content_blocks (page, slot, title, body, media_type, media_url, link_url, link_text, is_active, ordenacao, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, page, title, body, media_type, media_url, link_url, link_text, is_active, ordenacao, updated_at`,
      [
        page,
        slot,
        title || 'Novo convênio',
        sanitizeBody(body || ''),
        media_type || 'image',
        media_url || '',
        link_url || '',
        link_text || '',
        typeof is_active === 'boolean' ? is_active : true,
        finalOrder,
        updatedBy
      ]
    );

    return res.status(201).json(mapRow(result.rows[0]));
  } catch (err) {
    console.error('Erro ao criar bloco de conteúdo:', err);
    return res.status(500).json({ error: 'Erro interno ao criar conteúdo' });
  }
};

module.exports = {
  getBlocks,
  updateBlock,
  createBlock,
  obterAssinaturaUpload,
  uploadMedia
};
