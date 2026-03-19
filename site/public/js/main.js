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

// Sentinel: Aplicar modo embed o mais cedo possível para evitar flicker
(function applyEmbedMode() {
  const params = new URLSearchParams(window.location.search);
  const isEmbed = params.get("embed") === "1" || params.get("app") === "1";
  if (isEmbed) {
    document.documentElement.classList.add("is-embed");
  }
})();

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
  const isEmbed = document.documentElement.classList.contains("is-embed");

  if (isEmbed) {
    document.body.style.paddingTop = "0";
    if (headerEl) headerEl.style.display = "none";
    if (footerEl) footerEl.style.display = "none";
  } else {
    bodyEl.classList.add("public-shell");
  }

  function syncPublicShellOffsets() {
    const header = document.querySelector('.site-header');
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--public-header-offset', `${headerHeight}px`);
  }

  // ---------------- HEADER ----------------
  if (headerEl && !isEmbed) {
    headerEl.classList.add('site-header');
    headerEl.innerHTML = `
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

          <button class="mobile-nav-toggle" aria-label="Abrir menu">
            <span></span>
            <span></span>
            <span></span>
          </button>

          <nav class="main-nav">
            <a href="/index.html" class="nav-link ${isActive("index.html")}">Início</a>
            <a href="/noticias.html" class="nav-link ${isActive("noticias.html")}">Notícias</a>
            <a href="/estatuto.html" class="nav-link ${isActive("estatuto.html")}">Estatuto</a>
            <a href="/diretoria.html" class="nav-link ${isActive("diretoria.html")}">Diretoria</a>
            <a href="/convenios.html" class="nav-link ${isActive("convenios.html")}">Convênios</a>
            <a href="/contato.html" class="nav-link ${isActive("contato.html")}">Contato</a>
            <a href="/filiese.html" class="nav-link ${isActive("filiese.html")}">Filie-se</a>
            <div class="mobile-only-actions">
              <a href="/area-filiado.html" class="ui-button ui-button-secondary">Área do Filiado</a>
            </div>
          </nav>

          <div class="header-actions">
            <a href="/area-filiado.html" class="ui-button ui-button-secondary">Área do Filiado</a>
          </div>
        </div>
    `;

    // Toggle menu mobile
    const toggleBtn = headerEl.querySelector('.mobile-nav-toggle');
    const mainNav = headerEl.querySelector('.main-nav');
    if (toggleBtn && mainNav) {
      toggleBtn.addEventListener('click', () => {
        toggleBtn.classList.toggle('active');
        mainNav.classList.toggle('active');
        document.body.classList.toggle('nav-open');
      });
    }

    // Fechar menu ao clicar em link (útil para âncoras, se houver)
    mainNav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        toggleBtn.classList.remove('active');
        mainNav.classList.remove('active');
        document.body.classList.remove('nav-open');
      });
    });

    // Sentinel: Sincroniza offsets imediatamente após injetar o header
    syncPublicShellOffsets();
  }

  // ---------------- FOOTER ----------------
  if (footerEl && !isEmbed) {
    const ano = new Date().getFullYear();
    footerEl.innerHTML = `
      <footer class="site-footer">
        <div class="ui-container footer-content">
          <div class="footer-brand">
            <img src="/img/placeholder-sinprf.png" alt="SINPRF-ES" class="footer-brand__logo">
            <div>
              <strong>SINPRF-ES</strong>
              <p>Sindicato dos Policiais Rodoviários Federais no Espírito Santo.</p>
            </div>
          </div>
          <div class="footer-links">
            <a href="/noticias.html">Notícias</a>
            <a href="/diretoria.html">Diretoria</a>
            <a href="/convenios.html">Convênios</a>
            <a href="/contato.html">Contato</a>
            <a href="/area-filiado.html">Área do Filiado</a>
          </div>
          <div class="footer-legal">
            <p>&copy; ${ano} SINPRF-ES. Portal institucional.</p>
            <p class="footer-small">Desenvolvido para comunicação oficial, acesso a serviços e divulgação pública de informações do sindicato.</p>
          </div>
        </div>
      </footer>
    `;
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
  window.addEventListener('load', async () => {
    const appVersion = window.APP_VERSION || window.ENV_CONFIG?.APP_VERSION || 'dev';
    const debugPwa = window.location.hostname === 'localhost' || localStorage.getItem('DEBUG_PWA') === '1';

    const pwaLog = (...args) => {
      if (!debugPwa) return;
      console.info('[pwa]', ...args);
    };

    pwaLog(`appVersion=${appVersion}`);

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        updateViaCache: 'none'
      });

      pwaLog('service worker registrado', registration.scope);

      registration.addEventListener('updatefound', () => {
        pwaLog('updatefound disparado');

        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          pwaLog('novo worker statechange', worker.state);

          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            pwaLog('nova versão instalada, solicitando skipWaiting');
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (window.__swControllerChanged) return;
        window.__swControllerChanged = true;
        pwaLog('controllerchange detectado; recarregando aplicação');
        window.location.reload();
      });

      // Força checagem de update ao abrir a página.
      registration.update().catch(() => {});

      // Fallback extra: compara versão remota para evitar travamento em iOS.
      try {
        const response = await fetch('/version.json', { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json();
          const remoteVersion = payload?.appVersion;
          pwaLog('versão remota detectada', remoteVersion);

          if (remoteVersion && remoteVersion !== appVersion && !sessionStorage.getItem('pwa-version-reloaded')) {
            sessionStorage.setItem('pwa-version-reloaded', '1');
            pwaLog('versão divergente detectada; recarregando aplicação');
            window.location.reload();
          }
        }
      } catch (_err) {
        // silencioso em produção
      }
    } catch (err) {
      if (debugPwa) {
        console.warn('Registro do Service Worker falhou:', err);
      }
    }
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
      const isConvenios = page === 'convenios';
      const title = window.Utils?.escapeHTML ? window.Utils.escapeHTML(block.title || '') : (block.title || '');
      const body = block.body || '';
      const media = block.media_url
        ? (block.media_type === 'video'
          ? `<video controls style="width:100%; border-radius:8px; margin-bottom:12px;"><source src="${block.media_url}" /></video>`
          : (isConvenios
            ? `<div class="cms-convenio-media-frame"><img class="cms-convenio-media" src="${block.media_url}" alt="${title}" /></div>`
            : `<img src="${block.media_url}" alt="${title}" style="width:100%; max-height:420px; object-fit:cover; border-radius:8px; margin-bottom:12px;" />`))
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
  if (document.querySelector('#cms-home-blocks')) {
    renderCmsBlocksPublic('home', '#cms-home-blocks');
  }

  if (document.querySelector('#cms-convenios-blocks')) {
    renderCmsBlocksPublic('convenios', '#cms-convenios-blocks');
  }
});
