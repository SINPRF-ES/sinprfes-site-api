// public_dev/js/main.js

document.addEventListener("DOMContentLoaded", () => {
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");

  // Path resolution for parallel sites (uses PathResolver if available, otherwise fallback)
  const resolvePath = (path) => {
    if (window.PathResolver) return window.PathResolver.resolve(path);
    const isDevPath = window.location.pathname.startsWith('/dev/');
    if (isDevPath && path.startsWith('/') && !path.startsWith('/dev/')) {
      return '/dev' + path;
    }
    return path;
  };

  // Descobre qual página estamos (ex.: "index.html", "diretoria.html", etc.)
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  function isActive(page) {
    if (currentPath === "" && page === "index.html") return "active";
    return currentPath === page ? "active" : "";
  }

  // Helper for navigation in V2
  const navTo = (path) => {
    if (window.PathResolver) return `javascript:PathResolver.navigate('${path}')`;
    return resolvePath(path);
  };

  // Check for embed mode (app)
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1" ||
                  new URLSearchParams(window.location.search).get("app") === "1";

  if (isEmbed) {
    document.body.style.paddingTop = "0";
    if (headerEl) headerEl.style.display = "none";
    if (footerEl) footerEl.style.display = "none";
  }

  // ---------------- HEADER ----------------
  if (headerEl && !isEmbed) {
    headerEl.innerHTML = `
      <header class="site-header">
        <div class="container header-content">
          <div class="logo-area">
            <a href="${navTo("index.html")}" class="logo-link">
              <img src="${resolvePath("/img/brasao.png")}" alt="SINPRF-ES" class="logo-img">
              <div class="logo-text">
                SINPRF-ES<br>
                <small>Sindicato dos Policiais Rodoviários Federais no ES</small>
              </div>
            </a>
          </div>

          <nav class="main-nav">
            <a href="${navTo("index.html")}" class="${isActive("index.html")}">Início</a>
            <a href="${navTo("diretoria.html")}" class="${isActive("diretoria.html")}">Diretoria</a>
            <a href="${navTo("estatuto.html")}" class="${isActive("estatuto.html")}">Estatuto</a>
            <a href="${navTo("noticias.html")}" class="${isActive("noticias.html")}">Notícias</a>
            <a href="${navTo("contato.html")}" class="${isActive("contato.html")}">Contato</a>
          </nav>

          <div class="header-actions">
            <a href="${navTo("filiese.html")}" class="btn btn-outline">Filie-se</a>
            <a href="${navTo("area-filiado.html")}" class="btn btn-primary">Página Inicial</a>
          </div>
        </div>
      </header>
    `;
  }

  // ---------------- FOOTER ----------------
  if (footerEl && !isEmbed) {
    const ano = new Date().getFullYear();
    footerEl.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-content">
          <p>&copy; ${ano} SINPRF-ES – Sindicato dos Policiais Rodoviários Federais no Espírito Santo.</p>
          <p class="footer-small">
            Desenvolvido para uso institucional. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    `;
  }
});
