// public/js/cms.js
(function() {
    const CMS = {
        async loadPage(pageName) {
            try {
                const response = await fetch(`/api/content-blocks?page=${pageName}`);
                if (!response.ok) {
                    console.error('CMS API Error:', response.status);
                    return; // Fail silently, layout should remain stable
                }
                const blocks = await response.json();
                if (!Array.isArray(blocks)) throw new Error('Invalid CMS data format');
                this.render(blocks);
            } catch (err) {
                console.error('CMS Load Error:', err);
                // Layout stays as is (empty container or default)
            }
        },

        render(blocks) {
            if (!Array.isArray(blocks)) return;
            const container = document.getElementById('content-blocks');
            const heroTitle = document.getElementById('hero-title');
            const heroBody = document.getElementById('hero-body');
            const heroSection = document.getElementById('cms-hero');

            if (!container) return;

            // Limpa container (exceto se houver algo fixo)
            container.innerHTML = '';

            blocks.forEach(block => {
                // Caso especial: Slot Hero
                if (block.slot === 'hero') {
                    if (heroTitle) heroTitle.innerText = block.title;
                    if (heroBody) heroBody.innerText = block.body;
                    if (heroSection && block.media_url) {
                        heroSection.style.backgroundImage = `url('${block.media_url}')`;
                    }
                    return;
                }

                // Blocos normais (cards)
                const card = document.createElement('div');
                card.className = 'card-v2';

                let mediaHtml = '';
                if (block.media_type === 'video') {
                    if (block.media_url && (block.media_url.includes('youtube.com') || block.media_url.includes('youtu.be'))) {
                        const embedUrl = block.media_url.replace('watch?v=', 'embed/').split('&')[0];
                        mediaHtml = `<iframe src="${embedUrl}" allowfullscreen></iframe>`;
                    } else if (block.media_url) {
                        mediaHtml = `<video src="${block.media_url}" controls></video>`;
                    }
                } else if (block.media_url) {
                    mediaHtml = `<img src="${block.media_url}" alt="${block.title}" onerror="this.onerror=null; this.src='img/brasao.png';">`;
                }

                card.innerHTML = `
                    <div class="card-v2-media">${mediaHtml}</div>
                    <div class="card-v2-body">
                        <h3>${block.title}</h3>
                        <p>${block.body}</p>
                    </div>
                    ${block.link_url ? `
                        <div class="card-v2-footer">
                            <a href="${block.link_url}" class="btn btn-outline" style="color:#003366; border-color:#003366; width:100%;">${block.link_text || 'Saiba Mais'}</a>
                        </div>
                    ` : ''}
                `;
                container.appendChild(card);
            });
        }
    };

    window.CMS = CMS;
})();
