// public/js/noticias-site.js

const INSTAGRAM_PROFILE_URL = 'https://instagram.com/sinprfes';

function escapeHtml(value) {
  return window.Utils?.escapeHTML ? window.Utils.escapeHTML(value || '') : (value || '');
}

function formatDate(value) {
  if (!value) return 'Data não informada';
  return new Date(value).toLocaleDateString('pt-BR');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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
      .slice(0, 5);

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

async function fetchNoticiasPublicas(API_BASE, pagina = 1) {
  const query = new URLSearchParams({
    pagina: String(pagina),
    status: 'PUBLICADA'
  });
  const response = await fetch(`${API_BASE}/api/noticias?${query.toString()}`);
  const payload = await response.json();
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    pagination: payload?.pagination || { page: 1, totalPages: 1 }
  };
}

async function fetchTodasNoticiasPublicas(API_BASE) {
  const all = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { items, pagination } = await fetchNoticiasPublicas(API_BASE, page);
    all.push(...items);
    totalPages = Number(pagination?.totalPages || 1);
    page += 1;
  } while (page <= totalPages);

  return all;
}

async function renderNoticiasResumo(API_BASE, mountEl) {
  if (!mountEl) return;

  mountEl.innerHTML = '<section class="ui-card"><p style="color:#64748b;">Carregando notícias e Instagram...</p></section>';

  try {
    const [noticias, instagramResponse] = await Promise.all([
      fetchTodasNoticiasPublicas(API_BASE),
      fetch(`${API_BASE}/api/public/instagram-feed`).then((res) => res.json()).catch(() => ({ ok: false, posts: [] }))
    ]);

    const noticiasOrdenadas = [...noticias].sort(
      (a, b) => new Date(b.published_at || b.data_noticia || b.created_at || 0).getTime()
        - new Date(a.published_at || a.data_noticia || a.created_at || 0).getTime()
    );
    const instagramOrdenado = [...(Array.isArray(instagramResponse?.posts) ? instagramResponse.posts : [])].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );

    const noticiaAtual = noticiasOrdenadas[0] || null;
    const noticiasAnteriores = noticiasOrdenadas.slice(1);
    const instagramTop5 = instagramOrdenado.slice(0, 5);
    const instagramAnteriores = instagramOrdenado.slice(5);

    const latestNewsHtml = noticiaAtual
      ? `
        <article class="home-featured-news ui-card" style="margin-bottom:16px;">
          ${noticiaAtual.capa_url ? `<div class="home-featured-news__media"><img src="${noticiaAtual.capa_url}" alt="${escapeHtml(noticiaAtual.titulo || 'Notícia')}" loading="lazy"></div>` : '<div class="home-featured-news__media"></div>'}
          <div class="home-featured-news__body">
            <div class="home-featured-news__meta">
              <span>Notícia mais recente</span>
              <span>${formatDate(noticiaAtual.published_at || noticiaAtual.data_noticia || noticiaAtual.created_at)}</span>
            </div>
            <h3>${escapeHtml(noticiaAtual.titulo || 'Notícia')}</h3>
            <p class="home-featured-news__summary">${escapeHtml(toPreview(noticiaAtual.conteudo, 240))}</p>
            ${(typeof noticiaAtual.public_ref === 'string' && noticiaAtual.public_ref.length > 0)
              ? `<div class="home-featured-news__actions"><a class="ui-button ui-button-primary" href="/noticias/${encodeURIComponent(noticiaAtual.public_ref)}">Ler notícia completa</a></div>`
              : ''}
          </div>
        </article>
      `
      : '<section class="ui-card"><p class="home-featured-news__empty">Nenhuma notícia pública disponível.</p></section>';

    mountEl.innerHTML = `
      <section class="ui-card news-summary-card">
        <header class="instagram-news-header instagram-news-header--centered">
          <h2 class="section-title"><span class="emoji">📰</span><span>Destaques públicos</span></h2>
        </header>
        ${latestNewsHtml}
        <div class="ui-card instagram-news-shell">
          <header class="instagram-news-header instagram-news-header--centered">
            <h2 class="section-title"><span class="emoji">📸</span><span>Instagram oficial (5 últimos)</span></h2>
          </header>
          <div class="instagram-news-grid">
            ${instagramTop5.map((post) => buildInstagramCard(post)).join('')}
          </div>
        </div>
        <div class="news-summary-toolbar" style="margin-top:16px;">
          <input id="archive-search" type="search" placeholder="Buscar no histórico (título/conteúdo)..." />
          <select id="archive-source" aria-label="Filtrar histórico">
            <option value="noticias">Histórico de notícias</option>
            <option value="instagram">Histórico do Instagram</option>
          </select>
        </div>
        <p id="archive-count" class="news-summary-count"></p>
        <div id="archive-list" class="news-summary-list"></div>
        <div id="archive-pagination" class="cms-pagination" style="display:flex;justify-content:center;gap:8px;margin-top:12px;"></div>
      </section>
    `;

    const archiveSearch = mountEl.querySelector('#archive-search');
    const archiveSource = mountEl.querySelector('#archive-source');
    const archiveCount = mountEl.querySelector('#archive-count');
    const archiveList = mountEl.querySelector('#archive-list');
    const archivePagination = mountEl.querySelector('#archive-pagination');
    const perPage = 20;
    let currentPage = 1;

    function toArchiveItemNews(item) {
      const title = item.titulo || 'Notícia';
      const preview = toPreview(item.conteudo, 120);
      const date = item.published_at || item.data_noticia || item.created_at;
      const href = (typeof item.public_ref === 'string' && item.public_ref.length > 0)
        ? `/noticias/${encodeURIComponent(item.public_ref)}`
        : '/noticias.html';
      return { title, preview, date, href, external: false };
    }

    function toArchiveItemInstagram(post) {
      const title = post.title || 'Post no Instagram';
      const preview = title.length > 120 ? `${title.slice(0, 120)}…` : title;
      return { title, preview, date: post.date, href: post.link || INSTAGRAM_PROFILE_URL, external: true };
    }

    function renderArchive() {
      const term = normalizeText(archiveSearch?.value || '');
      const source = archiveSource?.value || 'noticias';
      const base = source === 'instagram'
        ? instagramAnteriores.map(toArchiveItemInstagram)
        : noticiasAnteriores.map(toArchiveItemNews);

      const filtered = base.filter((item) => normalizeText(`${item.title} ${item.preview}`).includes(term));
      const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * perPage;
      const currentItems = filtered.slice(start, start + perPage);

      archiveCount.textContent = `${filtered.length} resultado(s) • página ${currentPage} de ${totalPages}`;

      if (currentItems.length === 0) {
        archiveList.innerHTML = '<p class="home-featured-news__empty">Nenhum item no histórico com os filtros atuais.</p>';
      } else {
        archiveList.innerHTML = currentItems.map((item) => `
          <a href="${item.href}" class="news-summary-item" ${item.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>
            <span class="news-summary-item__meta">${source === 'instagram' ? 'Instagram' : 'Notícias'} • ${formatDate(item.date)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.preview)}</small>
          </a>
        `).join('');
      }

      archivePagination.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1)
        .slice(Math.max(0, currentPage - 3), currentPage + 2)
        .map((pageNum) => `
          <button class="ui-button ui-button-sm ${pageNum === currentPage ? 'ui-button-secondary' : 'ui-button-outline'}" ${pageNum === currentPage ? 'disabled' : ''} data-archive-page="${pageNum}">
            ${pageNum}
          </button>
        `).join('');

      archivePagination.querySelectorAll('[data-archive-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentPage = Number(btn.getAttribute('data-archive-page') || '1');
          renderArchive();
        });
      });
    }

    if (archiveSearch) archiveSearch.addEventListener('input', () => {
      currentPage = 1;
      renderArchive();
    });
    if (archiveSource) archiveSource.addEventListener('change', () => {
      currentPage = 1;
      renderArchive();
    });

    renderArchive();
  } catch (_error) {
    mountEl.innerHTML = '<section class="ui-card instagram-fallback"><p>Não foi possível carregar o sumário geral no momento.</p></section>';
  }
}

