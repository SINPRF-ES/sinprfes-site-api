// src/services/instagram.service.js
const axios = require("axios");
const log = require("../utils/log");

let cacheInstagram = []; // Armazena as fotos na memória
let lastUpdate = null;

// Pegue este token do seu arquivo .env
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_TOKEN;

async function atualizarFeedInstagram() {
  if (!INSTAGRAM_TOKEN) {
    log.warn("InstagramTokenNaoConfigurado");
    return;
  }

  try {
    // 1. URL para pegar as mídias (fotos/vídeos)
    // Limitamos a 6 itens para o site
    const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&limit=6&access_token=${INSTAGRAM_TOKEN}`;

    const resp = await axios.get(url);

    if (resp.data && resp.data.data) {
      cacheInstagram = resp.data.data;
      lastUpdate = new Date();
      log.info("InstagramFeedAtualizado", { itens: cacheInstagram.length });
    }
  } catch (err) {
    log.error("InstagramFeedErro", err.response ? err.response.data : err.message);
  }
}

// 2. Função para renovar o Token (Tokens de longa duração duram 60 dias)
// Vamos tentar renovar a cada 30 dias para garantir que nunca expire.
async function renovarTokenInstagram() {
    if (!INSTAGRAM_TOKEN) return;
    try {
        const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${INSTAGRAM_TOKEN}`;
        await axios.get(url);
        log.info("InstagramTokenRenovadoSucesso");
    } catch (err) {
        log.error("InstagramTokenRenovarErro", err.message);
    }
}

// Inicialização:
// Atualiza o feed agora e agenda atualizações a cada 4 horas
atualizarFeedInstagram();
setInterval(atualizarFeedInstagram, 1000 * 60 * 60 * 4); // 4 horas

// Renova o token a cada 10 dias (apenas para garantir)
setInterval(renovarTokenInstagram, 1000 * 60 * 60 * 24 * 10);

module.exports = {
  getFeed: () => ({
    data: cacheInstagram,
    updatedAt: lastUpdate
  })
};