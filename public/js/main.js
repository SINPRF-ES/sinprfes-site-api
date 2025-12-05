document.addEventListener("DOMContentLoaded", function () {
  // Monta o HEADER dinâmico
  var headerContainer = document.getElementById("site-header");
  if (headerContainer) {
    headerContainer.innerHTML = `
      <div class="topbar">
        Portal oficial do <strong>SINPRF-ES</strong> em construção. Em breve, mais serviços ao filiado.
      </div>

      <div class="container">
        <header>
          <div class="header-inner">
            <div class="brand">
              <div class="brand-logo">
                <img src="/img/placeholder-sinprf.png" alt="Logomarca provisória do SINPRF-ES">
              </div>
              <div class="brand-text">
                <h1><span>SINPRF</span>-ES</h1>
                <p>Sindicato dos Policiais Rodoviários Federais no Espírito Santo</p>
              </div>
            </div>

            <nav>
              <a href="/" class="nav-link" data-nav="inicio">Início</a>
              <a href="/diretoria.html" class="nav-link" data-nav="diretoria">Diretoria</a>
              <a href="/noticias.html" class="nav-link" data-nav="noticias">Notícias</a>
              <a href="/estatuto.html" class="nav-link" data-nav="estatuto">Estatuto</a>
              <a href="/filiados.html" class="nav-link" data-nav="filiados">Filiados</a>
              <a href="/contato.html" class="nav-link nav-cta" data-nav="contato">Fale conosco</a>
            </nav>
          </div>
        </header>
      </div>
    `;
  }

  // Monta o FOOTER dinâmico
  var footerContainer = document.getElementById("site-footer");
  if (footerContainer) {
    footerContainer.innerHTML = `
      <div class="container">
        <footer>
          © <span id="ano-atual"></span> SINPRF-ES — Sindicato dos Policiais Rodoviários Federais no Espírito Santo.
          Portal em desenvolvimento. Conteúdos sujeitos a ajustes.
        </footer>
      </div>
    `;
  }

  // Atualiza ano no rodapé
  var spanAno = document.getElementById("ano-atual");
  if (spanAno) {
    spanAno.textContent = new Date().getFullYear();
  }

  // Destacar item de menu da página atual
  var path = window.location.pathname || "/";
  var activeKey = "inicio";

  if (path.includes("diretoria")) activeKey = "diretoria";
  else if (path.includes("noticias")) activeKey = "noticias";
  else if (path.includes("estatuto")) activeKey = "estatuto";
  else if (path.includes("filiados")) activeKey = "filiados";
  else if (path.includes("contato")) activeKey = "contato";

  var links = document.querySelectorAll("nav a.nav-link");
  links.forEach(function (link) {
    if (link.dataset.nav === activeKey) {
      link.classList.add("nav-link-active");
    }
  });
});