async function renderHomeNews(API_BASE, featuredEl) {
  if (!featuredEl) return;

  featuredEl.innerHTML = '<section class="home-featured-news ui-card"><div class="home-featured-news__body"><p class="home-featured-news__empty">Carregando notícia em destaque...</p></div></section>';

  try {
    const [featuredPayload, archivedPayload] = await Promise.all([
      fetchNoticias(API_BASE, 'ATUAL'),
      fetchNoticias(API_BASE, 'ARQUIVADA')
    ]);

    const featuredItem = featuredPayload.items[0] || archivedPayload.items[0] || null;

    if (!featuredItem) {
      featuredEl.innerHTML = '<section class="home-featured-news ui-card"><div class="home-featured-news__body"><p class="home-featured-news__empty">Nenhuma notícia pública disponível no momento.</p></div></section>';
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

  } catch (_error) {
    featuredEl.innerHTML = '<section class="home-featured-news ui-card"><div class="home-featured-news__body"><p class="home-featured-news__empty">Não foi possível carregar o destaque no momento.</p></div></section>';
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
      document.querySelector('#home-featured-news-root')
    );
    await renderInstagramFeed(API_BASE, document.querySelector('#instagram-news-root'));
    return;
  }

  if (page === 'noticias') {
    await renderNoticiasResumo(API_BASE, document.querySelector('#news-summary-root'));
    const archiveMount = document.querySelector('#cms-news-root');
    if (archiveMount) archiveMount.innerHTML = '';
  }
});
