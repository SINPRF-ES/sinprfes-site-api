// public/js/noticias-site.js

const INSTAGRAM_PROFILE_URL = 'https://instagram.com/sinprfes';

function escapeHtml(value) {
  return window.Utils?.escapeHTML ? window.Utils.escapeHTML(value || '') : (value || '');
}

function formatDate(value) {
  if (!value) return 'Data não informada';
  return new Date(value).toLocaleDateString('pt-BR');
}

function toPreview(value, maxLength = 180) {
  if (!value) return 'Conteúdo em atualização.';
  const plain = window.InformesRenderer?.renderInformesPlainText
    ? window.InformesRenderer.renderInformesPlainText(value)
    : String(value).replace(/[#*_>`~-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return 'Conteúdo em atualização.';
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain;
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
    <section class="ui-card instagram-news-shell">
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
      .slice(0, 4);

    mountEl.innerHTML = `
      <section class="ui-card instagram-news-shell">
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
      <section class="ui-card instagram-news-shell instagram-fallback">
        <p>Não foi possível carregar as publicações agora. Acesse o perfil oficial:</p>
        <a class="btn-instagram" href="${INSTAGRAM_PROFILE_URL}" target="_blank" rel="noopener noreferrer">Ver no Instagram</a>
      </section>
    `;
  }
}

function buildNewsCard(item) {
  const title = escapeHtml(item.titulo || 'Notícia');
  const subtitle = escapeHtml(item.subtitulo || '');
  const preview = escapeHtml(toPreview(item.conteudo));
  const href = (typeof item.public_ref === 'string' && item.public_ref.length > 0)
    ? `/noticias/${encodeURIComponent(item.public_ref)}`
    : null;
  const image = item.capa_url ? `<img src="${item.capa_url}" alt="${title}" loading="lazy">` : '<div style="height:180px;background:#f1f5f9;border-radius:10px;"></div>';
  return `
    <article class="instagram-card instagram-card-news">
      <a ${href ? `href="${href}"` : ''} aria-label="Abrir notícia: ${title}">
        <div class="instagram-image-wrapper">${image}</div>
        <div class="instagram-card-news__body">
          <p class="instagram-card-caption" style="font-weight:700;">${title}</p>
          ${subtitle ? `<p class="instagram-card-news__meta">${subtitle}</p>` : ''}
          <p class="instagram-card-news__meta">${formatDate(item.published_at || item.data_noticia || item.created_at)}</p>
          <p class="instagram-card-news__meta" style="line-height:1.4;">${preview}</p>
          <span class="instagram-open-cta">${href ? 'Ler matéria completa' : 'Matéria sem link público'}</span>
        </div>
      </a>
    </article>
  `;
}

function buildRecentNewsCard(item) {
  const title = escapeHtml(item.titulo || 'Notícia');
  const preview = escapeHtml(toPreview(item.conteudo, 110));
  const date = formatDate(item.published_at || item.data_noticia || item.created_at);
  const href = (typeof item.public_ref === 'string' && item.public_ref.length > 0)
    ? `/noticias/${encodeURIComponent(item.public_ref)}`
    : null;
  const thumb = item.capa_url
    ? `<img src="${item.capa_url}" alt="${title}" loading="lazy">`
    : '';

  const tag = href ? 'a' : 'article';
  const attrs = href ? `href="${href}"` : '';

  return `
    <${tag} class="home-recent-news-card" ${attrs}>
      <div class="home-recent-news-card__thumb">${thumb}</div>
      <div class="home-recent-news-card__body">
        <span>${date}</span>
        <h4>${title}</h4>
        <p>${preview}</p>
      </div>
    </${tag}>
  `;
}

async function fetchNoticias(API_BASE, statusEditorial, pagina = 1) {
  const query = new URLSearchParams({
    pagina: String(pagina),
    status_editorial: statusEditorial,
    status: 'PUBLICADA'
  });
  const response = await fetch(`${API_BASE}/api/noticias?${query.toString()}`);
  const payload = await response.json();
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    pagination: payload?.pagination || { page: 1, totalPages: 1 }
  };
}

