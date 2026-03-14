// public/js/noticias-site.js

const INSTAGRAM_PROFILE_URL = 'https://instagram.com/sinprfes';

function escapeHtml(value) {
  return window.Utils?.escapeHTML ? window.Utils.escapeHTML(value || '') : (value || '');
}

function formatDate(value) {
  if (!value) return 'Data não informada';
  return new Date(value).toLocaleDateString('pt-BR');
}

function buildInstagramCard(post) {
  const title = escapeHtml(post.title || 'Post no Instagram');
  const shortCaption = title.length > 150 ? `${title.slice(0, 150)}…` : title;
  const date = formatDate(post.date);

  return `
    <article class="instagram-card instagram-card-news">
      <a href="${post.link}" target="_blank" rel="noopener noreferrer" aria-label="${title}">
        <div class="instagram-image-wrapper">
          <img src="${post.image}" alt="${title}" loading="lazy">
        </div>
        <div class="instagram-card-news__body">
          <p class="instagram-card-caption">${shortCaption}</p>
          <p class="instagram-card-news__meta">${date}</p>
          <span class="instagram-open-cta">Abrir no Instagram</span>
        </div>
      </a>
    </article>`;
}

function buildInstagramPagination(totalPages, currentPage) {
  if (totalPages <= 1) return '';

  const visiblePages = totalPages <= 10
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [1, 2, 3, 4, 5, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];

  const buttons = visiblePages.map((page) => {
    if (page === 'ellipsis') {
      return '<span class="instagram-pagination-ellipsis" aria-hidden="true">…</span>';
    }

    const activeClass = page === currentPage ? ' is-active' : '';
    const ariaCurrent = page === currentPage ? ' aria-current="page"' : '';
    return `<button class="ui-button ui-button-outline instagram-page-btn${activeClass}" data-instagram-page="${page}"${ariaCurrent}>${page}</button>`;
  }).join('');

  return `<nav class="instagram-pagination" aria-label="Paginação das publicações do Instagram">${buttons}</nav>`;
}

async function renderInstagramFeed(API_BASE, mountEl) {
  if (!mountEl) return;

  mountEl.innerHTML = `
    <section class="ui-card">
      <header class="instagram-news-header instagram-news-header--centered">
        <h2 class="section-title"><span class="emoji">📸</span><span>Instagram oficial</span></h2>
      </header>
      <div class="instagram-news-grid skeleton">
        <div class="insta-card-skeleton"></div>
        <div class="insta-card-skeleton"></div>
        <div class="insta-card-skeleton"></div>
      </div>
    </section>
  `;

  try {
    const response = await fetch(`${API_BASE}/api/public/instagram-feed`);
    const payload = await response.json();
    const posts = Array.isArray(payload?.posts) ? payload.posts : [];

    if (!payload?.ok || posts.length === 0) {
      throw new Error('instagram_feed_empty');
    }

    const sortedPosts = [...posts].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    const postsPerPage = 5;
    const totalPages = Math.ceil(sortedPosts.length / postsPerPage);

    const renderPage = (page) => {
      const currentPage = Math.min(Math.max(page, 1), totalPages);
      const start = (currentPage - 1) * postsPerPage;
      const visiblePosts = sortedPosts.slice(start, start + postsPerPage);

      mountEl.innerHTML = `
        <section class="ui-card">
          <header class="instagram-news-header instagram-news-header--centered">
            <h2 class="section-title"><span class="emoji">📸</span><span>Instagram oficial</span></h2>
          </header>
          <div class="instagram-news-grid">
            ${visiblePosts.map((post) => buildInstagramCard(post)).join('')}
          </div>
          ${buildInstagramPagination(totalPages, currentPage)}
          <div class="instagram-more">
            <a href="${payload.profileUrl || INSTAGRAM_PROFILE_URL}" target="_blank" rel="noopener noreferrer" class="ui-button ui-button-outline">Ver perfil oficial</a>
          </div>
        </section>
      `;

      mountEl.querySelectorAll('[data-instagram-page]').forEach((button) => {
        button.addEventListener('click', () => {
          const targetPage = Number(button.getAttribute('data-instagram-page'));
          renderPage(targetPage);
        });
      });
    };

    renderPage(1);
  } catch (error) {
    mountEl.innerHTML = `
      <section class="ui-card instagram-fallback">
        <p>Não foi possível carregar as publicações agora. Acesse o perfil oficial:</p>
        <a class="btn-instagram" href="${INSTAGRAM_PROFILE_URL}" target="_blank" rel="noopener noreferrer">Ver no Instagram</a>
      </section>
    `;
  }
}

