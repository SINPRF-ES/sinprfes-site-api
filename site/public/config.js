/**
 * Configuração Global do Site
 *
 * CANONICAL RULE:
 * Always use api.sinprfes.org.br for API calls.
 * Never use sinprfes.org.br (frontend only).
 */
(function () {
  const host = window.location.hostname || "";
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local");

  const LOCAL_API = "http://localhost:3000";
  const PROD_API = "https://api.sinprfes.org.br";

  let apiUrl = isLocal ? LOCAL_API : PROD_API;
  apiUrl = String(apiUrl).replace(/\/+$/, "");

  window.API_BASE_URL = apiUrl;

  window.ENV_CONFIG = window.ENV_CONFIG || {};
  window.ENV_CONFIG.API_URL = apiUrl;
})();