async function renderHomeNews(API_BASE, featuredEl, recentEl) {
  if (!featuredEl || !recentEl) return;

  featuredEl.innerHTML = '<section class="home-featured-news ui-card"><div class="home-featured-news__body"><p class="home-featured-news__empty">Carregando notícia em destaque...</p></div></section>';
  recentEl.innerHTML = '<section class="home-recent-news ui-card"><div class="home-recent-news__header"><h3>Mais recentes</h3></div><p class="home-recent-news__empty">Carregando notícias recentes...</p></section>';

  try {
    const [featuredPayload, archivedPayload] = await Promise.all([
      fetchNoticias(API_BASE, 'ATUAL'),
      fetchNoticias(API_BASE, 'ARQUIVADA')
    ]);

    const featuredItem = featuredPayload.items[0] || archivedPayload.items[0] || null;
    const secondaryItems = [...featuredPayload.items.slice(1), ...archivedPayload.items]
      .filter(Boolean)
      .slice(0, 3);

    if (!featuredItem) {
      featuredEl.innerHTML = '<section class="home-featured-news ui-card"><div class="home-featured-news__body"><p class="home-featured-news__empty">Nenhuma notícia pública disponível no momento.</p></div></section>';
      recentEl.innerHTML = '<section class="home-recent-news ui-card"><div class="home-recent-news__header"><h3>Mais recentes</h3></div><p class="home-recent-news__empty">Novas publicações aparecerão aqui assim que estiverem disponíveis.</p></section>';
      return;
    }

    const title = escapeHtml(featuredItem.titulo || 'Notícia');
    const subtitle = escapeHtml(featuredItem.subtitulo || '');
    const date = formatDate(featuredItem.published_at || featuredItem.data_noticia || featuredItem.created_at);
    const summary = escapeHtml(toPreview(featuredItem.conteudo, 260));
    const href = (typeof featuredItem.public_ref === 'string' && featuredItem.public_ref.length > 0)
      ? `/noticias/${encodeURIComponent(featuredItem.public_ref)}`
      : null;
    const media = featuredItem.capa_url
      ? `<div class="home-featured-news__media"><img src="${featuredItem.capa_url}" alt="${title}" loading="lazy"></div>`
      : '<div class="home-featured-news__media"></div>';

    featuredEl.innerHTML = `
      <article class="home-featured-news ui-card">
        ${media}
        <div class="home-featured-news__body">
          <div class="home-featured-news__meta">
            <span>Destaque principal</span>
            <span>${date}</span>
          </div>
          <h3>${title}</h3>
          ${subtitle ? `<p class="home-featured-news__subtitle">${subtitle}</p>` : ''}
          <p class="home-featured-news__summary">${summary}</p>
          ${href ? `<div class="home-featured-news__actions"><a href="${href}" class="ui-button ui-button-primary">Ler notícia completa</a></div>` : ''}
        </div>
      </article>
    `;

    if (secondaryItems.length === 0) {
      recentEl.innerHTML = `
        <section class="home-recent-news ui-card">
          <div class="home-recent-news__header">
            <h3>Mais recentes</h3>
            <p>As próximas atualizações públicas aparecerão aqui.</p>
          </div>
        </section>
      `;
      return;
    }

    recentEl.innerHTML = `
      <section class="home-recent-news ui-card">
        <div class="home-recent-news__header">
          <h3>Mais recentes</h3>
          <p>Outras publicações para manter a navegação informativa sem sobrecarregar a primeira dobra.</p>
        </div>
        <div class="home-recent-news__list">
          ${secondaryItems.map((item) => buildRecentNewsCard(item)).join('')}
        </div>
      </section>
    `;
  } catch (_error) {
    featuredEl.innerHTML = '<section class="home-featured-news ui-card"><div class="home-featured-news__body"><p class="home-featured-news__empty">Não foi possível carregar o destaque no momento.</p></div></section>';
    recentEl.innerHTML = '<section class="home-recent-news ui-card"><div class="home-recent-news__header"><h3>Mais recentes</h3></div><p class="home-recent-news__empty">Não foi possível carregar as notícias recentes.</p></section>';
  }
}

async function renderNoticiasArquivo(API_BASE, mountEl, pagina = 1) {
  if (!mountEl) return;

  mountEl.innerHTML = '<section class="ui-card"><p style="color:#64748b;">Carregando arquivo de notícias...</p></section>';

  try {
    const { items, pagination } = await fetchNoticias(API_BASE, 'ARQUIVADA', pagina);

    if (items.length === 0) {
      mountEl.innerHTML = '<section class="ui-card"><p>Nenhuma notícia arquivada até o momento.</p></section>';
      return;
    }

    let paginationHtml = '';
    if (pagination.totalPages > 1) {
      paginationHtml = `
        <div class="cms-pagination" style="display:flex; justify-content:center; gap:8px; margin-top:24px;">
          ${Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => `
            <button class="ui-button ui-button-sm ${p === pagination.page ? 'ui-button-secondary' : 'ui-button-outline'}"
                    onclick="window.renderNoticiasArquivo('${API_BASE}', document.querySelector('#cms-news-root'), ${p})"
                    ${p === pagination.page ? 'disabled' : ''}>
              ${p}
            </button>
          `).join('')}
        </div>
      `;
    }

    mountEl.innerHTML = `
      <section class="ui-card">
        <header class="instagram-news-header instagram-news-header--centered">
          <h2 class="section-title"><span class="emoji">🗂️</span><span>Arquivo de notícias</span></h2>
        </header>
        <div class="instagram-news-grid">
          ${items.map((item) => buildNewsCard(item)).join('')}
        </div>
        ${paginationHtml}
      </section>
    `;
  } catch (_error) {
    mountEl.innerHTML = '<section class="ui-card instagram-fallback"><p>Não foi possível carregar o arquivo de notícias.</p></section>';
  }
}

window.renderNoticiasArquivo = renderNoticiasArquivo;

document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = (window.Utils && window.Utils.resolveApiBase)
    ? window.Utils.resolveApiBase()
    : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || '').replace(/\/+$/, '');

  const page = (document.body?.dataset?.newsPage || '').trim().toLowerCase();

  if (page === 'home') {
    await renderHomeNews(
      API_BASE,
      document.querySelector('#home-featured-news-root'),
      document.querySelector('#home-recent-news-root')
    );
    await renderInstagramFeed(API_BASE, document.querySelector('#instagram-news-root'));
    return;
  }

  if (page === 'noticias') {
    await renderNoticiasArquivo(API_BASE, document.querySelector('#cms-news-root'));
  }
});
