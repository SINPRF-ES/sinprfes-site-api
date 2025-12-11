// navegacao.js
export function configurarNavegacao(callbackMudanca) {
    const navButtons = document.querySelectorAll(".af-nav-item");
    const sections = document.querySelectorAll(".af-section");

    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const alvo = btn.dataset.target;
            
            // Visual das abas
            navButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Conteúdo
            sections.forEach(s => {
                const ativo = s.id === alvo;
                s.classList.toggle("active", ativo);
                s.setAttribute("aria-hidden", !ativo);
            });

            // Avisa o maestro que mudou
            if (callbackMudanca) callbackMudanca(alvo);
        });
    });
}