// public/js/main.js

// Configuração global de API baseada no ambiente
/**
 * CANONICAL RULE:
 * Always use api.sinprfes.org.br for API calls.
 * Never use sinprfes.org.br (frontend only).
 */
if (typeof window.API_BASE_URL === "undefined") {
  window.API_BASE_URL = window.ENV_CONFIG?.API_URL ||
    ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000"
    : ""); // Default to empty (relative) on production for site proxy
}

document.addEventListener("DOMContentLoaded", () => {
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");

  // Descobre qual página estamos (ex.: "index.html", "diretoria.html", etc.)
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  function isActive(page) {
    if (currentPath === "" && page === "index.html") return "active";
    return currentPath === page ? "active" : "";
  }

  // Check for embed mode (app)
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1" ||
                  new URLSearchParams(window.location.search).get("app") === "1";

  if (isEmbed) {
    document.documentElement.classList.add("is-embed");
    document.body.style.paddingTop = "0";
    if (headerEl) headerEl.style.display = "none";
    if (footerEl) footerEl.style.display = "none";
  }

  // ---------------- HEADER ----------------
  if (headerEl && !isEmbed) {
    headerEl.innerHTML = `
      <header class="site-header" style="background: var(--ui-primary); color: white; padding: var(--ui-space-3) 0;">
        <div class="ui-container header-content" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--ui-space-3);">
          <div class="logo-area">
            <a href="/index.html" class="logo-link" style="text-decoration: none; color: white; display: flex; align-items: center; gap: 12px;">
              <img src="/img/placeholder-sinprf.png" alt="SINPRF-ES" class="logo-img" style="height: 50px;">
              <span class="logo-text" style="font-weight: 800; line-height: 1.1;">
                SINPRF-ES<br>
                <small style="font-weight: 400; opacity: 0.8;">Sindicato dos Policiais Rodoviários Federais no ES</small>
              </span>
            </a>
          </div>

          <nav class="main-nav" style="display: flex; gap: var(--ui-space-3); flex-wrap: wrap;">
            <a href="/index.html" class="${isActive("index.html")}" style="color: white; text-decoration: none; font-weight: 500;">Início</a>
            <a href="/diretoria.html" class="${isActive("diretoria.html")}" style="color: white; text-decoration: none; font-weight: 500;">Diretoria</a>
            <a href="/estatuto.html" class="${isActive("estatuto.html")}" style="color: white; text-decoration: none; font-weight: 500;">Estatuto</a>
            <a href="/noticias.html" class="${isActive("noticias.html")}" style="color: white; text-decoration: none; font-weight: 500;">Notícias</a>
            <a href="/contato.html" class="${isActive("contato.html")}" style="color: white; text-decoration: none; font-weight: 500;">Contato</a>
          </nav>

          <div class="header-actions" style="display: flex; gap: var(--ui-space-2);">
            <a href="/filiese.html" class="ui-button ui-button-outline" style="color: white; border-color: white; padding: 0.5rem 1rem;">Filie-se</a>
            <a href="/area-filiado.html" class="ui-button ui-button-secondary" style="padding: 0.5rem 1rem;">Página Inicial</a>
          </div>
        </div>
      </header>
    `;
  }

  // ---------------- FOOTER ----------------
  if (footerEl && !isEmbed) {
    const ano = new Date().getFullYear();
    footerEl.innerHTML = `
      <footer class="site-footer" style="background: var(--ui-primary); color: white; padding: var(--ui-space-5) 0; margin-top: var(--ui-space-6);">
        <div class="ui-container footer-content" style="text-align: center;">
          <p style="margin: 0;">&copy; ${ano} SINPRF-ES – Sindicato dos Policiais Rodoviários Federais no Espírito Santo.</p>
          <p class="footer-small" style="font-size: 0.8rem; opacity: 0.7; margin-top: var(--ui-space-2);">
            Desenvolvido para uso institucional. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    `;
  }

  // Palette: Inicializa toggles de senha se Utils estiver disponível
  if (window.Utils && window.Utils.initPasswordToggles) {
    window.Utils.initPasswordToggles();
  }
});

// Registro do Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => {
        // SW registrado com sucesso
      })
      .catch(err => {
        console.warn('Registro do Service Worker falhou:', err);
      });
  });
}
