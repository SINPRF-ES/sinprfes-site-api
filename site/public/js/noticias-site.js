// public/js/noticias-site.js

document.addEventListener("DOMContentLoaded", async () => {
  const API_BASE = (window.Utils && window.Utils.resolveApiBase)
    ? window.Utils.resolveApiBase()
    : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || "").replace(/\/+$/, "");

  const newsContainer = document.querySelector(".page.container");
  if (!newsContainer) return;

  // Clear static content (except the title)
  const h1 = newsContainer.querySelector("h1");
  newsContainer.innerHTML = "";
  if (h1) newsContainer.appendChild(h1);

  const loadingEl = document.createElement("p");
  loadingEl.textContent = "Carregando notícias...";
  newsContainer.appendChild(loadingEl);

  try {
    // Note: The site usually doesn't have an auth token in the browser
    // unless the user is logged into the internal area.
    // If /api/noticias requires auth, we need to handle that.
    // However, for the public site, maybe news should be public?
    // The requirement says "filtros: status=PUBLICADA por padrão"
    // and "Leitura: qualquer autenticado".
    // Wait, if it's "qualquer autenticado", the public site might not be able to see it
    // unless we make a public route or the user is logged in.

    // Let's check if the user is logged in via localStorage.
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/api/noticias`, { headers });

    if (response.status === 401) {
      loadingEl.innerHTML = `Para ver as notícias, acesse a <a href="/area-filiado.html">Página Inicial</a>.`;
      return;
    }

    if (!response.ok) throw new Error("Erro ao carregar notícias");
    const noticias = await response.json();

    loadingEl.remove();

    if (noticias.length === 0) {
      const emptyEl = document.createElement("p");
      emptyEl.textContent = "Nenhuma notícia encontrada.";
      newsContainer.appendChild(emptyEl);
      return;
    }

    noticias.forEach(noticia => {
      const article = document.createElement("article");
      article.className = "news-item ui-card";
      article.style.marginBottom = "var(--ui-space-5)";
      article.id = noticia.id;

      const publishedDate = new Date(noticia.published_at || noticia.created_at).toLocaleDateString("pt-BR");

      const midias = noticia.midias || [];
      const fotos = midias.filter(m => m.tipo === 'IMAGEM' && m.url !== noticia.capa_url);
      const videos = midias.filter(m => m.tipo === 'VIDEO');

      // Proteção XSS: Failsafe (vazio) se utilitário ausente
      const safeEscape = (v) => (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : "";

      article.innerHTML = `
        <header class="section-header">
          <h2>${safeEscape(noticia.titulo)}</h2>
          <p class="news-meta">${publishedDate} · Institucional</p>
        </header>

        <div class="noticia-conteudo">
          ${noticia.capa_url ? `<img src="${safeEscape(noticia.capa_url)}" alt="${safeEscape(noticia.titulo)}" style="width:100%; max-height:400px; object-fit:cover; border-radius:8px; margin-bottom:20px;">` : ""}

          <div class="markdown-body" style="white-space: pre-wrap; line-height: 1.6; margin-bottom:20px;">${safeEscape(noticia.conteudo)}</div>

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

      newsContainer.appendChild(article);
    });
  } catch (err) {
    loadingEl.textContent = "Erro ao carregar notícias. Tente novamente mais tarde.";
    console.error(err);
  }
});
