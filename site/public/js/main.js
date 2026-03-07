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
  const bodyEl = document.body;

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
  } else {
    bodyEl.classList.add("public-shell");
  }

  // ---------------- HEADER ----------------
  if (headerEl && !isEmbed) {
    headerEl.innerHTML = `
      <header class="site-header">
        <div class="ui-container header-content">
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
            <a href="/index.html" class="nav-link ${isActive("index.html")}">Início</a>
            <a href="/diretoria.html" class="nav-link ${isActive("diretoria.html")}">Diretoria</a>
            <a href="/estatuto.html" class="nav-link ${isActive("estatuto.html")}">Estatuto</a>
            <a href="/noticias.html" class="nav-link ${isActive("noticias.html")}">Notícias</a>
            <a href="/contato.html" class="nav-link ${isActive("contato.html")}">Contato</a>
          </nav>

          <div class="header-actions">
            <a href="/filiese.html" class="ui-button ui-button-outline header-btn-outline">Filie-se</a>
            <a href="/area-filiado.html" class="ui-button ui-button-secondary">Página Inicial</a>
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
        <div class="ui-container footer-content">
          <p>&copy; ${ano} SINPRF-ES – Sindicato dos Policiais Rodoviários Federais no Espírito Santo.</p>
          <p class="footer-small">
            Desenvolvido para uso institucional. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    `;
  }

  function syncPublicShellOffsets() {
    const header = document.querySelector('.site-header');
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--public-header-offset', `${headerHeight}px`);
  }

  if (!isEmbed) {
    syncPublicShellOffsets();
    window.addEventListener('resize', syncPublicShellOffsets, { passive: true });
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


async function renderCmsBlocksPublic(page, mountSelector) {
  const mount = document.querySelector(mountSelector);
  if (!mount) return;

  try {
    const API_BASE = (window.Utils && window.Utils.resolveApiBase)
      ? window.Utils.resolveApiBase()
      : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || '').replace(/\/+$/, '');

    if (!API_BASE) return;

    const response = await fetch(`${API_BASE}/api/content-blocks?page=${encodeURIComponent(page)}`);
    if (!response.ok) return;

    const blocks = await response.json();
    if (!Array.isArray(blocks) || blocks.length === 0) return;

    mount.innerHTML = blocks.map((block) => {
      const title = window.Utils?.escapeHTML ? window.Utils.escapeHTML(block.title || '') : (block.title || '');
      const body = block.body || '';
      const media = block.media_url
        ? (block.media_type === 'video'
          ? `<video controls style="width:100%; border-radius:8px; margin-bottom:12px;"><source src="${block.media_url}" /></video>`
          : `<img src="${block.media_url}" alt="${title}" style="width:100%; max-height:420px; object-fit:cover; border-radius:8px; margin-bottom:12px;" />`)
        : '';
      return `
        <section class="ui-card public-card" style="margin-top: var(--ui-space-4);">
          ${title ? `<h2 class="section-title"><span>${title}</span></h2>` : ''}
          ${media}
          ${body ? `<div class="section-box" style="background: var(--ui-bg); padding: var(--ui-space-3); border-radius: var(--ui-radius);">${body}</div>` : ''}
        </section>
      `;
    }).join('');
  } catch (err) {
    console.warn('Falha ao carregar CMS público:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderCmsBlocksPublic('home', '#cms-home-blocks');
});
