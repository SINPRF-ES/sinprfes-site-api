function getPublicRefFromLocation() {
  const pathname = window.location.pathname || '';
  const friendlyMatch = pathname.match(/^\/noticias\/([^/?#]+)/);
  if (friendlyMatch && friendlyMatch[1]) return decodeURIComponent(friendlyMatch[1]);

  const queryRef = new URLSearchParams(window.location.search).get('ref');
  return queryRef ? String(queryRef).trim() : '';
}

function escapeHtml(value) {
  if (window.Utils?.escapeHTML) return window.Utils.escapeHTML(value || '');
  return String(value || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNewsDate(value) {
  if (!value) return 'Data não informada';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderNewsMedia(midias, capaUrl) {
  const itens = (midias || []).filter((m) => m && m.url && m.url !== capaUrl);
  if (!itens.length) return '';
  return `
    <section style="margin-top:22px;">
      <h2 style="color:var(--ui-primary); font-size:1.15rem; margin:0 0 12px;">Mídias da matéria</h2>
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px;">
        ${itens.map((m) => (
          m.tipo === 'VIDEO'
            ? `
              <div style="display:flex; flex-direction:column; gap:8px;">
                <video src="${escapeHtml(m.url)}" controls style="width:100%; border-radius:10px; background:#000;"></video>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <a class="ui-button ui-button-outline" href="${escapeHtml(m.url)}" target="_blank" rel="noopener">Ver original</a>
                  <a class="ui-button ui-button-outline" href="${escapeHtml(m.url)}" download>Baixar mídia</a>
                </div>
              </div>
            `
            : `
              <div style="display:flex; flex-direction:column; gap:8px;">
                <img src="${escapeHtml(m.url)}" alt="Mídia da notícia" style="width:100%; border-radius:10px;">
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <a class="ui-button ui-button-outline" href="${escapeHtml(m.url)}" target="_blank" rel="noopener">Ver original</a>
                  <a class="ui-button ui-button-outline" href="${escapeHtml(m.url)}" download>Baixar mídia</a>
                </div>
              </div>
            `
        )).join('')}
      </div>
    </section>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('noticia-detalhe-root');
  if (!root) return;

  const API_BASE = (window.Utils && window.Utils.resolveApiBase)
    ? window.Utils.resolveApiBase()
    : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || '').replace(/\/+$/, '');

  const publicRef = getPublicRefFromLocation();
  if (!publicRef) {
    root.innerHTML = '<h1>Notícia não encontrada</h1><p>O link informado é inválido.</p><p><a class="ui-button ui-button-outline" href="/noticias.html">← Voltar para Notícias</a></p>';
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/noticias/public/${encodeURIComponent(publicRef)}`);
    if (!response.ok) throw new Error('news_not_found');

    const noticia = await response.json();
    document.title = `${noticia.titulo || 'Notícia'} – SINPRF-ES`;

    root.innerHTML = `
      <article>
        <p><a class="ui-button ui-button-outline" href="/noticias.html">← Voltar para Notícias</a></p>
        <h1 style="color:var(--ui-primary); margin-bottom:8px;">${escapeHtml(noticia.titulo || 'Notícia')}</h1>
        <p style="color:#64748b; margin-top:0; margin-bottom:18px;">${formatNewsDate(noticia.published_at || noticia.data_noticia || noticia.created_at)}</p>
        ${noticia.capa_url ? `<img src="${escapeHtml(noticia.capa_url)}" alt="${escapeHtml(noticia.titulo || 'Capa da notícia')}" style="width:100%; border-radius:12px; margin-bottom:18px;">` : ''}
        <div id="noticia-conteudo" style="line-height:1.7; color:#1f2937;"></div>
        ${renderNewsMedia(noticia.midias, noticia.capa_url)}
      </article>
    `;

    const conteudoEl = root.querySelector('#noticia-conteudo');
    if (window.InformesRenderer?.mountRenderedMarkdown) {
      window.InformesRenderer.mountRenderedMarkdown(conteudoEl, noticia.conteudo || '');
    } else {
      conteudoEl.textContent = noticia.conteudo || '';
    }
  } catch (_error) {
    root.innerHTML = `
      <h1>Notícia não encontrada</h1>
      <p>Esta matéria não está disponível publicamente.</p>
      <p><a class="ui-button ui-button-outline" href="/noticias.html">← Voltar para Notícias</a></p>
    `;
  }
});
