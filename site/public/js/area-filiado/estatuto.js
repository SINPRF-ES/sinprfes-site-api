/**
 * Módulo Estatuto (Página Inicial)
 */

(function (global) {
    if (global.EstatutoAF) return;

    function slugify(value) {
        return String(value || "")
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    function montarToc(container) {
        const headings = Array.from(container.querySelectorAll('h2, h3'));
        if (!headings.length) return;

        const used = new Set();
        const items = headings.map((heading, idx) => {
            const text = heading.textContent?.trim() || `Seção ${idx + 1}`;
            let id = heading.id || slugify(text) || `secao-${idx + 1}`;
            while (used.has(id)) id = `${id}-${idx + 1}`;
            used.add(id);
            heading.id = id;
            heading.style.scrollMarginTop = '12px';
            return { id, text, level: heading.tagName.toLowerCase() };
        });

        const toc = document.createElement('details');
        toc.className = 'estatuto-toc';
        toc.open = true;
        toc.innerHTML = `<summary>📚 Sumário</summary><ol class="estatuto-toc-list"></ol>`;
        const list = toc.querySelector('.estatuto-toc-list');

        list.innerHTML = items.map(item => (
            `<li style="margin-left:${item.level === 'h3' ? '16px' : '0'}"><a href="#${item.id}">${item.text}</a></li>`
        )).join('');

        toc.addEventListener('click', (event) => {
            const link = event.target.closest('a[href^="#"]');
            if (!link) return;
            event.preventDefault();
            const target = container.querySelector(link.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        container.prepend(toc);
    }

    async function inicializarEstatuto() {
        const container = document.getElementById("estatuto-conteudo-af");
        if (!container) return;

        try {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:#555;">Carregando estatuto...</p>';
            const resp = await fetch("/estatuto.html");
            const html = await resp.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const content = doc.querySelector(".estatuto-documento");

            if (content) {
                container.innerHTML = content.innerHTML;
                montarToc(container);
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
