// public/js/noticias-site.js

document.addEventListener("DOMContentLoaded", async () => {
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

    const response = await fetch("/api/noticias", { headers });

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
      article.className = "news-item card card-section";
      article.style.marginBottom = "40px";
      article.id = noticia.id;

      const publishedDate = new Date(noticia.published_at || noticia.created_at).toLocaleDateString("pt-BR");

      article.innerHTML = `
        <header class="section-header">
          <h2>${noticia.titulo}</h2>
          <p class="news-meta">${publishedDate} · Institucional</p>
        </header>

        <div class="noticia-conteudo">
          ${noticia.capa_url ? `<img src="${noticia.capa_url}" alt="${noticia.titulo}" style="width:100%; max-height:400px; object-fit:cover; border-radius:8px; margin-bottom:20px;">` : ""}
          <div class="markdown-body" style="white-space: pre-wrap; line-height: 1.6;">${noticia.conteudo}</div>
        </div>
      `;

      newsContainer.appendChild(article);
    });
  } catch (err) {
    loadingEl.textContent = "Erro ao carregar notícias. Tente novamente mais tarde.";
    console.error(err);
  }
});
