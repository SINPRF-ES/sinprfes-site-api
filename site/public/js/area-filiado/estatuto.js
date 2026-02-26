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
            const html = heading.innerHTML;
            let label = "";
            let title = "";

            if (html.includes('<br>')) {
                const parts = html.split('<br>');
                label = parts[0].trim().replace(/<[^>]+>/g, '');
                title = parts.slice(1).join(' ').trim().replace(/<[^>]+>/g, '');
            } else {
                title = heading.textContent?.trim() || `Seção ${idx + 1}`;
            }

            let id = heading.id || slugify(title) || `secao-${idx + 1}`;
            while (used.has(id)) id = `${id}-${idx + 1}`;
            used.add(id);
            heading.id = id;
            heading.style.scrollMarginTop = '12px';
            return { id, label, title, level: heading.tagName.toLowerCase() };
        });

        const toc = document.createElement('nav');
        toc.className = 'estatuto-toc';
        toc.setAttribute('aria-label', 'Sumário do estatuto');
        toc.innerHTML = `<div class="estatuto-toc-header">📚 Sumário</div><ol class="estatuto-toc-list"></ol>`;
        const list = toc.querySelector('.estatuto-toc-list');

        list.innerHTML = items.map(item => (
            `<li class="toc-item level-${item.level}">
                <a href="#${item.id}">
                    ${item.label ? `<span class="toc-label">${item.label}</span><span class="toc-separator"> – </span>` : ''}
                    <span class="toc-text">${item.title}</span>
                </a>
            </li>`
        )).join('');

        const body = document.createElement('div');
        body.className = 'estatuto-body';
        body.innerHTML = container.innerHTML;

        const topLink = document.createElement('a');
        topLink.href = '#';
        topLink.className = 'estatuto-top-link';
        topLink.textContent = '↑ Voltar ao sumário';

        const wrapper = document.createElement('div');
        wrapper.className = 'estatuto-layout';
        wrapper.appendChild(toc);

        const article = document.createElement('div');
        article.className = 'estatuto-article';
        article.appendChild(topLink);
        article.appendChild(body);
        wrapper.appendChild(article);

        container.innerHTML = '';
        container.appendChild(wrapper);

        wrapper.addEventListener('click', (event) => {
            const link = event.target.closest('a[href^="#"]');
            if (!link) return;
            event.preventDefault();

            if (link.classList.contains('estatuto-top-link')) {
                toc.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }

            const target = wrapper.querySelector(link.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
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
