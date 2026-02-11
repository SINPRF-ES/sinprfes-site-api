// public/js/main.js

document.addEventListener("DOMContentLoaded", () => {
  const headerEl = document.getElementById("site-header");
  const footerEl = document.getElementById("site-footer");

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
            <a href="/login.html" class="logo-link">
              <img src="/img/logo-fenaprf.png" alt="FENAPRF" class="logo-img">
              <span class="logo-text">
                FENAPRF
              </span>
            </a>
          </div>

          <div class="header-actions">
            <a href="/login.html" class="btn btn-primary">Área Restrita</a>
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
            Acesso exclusivo para membros.
          </p>
        </div>
      </footer>
    `;
  }
});
