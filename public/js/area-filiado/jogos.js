/**
 * Módulo Jogos (Área do Filiado)
 * Carregado como script clássico (window.Jogos)
 */

(function (global) {
    if (global.JogosLoaded) return;
    global.JogosLoaded = true;

    async function inicializarJogos(perfil) {
        const sec = document.getElementById("sec-jogos");
        if (!sec) return;

        sec.innerHTML = `
            <div class="section-card">
                <h2>🏆 Jogos 2026</h2>
                <p>Inscrições e informações sobre os jogos esportivos.</p>
                <form id="form-jogos">
                    <button type="submit" class="btn btn-primary">Inscrever-se</button>
                </form>
            </div>
        `;
    }

    global.Jogos = {
        inicializarJogos
    };

})(typeof window !== 'undefined' ? window : global);
