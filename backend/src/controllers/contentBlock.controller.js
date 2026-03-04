// src/controllers/contentBlock.controller.js
const fs = require('fs');
const fsPromises = require('fs').promises;
const cloudinary = require('../services/cloudinary.service');
const path = require('path');

// Basic sanitization
const sanitizeBody = (html) => {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '') // Remove inline handlers with "
    .replace(/on\w+\s*=\s*'[^']*'/gi, '') // Remove inline handlers with '
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '') // Remove inline handlers without quotes
    .replace(/href\s*=\s*"javascript:[^"]*"/gi, '')
    .replace(/href\s*=\s*'javascript:[^']*'/gi, '')
    .replace(/href\s*=\s*javascript:[^\s>]+/gi, '');
};

const DATA_PATH = path.join(__dirname, '../../data/content_blocks.json');

// Simple memory mutex to prevent concurrent writes
let isWriting = false;
const waitLock = () => new Promise(resolve => {
  const check = () => {
    if (!isWriting) {
      isWriting = true;
      resolve();
    } else {
      setTimeout(check, 10);
    }
  };
  check();
});

const releaseLock = () => {
  isWriting = false;
};

// Helper to read data
const readData = () => {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      // Initial seeds
      const initialData = [
        {
          id: 'home-1',
          page: 'home',
          ordenacao: 1,
          title: 'Vigilância em Foco',
          body: 'Acompanhe as últimas ações de patrulhamento e segurança nas rodovias federais do Espírito Santo.',
          media_type: 'image',
          media_url: 'img/prf-hero.jpg',
          is_active: true,
          updated_at: new Date().toISOString()
        },
        {
          id: 'home-2',
          page: 'home',
          ordenacao: 2,
          title: 'Modernização da Frota',
          body: 'Novas viaturas equipadas com tecnologia de ponta chegam para reforçar o trabalho dos nossos policiais.',
          media_type: 'image',
          media_url: 'img/prf-vtr.jpg',
          is_active: true,
          updated_at: new Date().toISOString()
        },
        {
          id: 'home-3',
          page: 'home',
          ordenacao: 3,
          title: 'Treinamento Tático',
          body: 'Policiais participam de capacitação avançada em abordagem e operações especiais.',
          media_type: 'image',
          media_url: 'img/prf-treino.jpg',
          is_active: true,
          updated_at: new Date().toISOString()
        },
        {
          id: 'news-1',
          page: 'noticias',
          ordenacao: 1,
          title: 'Nova Sede Inaugurada',
          body: 'O sindicato agora conta com uma sede moderna para melhor atender todos os filiados.',
          media_type: 'image',
          media_url: 'img/brasao.png',
          is_active: true,
          updated_at: new Date().toISOString()
        }
      ];
      if (!fs.existsSync(path.dirname(DATA_PATH))) {
        fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
      }
      fs.writeFileSync(DATA_PATH, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (err) {
    console.error("CRITICAL: Erro ao ler ou parsear JSON de blocos de conteúdo:", err);
    throw new Error("Erro ao carregar dados do CMS (JSON Corrompido)");
  }
};

// Helper to write data (Atomic)
const writeDataAtomic = async (data) => {
  const tempPath = DATA_PATH + '.tmp';
  try {
    await fsPromises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await fsPromises.rename(tempPath, DATA_PATH);
  } catch (err) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw err;
  }
};


const obterAssinaturaUpload = async (req, res) => {
  try {
    const { folder, tags } = req.body || {};
    const params = {
      folder: folder || 'sinprfes/avatars/cms',
      tags: tags || 'cms,site-publico',
      timestamp: Math.floor(Date.now() / 1000)
    };

    const signatureData = cloudinary.gerarAssinaturaUpload(params);
    return res.json({ success: true, ...signatureData, folder: params.folder, tags: params.tags });
  } catch (err) {
    console.error('Erro ao gerar assinatura CMS:', err);
    return res.status(500).json({ success: false, error: 'Erro ao gerar assinatura de upload' });
  }
};

const getBlocks = async (req, res) => {
  const { page, includeInactive } = req.query;
  try {
    let blocks = readData();

    // Filtro por página
    if (page) {
      blocks = blocks.filter(b => b.page === page);
    }

    // Filtro por ativo (a menos que explicitamente solicitado incluir inativos)
    if (includeInactive !== 'true') {
      blocks = blocks.filter(b => b.is_active);
    }

    blocks.sort((a, b) => a.ordenacao - b.ordenacao);
    res.json(blocks);
  } catch (err) {
    console.error("Erro ao buscar blocos de conteúdo:", err);
    res.status(500).json({ error: "Erro interno ao buscar conteúdo" });
  }
};

const updateBlock = async (req, res) => {
  const { id } = req.params;
  const { title, body, media_type, media_url, link_url, link_text, is_active, ordenacao, page } = req.body;
  const updatedBy = req.user.id;

  // Strict Validation
  if (title && title.length > 120) return res.status(400).json({ error: "Título muito longo (máx 120)" });
  if (body && body.length > 5000) return res.status(400).json({ error: "Corpo muito longo (máx 5000)" });
  if (media_type && !['image', 'video'].includes(media_type)) return res.status(400).json({ error: "Tipo de mídia inválido" });
  if (page && !['home', 'noticias'].includes(page)) return res.status(400).json({ error: "Página inválida" });
  if (media_url) {
    if (typeof media_url !== 'string' || media_url.length > 500) return res.status(400).json({ error: "URL de mídia inválida ou muito longa" });
    if (media_url.toLowerCase().includes('javascript:')) return res.status(400).json({ error: "URL de mídia perigosa detectada" });
  }

  await waitLock();
  try {
    let blocks = readData();
    const index = blocks.findIndex(b => b.id == id);

    if (index === -1) {
      releaseLock();
      return res.status(404).json({ error: "Bloco não encontrado" });
    }

    // Update block
    blocks[index] = {
      ...blocks[index],
      title: title !== undefined ? title : blocks[index].title,
      body: body !== undefined ? sanitizeBody(body) : blocks[index].body,
      media_type: media_type !== undefined ? media_type : blocks[index].media_type,
      media_url: media_url !== undefined ? media_url : blocks[index].media_url,
      link_url: link_url !== undefined ? link_url : blocks[index].link_url,
      link_text: link_text !== undefined ? link_text : blocks[index].link_text,
      is_active: is_active !== undefined ? is_active : blocks[index].is_active,
      ordenacao: ordenacao !== undefined ? ordenacao : blocks[index].ordenacao,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy
    };

    await writeDataAtomic(blocks);
    res.json(blocks[index]);
  } catch (err) {
    console.error("Erro ao atualizar bloco de conteúdo:", err);
    res.status(500).json({ error: "Erro interno ao atualizar conteúdo" });
  } finally {
    releaseLock();
  }
};

module.exports = {
  getBlocks,
  updateBlock,
  obterAssinaturaUpload
};
