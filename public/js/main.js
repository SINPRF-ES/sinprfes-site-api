// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  const headerEl = document.getElementById('site-header');
  const footerEl = document.getElementById('site-footer');

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  // Mapeia qual link deve ficar ativo
  function isActive(page) {
    if (currentPath === '' && page === 'index.html') return 'active';
    return currentPath === page ? 'active' : '';
  }

  // HEADER
  if (headerEl) {
    headerEl.innerHTML = `
      <header class="site-header">
        <div class="container header-content">
          <div class="logo-area">
            <a href="/index.html" class="logo-link">
              <img src="/img/placeholder-sinprf.png" alt="SINPRF-ES" class="logo-img">
              <span class="logo-text">
                SINPRF-ES<br>
                <small>Sindicato dos Policiais Rodoviários Federais no ES</small>
              </span>
            </a>
          </div>

          <nav class="main-nav">
            <a href="/index.html" class="${isActive('index.html')}">Início</a>
            <a href="/diretoria.html" class="${isActive('diretoria.html')}">Diretoria</a>
            <a href="/estatuto.html" class="${isActive('estatuto.html')}">Estatuto</a>
            <a href="/noticias.html" class="${isActive('noticias.html')}">Notícias</a>
            <a href="/contato.html" class="${isActive('contato.html')}">Contato</a>
          </nav>

          <div class="header-actions">
            <a href="/filiese.html" class="btn btn-outline">Filie-se</a>
            <a href="/acesso.html" class="btn btn-primary">Área restrita</a>
          </div>
        </div>
      </header>
    `;
  }

  // FOOTER
  if (footerEl) {
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
