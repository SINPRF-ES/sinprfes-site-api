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

    const visiblePosts = [...posts]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 5);

    mountEl.innerHTML = `
      <section class="ui-card">
        <header class="instagram-news-header instagram-news-header--centered">
          <h2 class="section-title"><span class="emoji">📸</span><span>Instagram oficial</span></h2>
        </header>
        <div class="instagram-news-grid">
          ${visiblePosts.map((post) => buildInstagramCard(post)).join('')}
        </div>
        <div class="instagram-more">
          <a href="${payload.profileUrl || INSTAGRAM_PROFILE_URL}" target="_blank" rel="noopener noreferrer" class="ui-button ui-button-outline">Ver perfil oficial</a>
        </div>
      </section>
    `;
  } catch (error) {
    mountEl.innerHTML = `
      <section class="ui-card instagram-fallback">
        <p>Não foi possível carregar as publicações agora. Acesse o perfil oficial:</p>
        <a class="btn-instagram" href="${INSTAGRAM_PROFILE_URL}" target="_blank" rel="noopener noreferrer">Ver no Instagram</a>
      </section>
    `;
  }
}

function toPreview(value) {
  if (!value) return 'Conteúdo em atualização.';
  const plain = window.InformesRenderer?.renderInformesPlainText
    ? window.InformesRenderer.renderInformesPlainText(value)
    : String(value).replace(/[#*_>`~-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return 'Conteúdo em atualização.';
  return plain.length > 180 ? `${plain.slice(0, 180)}…` : plain;
}

function buildNewsCard(item) {
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
}

async function fetchNoticias(API_BASE, statusEditorial) {
  const response = await fetch(`${API_BASE}/api/noticias?pagina=1&status_editorial=${encodeURIComponent(statusEditorial)}`);
  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.filter((item) => typeof item.public_ref === 'string' && item.public_ref.length > 0);
}

async function renderHomeCurrentNews(API_BASE, mountEl) {
  if (!mountEl) return;

  mountEl.innerHTML = '<section class="ui-card"><p style="color:#64748b;">Carregando notícia em destaque...</p></section>';

  try {
    const items = await fetchNoticias(API_BASE, 'ATUAL');
    if (items.length === 0) {
      mountEl.innerHTML = '<section class="ui-card"><h2>📰 Notícia em destaque</h2><p>Nenhuma notícia pública em destaque no momento.</p></section>';
      return;
    }

    mountEl.innerHTML = `
      <section class="ui-card">
        <header class="instagram-news-header instagram-news-header--centered">
          <h2 class="section-title"><span class="emoji">📰</span><span>Notícia em destaque</span></h2>
        </header>
        <div class="instagram-news-grid">
          ${buildNewsCard(items[0])}
        </div>
      </section>
    `;
  } catch (_error) {
    mountEl.innerHTML = '<section class="ui-card instagram-fallback"><p>Não foi possível carregar a notícia em destaque.</p></section>';
  }
}

async function renderNoticiasArquivo(API_BASE, mountEl) {
  if (!mountEl) return;

  mountEl.innerHTML = '<section class="ui-card"><p style="color:#64748b;">Carregando arquivo de notícias...</p></section>';

  try {
    const items = await fetchNoticias(API_BASE, 'ARQUIVADA');

    if (items.length === 0) {
      mountEl.innerHTML = '<section class="ui-card"><p>Nenhuma notícia arquivada até o momento.</p></section>';
      return;
    }

    mountEl.innerHTML = `
      <section class="ui-card">
        <header class="instagram-news-header instagram-news-header--centered">
          <h2 class="section-title"><span class="emoji">🗂️</span><span>Arquivo de notícias</span></h2>
        </header>
        <div class="instagram-news-grid">
          ${items.map((item) => buildNewsCard(item)).join('')}
        </div>
      </section>
    `;
  } catch (_error) {
    mountEl.innerHTML = '<section class="ui-card instagram-fallback"><p>Não foi possível carregar o arquivo de notícias.</p></section>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = (window.Utils && window.Utils.resolveApiBase)
    ? window.Utils.resolveApiBase()
    : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || '').replace(/\/+$/, '');

  const page = (document.body?.dataset?.newsPage || '').trim().toLowerCase();

  if (page === 'home') {
    await renderHomeCurrentNews(API_BASE, document.querySelector('#cms-news-root'));
    await renderInstagramFeed(API_BASE, document.querySelector('#instagram-news-root'));
    return;
  }

  if (page === 'noticias') {
    await renderNoticiasArquivo(API_BASE, document.querySelector('#cms-news-root'));
  }
});
