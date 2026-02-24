/**
 * Módulo Estatuto (Página Inicial)
 */

(function (global) {
    if (global.EstatutoAF) return;

    async function inicializarEstatuto() {
        const container = document.getElementById("estatuto-conteudo-af");
        if (!container) return;

        try {
            // Fetch the public estatuto.html and extract the document content
            const resp = await fetch("/estatuto.html");
            const html = await resp.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const content = doc.querySelector(".estatuto-documento");

            if (content) {
                // Remove inline scroll-margin-top from the headings since we're in a contained div
                content.querySelectorAll('h2, h3').forEach(h => h.style.scrollMarginTop = '0');
                container.innerHTML = content.innerHTML;
            } else {
                container.innerHTML = "<p>Conteúdo não encontrado.</p>";
            }
        } catch (e) {
            container.innerHTML = "<p>Erro ao carregar o estatuto.</p>";
        }
    }

    global.EstatutoAF = {
        inicializarEstatuto
    };

})(typeof window !== 'undefined' ? window : global);