function renderCmsNewsFeed(_API_BASE, mountEl) {
  if (!mountEl) return;

  const panelEl = document.getElementById('news-panel-cms');
  mountEl.innerHTML = `
    <section class="ui-card">
      <header class="instagram-news-header instagram-news-header--centered">
        <h2 class="section-title"><span class="emoji">📰</span><span>Notícias do SINPRF-ES</span></h2>
      </header>
      <p style="color:#64748b;">Carregando notícias...</p>
    </section>
  `;

  const toPreview = (value) => {
    if (!value) return 'Conteúdo em atualização.';
    const plain = window.InformesRenderer?.renderInformesPlainText
      ? window.InformesRenderer.renderInformesPlainText(value)
      : String(value).replace(/[#*_>`~-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plain) return 'Conteúdo em atualização.';
    return plain.length > 180 ? `${plain.slice(0, 180)}…` : plain;
  };

  fetch(`${_API_BASE}/api/noticias?pagina=1`)
    .then((response) => response.json())
    .then((payload) => {
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const noticiasPublicas = items.filter((item) => typeof item.public_ref === 'string' && item.public_ref.length > 0);

      if (noticiasPublicas.length === 0) {
        mountEl.innerHTML = '';
        panelEl?.classList.add('cms-news-placeholder');
        panelEl?.setAttribute('aria-hidden', 'true');
        return;
      }

      panelEl?.classList.remove('cms-news-placeholder');
      panelEl?.setAttribute('aria-hidden', 'false');

      mountEl.innerHTML = `
        <section class="ui-card">
          <header class="instagram-news-header instagram-news-header--centered">
            <h2 class="section-title"><span class="emoji">📰</span><span>Notícias do SINPRF-ES</span></h2>
          </header>
          <div class="instagram-news-grid">
            ${noticiasPublicas.map((item) => {
              const title = escapeHtml(item.titulo || 'Notícia');
              const subtitle = escapeHtml(item.subtitulo || '');
              const preview = escapeHtml(toPreview(item.conteudo));
              const href = `/noticias/${encodeURIComponent(item.public_ref)}`;
              const image = item.capa_url ? `<img src="${item.capa_url}" alt="${title}" loading="lazy">` : '<div style="height:180px;background:#f1f5f9;border-radius:10px;"></div>';
              return `
                <article class="instagram-card instagram-card-news">
                  <a href="${href}" aria-label="Abrir notícia: ${title}">
                    <div class="instagram-image-wrapper">${image}</div>
                    <div class="instagram-card-news__body">
                      <p class="instagram-card-caption" style="font-weight:700;">${title}</p>
                      ${subtitle ? `<p class="instagram-card-news__meta">${subtitle}</p>` : ''}
                      <p class="instagram-card-news__meta">${formatDate(item.published_at || item.data_noticia || item.created_at)}</p>
                      <p class="instagram-card-news__meta" style="line-height:1.4;">${preview}</p>
                      <span class="instagram-open-cta">Ler matéria completa</span>
                    </div>
                  </a>
                </article>
              `;
            }).join('')}
          </div>
        </section>
      `;
    })
    .catch(() => {
      mountEl.innerHTML = `
        <section class="ui-card instagram-fallback">
          <p>Não foi possível carregar as notícias CMS agora.</p>
        </section>
      `;
    });
}

document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = (window.Utils && window.Utils.resolveApiBase)
    ? window.Utils.resolveApiBase()
    : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || '').replace(/\/+$/, '');

  const instagramRoot = document.querySelector('#instagram-news-root');
  const cmsRoot = document.querySelector('#cms-news-root');

  await renderInstagramFeed(API_BASE, instagramRoot);
  renderCmsNewsFeed(API_BASE, cmsRoot);
});
