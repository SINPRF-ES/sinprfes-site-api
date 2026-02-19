/**
 * config.js — Configuração de ambiente (Site)
 *
 * Objetivos:
 *  - Definir uma fonte única de verdade para a base da API.
 *  - Ser compatível com código legado que usa:
 *      - window.API_BASE_URL
 *      - window.ENV_CONFIG.API_URL
 *  - Evitar URLs quebradas (undefined/api/..., barras duplas etc.)
 *  - Permitir dev local em localhost.
 */
(function () {
  // Detecta ambiente local
  const host = (window.location && window.location.hostname) ? window.location.hostname : "";
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local");

  // ✅ Ajuste aqui se sua API local rodar em outra porta
  const LOCAL_API = "http://localhost:3000";

  // ✅ Produção: subdomínio da API (Cloudflare -> Railway)
  // IMPORTANTE: deve existir um DNS/Proxy apontando api.sinprfes.org.br para o serviço do Railway
  const PROD_API = "https://api.sinprfes.org.br";

  // Base escolhida
  let apiUrl = isLocal ? LOCAL_API : PROD_API;

  // Normaliza: remove barra final para evitar "//api/..."
  apiUrl = String(apiUrl).replace(/\/+$/, "");

  // ✅ Compatibilidade total com o site:
  // - Filie-se antigo usa window.API_BASE_URL
  // - utils.js usa window.API_BASE_URL || window.ENV_CONFIG?.API_URL
  window.API_BASE_URL = apiUrl;

  // Mantém também o padrão novo
  window.ENV_CONFIG = window.ENV_CONFIG || {};
  window.ENV_CONFIG.API_URL = apiUrl;

  // Opcional: expõe um pequeno "health" de debug
  window.ENV_CONFIG.__loadedAt = new Date().toISOString();
})();
