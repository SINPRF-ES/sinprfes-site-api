// public/js/noticias-site.js

const INSTAGRAM_PROFILE_URL = 'https://instagram.com/sinprfes';

function escapeHtml(value) {
  return window.Utils?.escapeHTML ? window.Utils.escapeHTML(value || '') : (value || '');
}

function formatDate(value) {
  if (!value) return 'Data não informada';
  return new Date(value).toLocaleDateString('pt-BR');
}

function setupTabs() {
  const buttons = Array.from(document.querySelectorAll('[data-news-tab]'));
  const panels = {
    instagram: document.querySelector('#news-panel-instagram'),
    cms: document.querySelector('#news-panel-cms'),
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.newsTab;

      buttons.forEach((btn) => {
        const active = btn === button;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        panel.classList.toggle('is-hidden', key !== tab);
      });
    });
  });
}

async function renderInstagramFeed(API_BASE, mountEl) {
  if (!mountEl) return;

  mountEl.innerHTML = `
    <section class="ui-card">
      <header class="instagram-news-header">
        <h2 class="section-title"><span class="emoji">📸</span><span>Instagram oficial</span></h2>
        <span class="news-origin-badge">Origem: Instagram</span>
      </header>
      <p class="section-subtitle">Publicações oficiais do perfil do SINPRF-ES, sem limitação dos 5 últimos posts.</p>
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

    mountEl.innerHTML = `
      <section class="ui-card">
        <header class="instagram-news-header">
          <h2 class="section-title"><span class="emoji">📸</span><span>Instagram oficial</span></h2>
          <span class="news-origin-badge">Origem: Instagram</span>
        </header>
        <p class="section-subtitle">Publicações oficiais do perfil do SINPRF-ES.</p>
        <div class="instagram-news-grid">
          ${posts.map((post) => {
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
          }).join('')}
        </div>
        <div class="instagram-more">
          <a href="${payload.profileUrl || INSTAGRAM_PROFILE_URL}" target="_blank" rel="noopener noreferrer" class="ui-button ui-button-outline">Ver perfil oficial</a>
        </div>
      </section>
    `;
  } catch (error) {
    mountEl.innerHTML = `
      <section class="ui-card instagram-fallback">
        <span class="news-origin-badge">Origem: Instagram</span>
        <p>Não foi possível carregar as publicações agora. Acesse o perfil oficial:</p>
        <a class="btn-instagram" href="${INSTAGRAM_PROFILE_URL}" target="_blank" rel="noopener noreferrer">Ver no Instagram</a>
      </section>
    `;
  }
}

async function renderCmsNewsBlocks(API_BASE, mountEl) {
  if (!mountEl || !API_BASE) return;

  mountEl.innerHTML = '<p>Carregando notícias do CMS...</p>';

  try {
    const response = await fetch(`${API_BASE}/api/content-blocks?page=noticias`);
    if (!response.ok) return;
    const blocks = await response.json();
    if (!Array.isArray(blocks) || blocks.length === 0) return;

    const blocksHtml = blocks.map((block) => {
      const title = escapeHtml(block.title || '');
      const media = block.media_url
        ? (block.media_type === 'video'
          ? `<video controls style="width:100%; border-radius:8px; margin-bottom:12px;"><source src="${block.media_url}" /></video>`
          : `<img src="${block.media_url}" alt="${title}" style="width:100%; max-height:380px; object-fit:cover; border-radius:8px; margin-bottom:12px;" />`)
        : '';
      return `<section class="ui-card" style="margin-bottom: var(--ui-space-4);">${title ? `<h2 style="margin-bottom:10px;">${title}</h2>` : ''}${media}${block.body ? `<div>${block.body}</div>` : ''}</section>`;
    }).join('');

    mountEl.innerHTML = `<div>${blocksHtml}</div>`;
  } catch (err) {
    console.warn('Falha ao carregar blocos de notícias do CMS:', err);
  }
}

function renderPaginacao(newsContainer, paginaAtual, totalPaginas, onIrParaPagina) {
  if (totalPaginas <= 1) return;

  const bloco = document.createElement('section');
  bloco.className = 'ui-card news-pagination';
  bloco.style.marginTop = 'var(--ui-space-4)';
  bloco.style.textAlign = 'center';

  const titulo = document.createElement('p');
  titulo.textContent = 'Confira aqui as notícias antigas';
  titulo.style.marginBottom = '10px';
  titulo.style.color = '#334155';
  bloco.appendChild(titulo);

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Paginação do acervo de notícias');
  nav.style.display = 'flex';
  nav.style.justifyContent = 'center';
  nav.style.gap = '8px';
  nav.style.flexWrap = 'wrap';

  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    const btn = document.createElement('button');
    btn.className = 'ui-button ui-button-outline';
    btn.textContent = String(pagina);
    btn.disabled = pagina === paginaAtual;
    if (pagina === paginaAtual) {
      btn.style.background = 'var(--ui-primary)';
      btn.style.color = '#fff';
    }
    btn.onclick = () => onIrParaPagina(pagina);
    nav.appendChild(btn);
  }

  bloco.appendChild(nav);
  newsContainer.appendChild(bloco);
}

function renderNoticiasList(newsContainer, noticias) {
  noticias.forEach((noticia) => {
    const article = document.createElement('article');
    article.className = 'news-item ui-card';
    article.style.marginBottom = 'var(--ui-space-5)';
    article.style.background = '#ffffff';
    article.style.color = '#1f2937';
    article.id = noticia.id;

    const publishedDate = formatDate(noticia.data_noticia || noticia.published_at || noticia.created_at);

    const midias = noticia.midias || [];
    const fotos = midias.filter((m) => m.tipo === 'IMAGEM' && m.url !== noticia.capa_url);
    const videos = midias.filter((m) => m.tipo === 'VIDEO');

    article.innerHTML = `
      <header class="section-header" style="background:#f8fafc; padding:12px; border-radius:8px;">
        <h2 style="margin-bottom:6px; color:#0f172a;">${escapeHtml(noticia.titulo)}</h2>
        ${noticia.subtitulo ? `<p style="margin-bottom:6px; color:#334155;">${escapeHtml(noticia.subtitulo)}</p>` : ''}
        <p class="news-meta" style="color:#475569; margin:0;">${publishedDate} · Institucional</p>
        <span class="news-origin-badge">Origem: CMS</span>
      </header>

      <div class="noticia-conteudo">
        ${noticia.capa_url ? `<img src="${escapeHtml(noticia.capa_url)}" alt="${escapeHtml(noticia.titulo)}" style="width:100%; max-height:400px; object-fit:cover; border-radius:8px; margin:12px 0 20px;">` : ''}
        <div class="markdown-body informe-markdown" style="line-height:1.6; margin-bottom:20px; color:#1f2937;"></div>
        ${videos.length > 0 ? `<div class="noticia-videos" style="margin-top:20px;">${videos.map((v) => `<video controls style="width:100%; max-width:600px; border-radius:8px; margin-bottom:10px; background:#000;"><source src="${escapeHtml(v.url)}" type="video/mp4">Seu navegador não suporta o player de vídeo.</video>`).join('')}</div>` : ''}
        ${fotos.length > 0 ? `<div class="noticia-galeria" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px; margin-top:20px;">${fotos.map((f) => `<a href="${escapeHtml(f.url)}" target="_blank"><img src="${escapeHtml(f.url)}" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:8px; cursor:pointer;"></a>`).join('')}</div>` : ''}
      </div>
    `;

    const markdownEl = article.querySelector('.informe-markdown');
    if (window.InformesRenderer?.mountRenderedMarkdown) {
      window.InformesRenderer.mountRenderedMarkdown(markdownEl, noticia.conteudo);
    } else {
      markdownEl.innerHTML = `<p>${escapeHtml(noticia.conteudo || '')}</p>`;
    }

    newsContainer.appendChild(article);
  });
}

async function renderCmsNewsFeed(API_BASE, mountEl) {
  if (!mountEl) return;
  mountEl.innerHTML = '';

  const cmsBlocksContainer = document.createElement('div');
  cmsBlocksContainer.id = 'cms-news-blocks';
  mountEl.appendChild(cmsBlocksContainer);
  await renderCmsNewsBlocks(API_BASE, cmsBlocksContainer);

  const loadingEl = document.createElement('p');
  loadingEl.textContent = 'Carregando notícias...';
  mountEl.appendChild(loadingEl);

  async function carregarPagina(pagina) {
    loadingEl.style.display = '';
    loadingEl.textContent = 'Carregando notícias...';
    Array.from(mountEl.querySelectorAll('article.news-item, section.news-pagination, p.news-empty')).forEach((el) => el.remove());

    const response = await fetch(`${API_BASE}/api/noticias?pagina=${pagina}`);

    if (response.status === 401) {
      loadingEl.innerHTML = 'Para ver as notícias, acesse a <a href="/area-filiado.html">Página Inicial</a>.';
      return;
    }

    if (!response.ok) throw new Error('Erro ao carregar notícias');

    const payload = await response.json();
    const noticias = Array.isArray(payload) ? payload : payload.items;
    const pagination = payload.pagination || { page: pagina, totalPages: 1 };

    loadingEl.style.display = 'none';

    if (!noticias || noticias.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.className = 'news-empty';
      emptyEl.textContent = 'Nenhuma notícia encontrada.';
      mountEl.appendChild(emptyEl);
      return;
    }

    renderNoticiasList(mountEl, noticias);
    renderPaginacao(mountEl, pagination.page, pagination.totalPages, carregarPagina);
  }

  try {
    await carregarPagina(1);
  } catch (err) {
    loadingEl.textContent = 'Erro ao carregar notícias. Tente novamente mais tarde.';
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = (window.Utils && window.Utils.resolveApiBase)
    ? window.Utils.resolveApiBase()
    : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || '').replace(/\/+$/, '');

  const instagramRoot = document.querySelector('#instagram-news-root');
  const cmsRoot = document.querySelector('#cms-news-root');

  setupTabs();
  await Promise.all([
    renderInstagramFeed(API_BASE, instagramRoot),
    renderCmsNewsFeed(API_BASE, cmsRoot),
  ]);
});
