/**
 * Módulo Navegação (Página Inicial)
 * Carregado como script clássico (window.Navegacao)
 */

(function (global) {
  if (global.Navegacao) return;

  function configurarNavegacao(callbackMudanca) {
    const navButtons = document.querySelectorAll(".af-nav-item");

    function atualizarTitulo(btn) {
      const label = btn.textContent.trim();
      if (label) {
        document.title = `${label} - SINPRF/ES`;
      }
    }
    const sections = document.querySelectorAll(".af-section");
    const debugNotif = localStorage.getItem("DEBUG_NOTIF") === "1";

    const trace = (action, details = {}) => {
      if (!debugNotif) return;
      console.log("[DEBUG_NOTIF][Navegacao]", {
        when: new Date().toISOString(),
        action,
        ...details,
        stack: new Error().stack,
      });
    };

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
          trace("toggle-section", {
            alvo,
            secao: s.id,
            nextDisplay: ativo ? "block" : "none",
            nextActive: ativo,
          });
          s.classList.toggle("active", ativo);
          s.style.display = ativo ? "block" : "none";
        });

        trace("nav-click", {
          alvo,
          botaoAtivo: btn.id,
          secoesTotal: sections.length,
        });

        // Atualiza o título da página com emoji e label do botão
        atualizarTitulo(btn);

        if (callbackMudanca) callbackMudanca(alvo);
      });
    });

    // Atualiza o título inicial baseado na aba ativa
    const btnAtivo = document.querySelector(".af-nav-item.active");
    if (btnAtivo) {
      atualizarTitulo(btnAtivo);
    }
  }

  global.Navegacao = {
    configurarNavegacao
  };

})(typeof window !== "undefined" ? window : global);
