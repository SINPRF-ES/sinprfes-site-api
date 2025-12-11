export function configurarNavegacao(callbackMudanca) {
    const navButtons = document.querySelectorAll(".af-nav-item");
    const sections = document.querySelectorAll(".af-section");

    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const alvo = btn.dataset.target;
            
            navButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            sections.forEach(s => {
                const ativo = s.id === alvo;
                s.classList.toggle("active", ativo);
                // Ajuste para garantir que o display: none/block funcione
                s.style.display = ativo ? 'block' : 'none'; 
            });

            if (callbackMudanca) callbackMudanca(alvo);
        });
    });
}