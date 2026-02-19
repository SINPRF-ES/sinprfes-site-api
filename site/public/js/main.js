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
      <header class="site-header">
        <div class="container header-content">
          <div class="logo-area">
            <a href="/index.html" class="logo-link">
              <img src="/img/placeholder-sinprf.png" alt="SINPRF-ES" class="logo-img">
              <span class="logo-text">
                SINPRF-ES<br>
                <small>Sindicato dos Policiais Rodoviários Federais no ES</small>
              </span>
            </a>
          </div>

          <nav class="main-nav">
            <a href="/index.html" class="${isActive("index.html")}">Início</a>
            <a href="/diretoria.html" class="${isActive("diretoria.html")}">Diretoria</a>
            <a href="/estatuto.html" class="${isActive("estatuto.html")}">Estatuto</a>
            <a href="/noticias.html" class="${isActive("noticias.html")}">Notícias</a>
            <a href="/contato.html" class="${isActive("contato.html")}">Contato</a>
          </nav>

          <div class="header-actions">
            <a href="/filiese.html" class="btn btn-outline">Filie-se</a>
            <!-- 🔽 aqui é a mudança: agora aponta direto para a Página Inicial -->
            <a href="/area-filiado.html" class="btn btn-primary">Página Inicial</a>
          </div>
        </div>
      </header>
    `;
  }

  // ---------------- FOOTER ----------------
  if (footerEl && !isEmbed) {
    const ano = new Date().getFullYear();
    footerEl.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-content">
          <p>&copy; ${ano} SINPRF-ES – Sindicato dos Policiais Rodoviários Federais no Espírito Santo.</p>
          <p class="footer-small">
            Desenvolvido para uso institucional. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    `;
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
