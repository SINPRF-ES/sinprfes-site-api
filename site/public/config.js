(function () {
  const host = window.location.hostname || "";
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local");

  const LOCAL_API = "http://localhost:3000";
  const PROD_API = "https://api.sinprfes.org.br";

  const apiUrl = String(isLocal ? LOCAL_API : PROD_API).replace(/\/+$/, "");

  window.API_BASE_URL = apiUrl;
  window.ENV_CONFIG = window.ENV_CONFIG || {};
  window.ENV_CONFIG.API_URL = apiUrl;
})();
