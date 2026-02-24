// public/js/area-filiado/cms-admin.js
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
                const res = await window.Api.apiFetch(`/api/content-blocks?page=${page}&includeInactive=true`);
                if (!res) throw new Error('Falha na conexão');
                if (res.status === 401) return; // handled by apiFetch
                if (res.status === 403) {
                    container.innerHTML = '<p>Você não tem permissão para gerenciar o conteúdo do site.</p>';
                    return;
                }
                if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);

                const blocks = await res.json();
                if (!Array.isArray(blocks)) throw new Error('Formato de dados inválido');

                this.renderBlocks(blocks);
            } catch (err) {
                console.error("CMSAdmin.loadBlocks.Error", err);
                container.innerHTML = `
                    <div style="padding: 20px; border: 1px dashed #e74c3c; color: #e74c3c; border-radius: 8px; text-align: center;">
                        <p><strong>⚠️ Erro Crítico de Conteúdo</strong></p>
                        <p>Não foi possível carregar ou processar os blocos do site.</p>
                        <p style="font-size: 0.8rem; margin-top: 10px;">Causa: ${err.message}</p>
                        <p style="font-size: 0.8rem;">Se o problema persistir, o arquivo de dados pode estar corrompido. Entre em contato com o suporte.</p>
                    </div>
                `;
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
            const titleEl = document.getElementById(`title-${id}`);
            const bodyEl = document.getElementById(`body-${id}`);
            const typeEl = document.getElementById(`type-${id}`);
            const urlEl = document.getElementById(`url-${id}`);
            const linkEl = document.getElementById(`link-${id}`);
            const orderEl = document.getElementById(`order-${id}`);
            const activeEl = document.getElementById(`active-${id}`);

            if (!titleEl || !bodyEl) return;

            const data = {
                title: titleEl.value,
                body: bodyEl.value,
                media_type: typeEl.value,
                media_url: urlEl.value,
                link_url: linkEl.value,
                ordenacao: parseInt(orderEl.value) || 0,
                is_active: activeEl.checked
            };

            try {
                const res = await window.Api.apiFetch(`/api/content-blocks/${id}`, {
                    method: 'PUT',
                    body: data
                });

                if (res && res.ok) {
                    alert('Bloco atualizado com sucesso!');
                    this.loadBlocks(document.getElementById('cms-page-selector').value);
                } else if (res) {
                    const errData = await res.json();
                    alert('Erro ao salvar: ' + (errData.error || errData.message || 'Erro desconhecido'));
                }
            } catch (err) {
                if (err.message === "Sessão expirada") return;
                alert('Erro na requisição: ' + err.message);
            }
        }
    };

    window.CMSAdmin = CMSAdmin;
})();
