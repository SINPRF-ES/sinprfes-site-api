// public/js/main.js

document.addEventListener("DOMContentLoaded", () => {
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");

  // Descobre qual página estamos (ex.: "index.html", "diretoria.html", etc.)
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  function isActive(page) {
    if (currentPath === "" && page === "index.html") return "active";
    return currentPath === page ? "active" : "";
  }

  // Check for embed mode (app)
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1" ||
                  new URLSearchParams(window.location.search).get("app") === "1";

  if (isEmbed) {
    document.documentElement.classList.add("is-embed");
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
            <a href="/index.html" class="logo-link">
              <img src="/img/placeholder-fenaprf.png" alt="FENAPRF" class="logo-img">
              <span class="logo-text">
                FENAPRF
              </span>
            </a>
          </div>

          <nav class="main-nav">
            <a href="/index.html" class="${isActive("index.html")}">Início</a>
            <a href="/diretoria.html" class="${isActive("diretoria.html")}">Diretoria</a>
            <a href="/estatuto.html" class="${isActive("estatuto.html")}">Estatuto</a>
            <a href="/contato.html" class="${isActive("contato.html")}">Contato</a>
          </nav>

          <div class="header-actions">
            <!-- 🔽 aqui é a mudança: agora aponta direto para a Página Inicial -->
            <a href="/area-user.html" class="btn btn-primary">Página Inicial</a>
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
          <p>&copy; ${ano} FENAPRF.</p>
          <p class="footer-small">
            Desenvolvido para uso institucional. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    `;
  }
});
