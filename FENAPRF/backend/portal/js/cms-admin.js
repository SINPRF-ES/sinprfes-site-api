// public/js/area-user/cms-admin.js
(function() {
    const CMSAdmin = {
        async init() {
            const selector = document.getElementById('cms-page-selector');
            if (selector) {
                selector.addEventListener('change', () => this.loadBlocks(selector.value));
                this.loadBlocks(selector.value);
            }
        },

        async loadBlocks(page) {
            const container = document.getElementById('cms-blocks-admin');
            if (!container) return;
            container.innerHTML = '<p>Carregando...</p>';

            try {
                // Now including inactive blocks for management
                const res = await fetch(`/api/content-blocks?page=${page}&includeInactive=true`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const blocks = await res.json();
                this.renderBlocks(blocks);
            } catch (err) {
                container.innerHTML = '<p>Erro ao carregar blocos.</p>';
            }
        },

        renderBlocks(blocks) {
            const container = document.getElementById('cms-blocks-admin');
            container.innerHTML = '';

            if (blocks.length === 0) {
                container.innerHTML = '<p>Nenhum bloco encontrado para esta página.</p>';
                return;
            }

            blocks.forEach(block => {
                const div = document.createElement('div');
                div.className = 'section-box';
                div.style.background = 'rgba(255,255,255,0.05)';
                div.style.padding = '20px';

                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h4 style="margin:0; color:var(--amarelo);">ID: ${block.id}</h4>
                        <label style="font-size:0.8rem; cursor: pointer;">
                            <input type="checkbox" id="active-${block.id}" ${block.is_active ? 'checked' : ''}> Ativo no site
                        </label>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Título</label>
                            <input type="text" id="title-${block.id}" value="${block.title || ''}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Corpo (Texto)</label>
                            <textarea id="body-${block.id}" rows="3">${block.body || ''}</textarea>
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Tipo de Mídia</label>
                            <select id="type-${block.id}">
                                <option value="image" ${block.media_type === 'image' ? 'selected' : ''}>Imagem</option>
                                <option value="video" ${block.media_type === 'video' ? 'selected' : ''}>Vídeo (URL)</option>
                            </select>
                        </div>
                        <div class="field-group">
                            <label>URL da Mídia</label>
                            <input type="text" id="url-${block.id}" value="${block.media_url || ''}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Link (URL Saiba Mais)</label>
                            <input type="text" id="link-${block.id}" value="${block.link_url || ''}">
                        </div>
                        <div class="field-group">
                            <label>Ordem</label>
                            <input type="number" id="order-${block.id}" value="${block.ordenacao || 0}">
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="CMSAdmin.save('${block.id}')" style="margin-top:10px;">Salvar Alterações</button>
                `;
                container.appendChild(div);
            });
        },

        async save(id) {
            const data = {
                title: document.getElementById(`title-${id}`).value,
                body: document.getElementById(`body-${id}`).value,
                media_type: document.getElementById(`type-${id}`).value,
                media_url: document.getElementById(`url-${id}`).value,
                link_url: document.getElementById(`link-${id}`).value,
                ordenacao: parseInt(document.getElementById(`order-${id}`).value),
                is_active: document.getElementById(`active-${id}`).checked
            };

            try {
                const res = await fetch(`/api/content-blocks/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(data)
                });

                if (res.ok) {
                    alert('Bloco atualizado com sucesso!');
                    this.loadBlocks(document.getElementById('cms-page-selector').value);
                } else {
                    const err = await res.json();
                    alert('Erro ao salvar: ' + (err.error || 'Erro desconhecido'));
                }
            } catch (err) {
                alert('Erro na requisição: ' + err.message);
            }
        }
    };

    window.CMSAdmin = CMSAdmin;
})();
