// public/js/area-filiado/cms-admin.js
(function() {
    const CMS_FOLDER = 'sinprfes/avatars/cms';

    const CMSAdmin = {
        page: 'home',
        blocks: [],

        async init() {
            const btnHome = document.getElementById('cms-page-home');
            const btnConvenios = document.getElementById('cms-page-convenios');
            if (btnHome) btnHome.onclick = () => this.loadBlocks('home');
            if (btnConvenios) btnConvenios.onclick = () => this.loadBlocks('convenios');
            this.loadBlocks(this.page);
        },

        async loadBlocks(page) {
            this.page = page || 'home';
            const container = document.getElementById('cms-blocks-admin');
            if (!container) return;
            container.innerHTML = '<p>Carregando...</p>';

            try {
                const res = await window.Api.apiFetch(`/api/content-blocks?page=${this.page}&includeInactive=true`);
                if (!res) throw new Error('Falha na conexão');
                if (res.status === 401) return;
                if (res.status === 403) {
                    container.innerHTML = '<p>Você não tem permissão para gerenciar o conteúdo do site.</p>';
                    return;
                }
                if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);

                const blocks = await res.json();
                if (!Array.isArray(blocks)) throw new Error('Formato de dados inválido');
                this.blocks = blocks;
                this.renderBlocks();
            } catch (err) {
                console.error('CMSAdmin.loadBlocks.Error', err);
                container.innerHTML = `<div style="padding: 20px; border: 1px dashed #e74c3c; color: #e74c3c; border-radius: 8px; text-align: center;">Erro ao carregar CMS: ${err.message}</div>`;
            }
        },

        renderBlocks() {
            const container = document.getElementById('cms-blocks-admin');
            container.innerHTML = '';

            const blocks = [...this.blocks].sort((a, b) => (a.ordenacao || 0) - (b.ordenacao || 0));
            if (!blocks.length) {
                container.innerHTML = '<p>Nenhum bloco encontrado para esta página.</p>';
                return;
            }

            const toolbar = document.createElement('div');
            toolbar.style.display = 'flex';
            toolbar.style.flexDirection = 'column';
            toolbar.style.gap = '10px';
            toolbar.style.marginBottom = '12px';
            toolbar.innerHTML = `
                <p style="margin:0; color:#475467;">Edite todos os convênios nesta tela e salve quando terminar.</p>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    ${this.page === 'convenios' ? '<button class="btn btn-outline btn-sm" type="button" id="cms-add-block">+ Incluir outro convênio</button>' : ''}
                    <button class="btn btn-primary btn-sm" type="button" id="cms-save-all">Salvar todos os blocos</button>
                </div>
            `;
            container.appendChild(toolbar);

            blocks.forEach((block) => {
                const div = document.createElement('div');
                div.className = 'section-box';
                div.style.background = '#fff';
                div.style.padding = '20px';

                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; gap:10px; flex-wrap:wrap;">
                        <h4 style="margin:0; color:var(--ui-primary);">ID: ${block.id}</h4>
                        <label style="font-size:0.85rem; cursor: pointer; color:#334155; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" style="width:auto;" id="active-${block.id}" ${block.is_active ? 'checked' : ''}> Exibir no frontend
                        </label>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr; gap: 12px;">
                        <div class="field-group">
                            <label>Título</label>
                            <input class="ui-input" type="text" id="title-${block.id}" value="${block.title || ''}">
                        </div>

                        <div class="field-group">
                            <label>Corpo (Texto)</label>
                            <textarea class="ui-textarea" id="body-${block.id}" rows="3">${block.body || ''}</textarea>
                        </div>

                        <div class="field-group">
                            <label>Tipo de Mídia</label>
                            <select class="ui-select" id="type-${block.id}">
                                <option value="image" ${block.media_type === 'image' ? 'selected' : ''}>Imagem</option>
                                <option value="video" ${block.media_type === 'video' ? 'selected' : ''}>Vídeo</option>
                            </select>
                        </div>

                        <div class="field-group">
                            <label>URL da Mídia (Cloudinary)</label>
                            <input class="ui-input" type="text" id="url-${block.id}" value="${block.media_url || ''}" placeholder="https://res.cloudinary.com/...">
                            <input type="file" id="upload-${block.id}" accept="image/*,video/*" style="display:none;">
                            <div style="display:flex; gap:8px; margin-top:8px; align-items:center; flex-wrap:wrap;">
                              <button class="btn btn-outline btn-sm" onclick="CMSAdmin.triggerUpload('${block.id}')" type="button">☁️ Upload mídia</button>
                              <span id="status-${block.id}" style="font-size:0.8rem; color:#64748b;"></span>
                            </div>
                        </div>

                        <div class="field-group">
                            <label>Link (URL Saiba Mais)</label>
                            <input class="ui-input" type="text" id="link-${block.id}" value="${block.link_url || ''}">
                        </div>

                        <div class="field-group">
                            <label>Ordem de exibição</label>
                            <select class="ui-select" id="order-${block.id}" data-order-select="true">
                                ${this.renderOrderOptions(block.ordenacao, blocks.length)}
                            </select>
                        </div>
                    </div>
                `;
                container.appendChild(div);

                const input = div.querySelector(`#upload-${block.id}`);
                if (input) {
                    input.onchange = (e) => this.uploadMedia(block.id, e.target.files?.[0]);
                }
            });

            document.getElementById('cms-save-all')?.addEventListener('click', () => this.saveAll());
            document.getElementById('cms-add-block')?.addEventListener('click', () => this.createConvenio());
        },

        renderOrderOptions(currentOrder, total) {
            const normalizedCurrent = Number(currentOrder) || 1;
            const amount = Math.max(total, normalizedCurrent);
            let options = '';
            for (let i = 1; i <= amount; i += 1) {
                options += `<option value="${i}" ${i === normalizedCurrent ? 'selected' : ''}>${i}º</option>`;
            }
            return options;
        },

        triggerUpload(id) {
            document.getElementById(`upload-${id}`)?.click();
        },

        async uploadMedia(id, file) {
            if (!file) return;
            const statusEl = document.getElementById(`status-${id}`);
            const urlEl = document.getElementById(`url-${id}`);
            if (statusEl) statusEl.textContent = 'Enviando e otimizando...';

            try {
                const fd = new FormData();
                fd.append('file', file);

                const uploadRes = await window.Api.apiFetch('/api/content-blocks/upload-media', {
                    method: 'POST',
                    body: fd
                });

                if (!uploadRes?.ok) {
                    const errData = await uploadRes.json().catch(() => ({}));
                    throw new Error(errData.error || 'Falha no upload');
                }

                const up = await uploadRes.json();
                if (urlEl) urlEl.value = up.url || '';
                if (statusEl) {
                    statusEl.textContent = 'Upload concluído com sucesso.';
                    statusEl.style.color = 'green';
                }
            } catch (err) {
                console.error('CMSAdmin.uploadMedia.Error', err);
                if (statusEl) {
                    statusEl.textContent = `Erro: ${err.message}`;
                    statusEl.style.color = 'red';
                }
            }
        },

        collectBlockData(id) {
            return {
                title: document.getElementById(`title-${id}`)?.value,
                body: document.getElementById(`body-${id}`)?.value,
                media_type: document.getElementById(`type-${id}`)?.value,
                media_url: document.getElementById(`url-${id}`)?.value,
                link_url: document.getElementById(`link-${id}`)?.value,
                ordenacao: parseInt(document.getElementById(`order-${id}`)?.value, 10) || 1,
                is_active: !!document.getElementById(`active-${id}`)?.checked,
                page: this.page
            };
        },

        async createConvenio() {
            if (this.page !== 'convenios') return;
            try {
                const res = await window.Api.apiFetch('/api/content-blocks', {
                    method: 'POST',
                    body: { page: 'convenios', title: 'Novo convênio', is_active: true }
                });
                if (!res?.ok) {
                    const errData = res ? await res.json() : {};
                    throw new Error(errData.error || 'Erro ao criar convênio');
                }
                await this.loadBlocks(this.page);
            } catch (err) {
                alert(`Erro ao incluir convênio: ${err.message}`);
            }
        },

        async saveAll() {
            const blocks = [...this.blocks];
            if (!blocks.length) return;

            const duplicatedOrders = new Set();
            const seen = new Set();
            blocks.forEach((block) => {
                const order = parseInt(document.getElementById(`order-${block.id}`)?.value, 10) || 1;
                if (seen.has(order)) duplicatedOrders.add(order);
                seen.add(order);
            });

            if (duplicatedOrders.size) {
                alert(`Há ordens repetidas (${[...duplicatedOrders].join(', ')}). Ajuste antes de salvar.`);
                return;
            }

            try {
                for (const block of blocks) {
                    const data = this.collectBlockData(block.id);
                    const res = await window.Api.apiFetch(`/api/content-blocks/${block.id}`, { method: 'PUT', body: data });
                    if (!res?.ok) {
                        const errData = res ? await res.json() : {};
                        throw new Error(`Falha ao salvar ${block.id}: ${errData.error || 'erro desconhecido'}`);
                    }
                }
                alert('Todos os blocos foram atualizados com sucesso!');
                this.loadBlocks(this.page);
            } catch (err) {
                alert(`Erro ao salvar blocos: ${err.message}`);
            }
        }
    };

    window.CMSAdmin = CMSAdmin;
})();
