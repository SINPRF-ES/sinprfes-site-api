// public/js/noticias-site.js

async function renderCmsNewsBlocks(API_BASE, mountEl) {
  if (!mountEl || !API_BASE) return;
  try {
    const response = await fetch(`${API_BASE}/api/content-blocks?page=noticias`);
    if (!response.ok) return;
    const blocks = await response.json();
    if (!Array.isArray(blocks) || blocks.length === 0) return;

    mountEl.innerHTML = blocks.map((block) => {
      const title = window.Utils?.escapeHTML ? window.Utils.escapeHTML(block.title || '') : (block.title || '');
      const media = block.media_url
        ? (block.media_type === 'video'
          ? `<video controls style="width:100%; border-radius:8px; margin-bottom:12px;"><source src="${block.media_url}" /></video>`
          : `<img src="${block.media_url}" alt="${title}" style="width:100%; max-height:380px; object-fit:cover; border-radius:8px; margin-bottom:12px;" />`)
        : '';
      return `<section class="ui-card" style="margin-bottom: var(--ui-space-4);">${title ? `<h2 style="margin-bottom:10px;">${title}</h2>` : ''}${media}${block.body ? `<div>${block.body}</div>` : ''}</section>`;
    }).join('');
  } catch (err) {
    console.warn('Falha ao carregar blocos de notícias do CMS:', err);
  }
}

function renderPaginacao(newsContainer, paginaAtual, totalPaginas, onIrParaPagina) {
  if (totalPaginas <= 1) return;

  const bloco = document.createElement('section');
  bloco.className = 'ui-card';
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
  const safeEscape = (v) => (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : '';

  noticias.forEach(noticia => {
    const article = document.createElement('article');
    article.className = 'news-item ui-card';
    article.style.marginBottom = 'var(--ui-space-5)';
    article.style.background = '#ffffff';
    article.style.color = '#1f2937';
    article.id = noticia.id;

    const publishedDate = new Date(noticia.data_noticia || noticia.published_at || noticia.created_at).toLocaleDateString('pt-BR');

    const midias = noticia.midias || [];
    const fotos = midias.filter(m => m.tipo === 'IMAGEM' && m.url !== noticia.capa_url);
    const videos = midias.filter(m => m.tipo === 'VIDEO');

    article.innerHTML = `
      <header class="section-header" style="background:#f8fafc; padding:12px; border-radius:8px;">
        <h2 style="margin-bottom:6px; color:#0f172a;">${safeEscape(noticia.titulo)}</h2>
        ${noticia.subtitulo ? `<p style="margin-bottom:6px; color:#334155;">${safeEscape(noticia.subtitulo)}</p>` : ''}
        <p class="news-meta" style="color:#475569; margin:0;">${publishedDate} · Institucional</p>
      </header>

      <div class="noticia-conteudo">
        ${noticia.capa_url ? `<img src="${safeEscape(noticia.capa_url)}" alt="${safeEscape(noticia.titulo)}" style="width:100%; max-height:400px; object-fit:cover; border-radius:8px; margin-bottom:20px;">` : ''}

        <div class="markdown-body informe-markdown" style="line-height:1.6; margin-bottom:20px; color:#1f2937;"></div>

        ${videos.length > 0 ? `
          <div class="noticia-videos" style="margin-top:20px;">
            ${videos.map(v => `
              <video controls style="width:100%; max-width:600px; border-radius:8px; margin-bottom:10px; background:#000;">
                <source src="${safeEscape(v.url)}" type="video/mp4">
                Seu navegador não suporta o player de vídeo.
              </video>
            `).join('')}
          </div>
        ` : ''}

        ${fotos.length > 0 ? `
          <div class="noticia-galeria" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px; margin-top:20px;">
            ${fotos.map(f => `
              <a href="${safeEscape(f.url)}" target="_blank">
                <img src="${safeEscape(f.url)}" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:8px; cursor:pointer;">
              </a>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    const markdownEl = article.querySelector('.informe-markdown');
    if (window.InformesRenderer?.mountRenderedMarkdown) {
      window.InformesRenderer.mountRenderedMarkdown(markdownEl, noticia.conteudo);
    } else {
      markdownEl.innerHTML = `<p>${safeEscape(noticia.conteudo || '')}</p>`;
    }

    newsContainer.appendChild(article);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = (window.Utils && window.Utils.resolveApiBase)
    ? window.Utils.resolveApiBase()
    : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || '').replace(/\/+$/, '');

  const newsContainer = document.querySelector('.page.container');
  if (!newsContainer) return;

  const h1 = newsContainer.querySelector('h1');
  newsContainer.innerHTML = '';
  if (h1) newsContainer.appendChild(h1);

  const cmsContainer = document.createElement('div');
  cmsContainer.id = 'cms-news-blocks';
  newsContainer.appendChild(cmsContainer);

  await renderCmsNewsBlocks(API_BASE, cmsContainer);

  const loadingEl = document.createElement('p');
  loadingEl.textContent = 'Carregando notícias...';
  newsContainer.appendChild(loadingEl);

  async function carregarPagina(pagina) {
    loadingEl.style.display = '';
    loadingEl.textContent = 'Carregando notícias...';

    Array.from(newsContainer.querySelectorAll('article.news-item, section.ui-card.news-pagination')).forEach(el => el.remove());

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
      emptyEl.textContent = 'Nenhuma notícia encontrada.';
      newsContainer.appendChild(emptyEl);
      return;
    }

    renderNoticiasList(newsContainer, noticias);

    if (pagination.totalPages > 1) {
      const marker = document.createElement('section');
      marker.className = 'ui-card news-pagination';
      marker.style.padding = '0';
      marker.style.border = 'none';
      marker.style.background = 'transparent';
      newsContainer.appendChild(marker);
      marker.remove();
      renderPaginacao(newsContainer, pagination.page, pagination.totalPages, carregarPagina);
      const navCard = newsContainer.lastElementChild;
      if (navCard) navCard.classList.add('news-pagination');
    }
  }

  try {
    await carregarPagina(1);
  } catch (err) {
    loadingEl.textContent = 'Erro ao carregar notícias. Tente novamente mais tarde.';
    console.error(err);
  }
});
