/**
 * Módulo Navegação (Página Inicial)
 * Carregado como script clássico (window.Navegacao)
 */

(function (global) {
  if (global.Navegacao) return;

  function configurarNavegacao(callbackMudanca) {
    const navButtons = document.querySelectorAll(".af-nav-item");
    const sections = document.querySelectorAll(".af-section");

    navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const alvo = btn.dataset.target;

        navButtons.forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");

        sections.forEach(s => {
          const ativo = s.id === alvo;
          s.classList.toggle("active", ativo);
          s.style.display = ativo ? "block" : "none";
        });

        if (callbackMudanca) callbackMudanca(alvo);
      });
    });
  }

  global.Navegacao = {
    configurarNavegacao
  };

})(typeof window !== "undefined" ? window : global);
