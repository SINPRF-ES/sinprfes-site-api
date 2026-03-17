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
                if (this.page === 'home') {
                    const res = await window.Api.apiFetch('/api/noticias?audiencia=PUBLICA&status_editorial=ATUAL');
                    if (!res) throw new Error('Falha na conexão');
                    if (res.status === 401) return;
                    if (res.status === 403) {
                        container.innerHTML = '<p>Você não tem permissão para gerenciar o conteúdo do site.</p>';
                        return;
                    }
                    if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
                    const data = await res.json();
                    const noticias = Array.isArray(data) ? data : (data.items || []);
                    this.blocks = noticias.map(n => ({
                        id: n.id,
                        title: n.titulo,
                        body: n.conteudo,
                        media_url: n.capa_url,
                        media_type: 'image',
                        is_noticia: true,
                        is_active: true
                    }));
                } else {
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
                }
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
            const isHome = this.page === 'home';

            toolbar.innerHTML = `
                <p style="margin:0; color:#475467;">${isHome ? 'Edite a notícia atual em destaque no site.' : 'Edite todos os convênios nesta tela e salve quando terminar.'}</p>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    ${this.page === 'convenios' ? '<button class="btn btn-outline btn-sm" type="button" id="cms-add-block">+ Incluir outro convênio</button>' : ''}
                    ${isHome ? '<button class="btn btn-outline btn-sm" type="button" id="cms-add-news">+ Incluir nova notícia</button>' : ''}
                    <button class="btn btn-primary btn-sm" type="button" id="cms-save-all">Salvar ${isHome ? 'notícia' : 'todos os blocos'}</button>
                </div>
            `;
            container.appendChild(toolbar);

            if (isHome && !blocks.length) {
                const emptyMsg = document.createElement('p');
                emptyMsg.style.color = '#64748b';
                emptyMsg.textContent = 'Nenhuma notícia atual encontrada. Clique em "+ Incluir nova notícia" para começar.';
                container.appendChild(emptyMsg);
            }

            blocks.forEach((block) => {
                const div = document.createElement('div');
                div.className = 'section-box';
                div.style.background = '#fff';
                div.style.padding = '20px';

                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; gap:10px; flex-wrap:wrap;">
                        <h4 style="margin:0; color:var(--ui-primary);">${isHome ? 'Notícia Atual' : 'ID: ' + block.id}</h4>
                        ${!isHome ? `
                        <label style="font-size:0.85rem; cursor: pointer; color:#334155; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" style="width:auto;" id="active-${block.id}" ${block.is_active ? 'checked' : ''}> Exibir no site
                        </label>` : ''}
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr; gap: 12px;">
                        <div class="field-group">
                            <label>Título</label>
                            <input class="ui-input" type="text" id="title-${block.id}" value="${block.title || ''}">
                        </div>

                        <div class="field-group">
                            <label>${isHome ? 'Conteúdo (Corpo)' : 'Corpo (Texto)'}</label>
                            <textarea class="ui-textarea" id="body-${block.id}" rows="${isHome ? 10 : 3}">${block.body || ''}</textarea>
                        </div>

                        ${!isHome ? `
                        <div class="field-group">
                            <label>Tipo de Mídia</label>
                            <select class="ui-select" id="type-${block.id}">
                                <option value="image" ${block.media_type === 'image' ? 'selected' : ''}>Imagem</option>
                                <option value="video" ${block.media_type === 'video' ? 'selected' : ''}>Vídeo</option>
                            </select>
                        </div>` : ''}

                        <div class="field-group">
                            <label>${isHome ? 'URL da Foto de Capa' : 'URL da Mídia (Cloudinary)'}</label>
                            <input class="ui-input" type="text" id="url-${block.id}" value="${block.media_url || ''}" placeholder="https://res.cloudinary.com/...">
                            <input type="file" id="upload-${block.id}" accept="image/*,video/*" style="display:none;">
                            <div style="display:flex; gap:8px; margin-top:8px; align-items:center; flex-wrap:wrap;">
                              <button class="btn btn-outline btn-sm" onclick="CMSAdmin.triggerUpload('${block.id}')" type="button">☁️ Upload mídia</button>
                              <span id="status-${block.id}" style="font-size:0.8rem; color:#64748b;"></span>
                            </div>
                        </div>

                        ${!isHome ? `
                        <div class="field-group">
                            <label>Link (URL Saiba Mais)</label>
                            <input class="ui-input" type="text" id="link-${block.id}" value="${block.link_url || ''}">
                        </div>

                        <div class="field-group">
                            <label>Ordem de exibição</label>
                            <select class="ui-select" id="order-${block.id}" data-order-select="true">
                                ${this.renderOrderOptions(block.ordenacao, blocks.length)}
                            </select>
                        </div>` : ''}
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
            document.getElementById('cms-add-news')?.addEventListener('click', () => this.prepareCreateNews());
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

        prepareCreateNews() {
            const modal = document.getElementById('modal-generic');
            if (!modal) return;
            document.getElementById('modal-generic-titulo').textContent = 'Incluir Nova Notícia';
            document.getElementById('modal-generic-corpo').innerHTML = `
                <div style="padding: 10px;">
                    <p style="color: #475467; line-height: 1.5;">
                        Ao incluir uma nova notícia, a <strong>notícia atual</strong> será movida para a página <strong>noticias.html</strong> (arquivo histórico) e a nova notícia assumirá o lugar de destaque na página inicial.
                    </p>
                    <p style="margin-top: 15px; font-weight: 600;">Deseja prosseguir?</p>
                    <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end;">
                        <button class="btn btn-outline" onclick="window.Utils.fecharModal('modal-generic')">Cancelar</button>
                        <button class="btn btn-primary" id="cms-confirm-new-news">Sim, criar nova notícia</button>
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
            document.getElementById('cms-confirm-new-news').onclick = () => this.createNews();
        },

        async createNews() {
            window.Utils?.fecharModal('modal-generic');
            try {
                const res = await window.Api.apiFetch('/api/noticias', {
                    method: 'POST',
                    body: {
                        titulo: 'Nova Notícia (Título Provisório)',
                        conteudo: 'Conteúdo da nova notícia...',
                        audiencia: 'PUBLICA'
                    }
                });
                if (!res?.ok) {
                    const errData = res ? await res.json() : {};
                    throw new Error(errData.message || 'Erro ao criar notícia');
                }
                alert('Nova notícia criada com sucesso! Você já pode editá-la.');
                await this.loadBlocks(this.page);
            } catch (err) {
                alert(`Erro ao incluir notícia: ${err.message}`);
            }
        },

        async saveAll() {
            const blocks = [...this.blocks];
            if (!blocks.length) return;

            if (this.page !== 'home') {
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
            }

            try {
                for (const block of blocks) {
                    const data = this.collectBlockData(block.id);
                    let endpoint = `/api/content-blocks/${block.id}`;
                    let method = 'PUT';
                    let body = data;

                    if (block.is_noticia) {
                        endpoint = `/api/noticias/${block.id}`;
                        body = {
                            titulo: data.title,
                            conteudo: data.body,
                            capa_url: data.media_url,
                            audiencia: 'PUBLICA'
                        };
                    }

                    const res = await window.Api.apiFetch(endpoint, { method, body });
                    if (!res?.ok) {
                        const errData = res ? await res.json() : {};
                        throw new Error(`Falha ao salvar: ${errData.error || errData.message || 'erro desconhecido'}`);
                    }
                }
                alert(this.page === 'home' ? 'Notícia atualizada com sucesso!' : 'Todos os blocos foram atualizados com sucesso!');
                this.loadBlocks(this.page);
            } catch (err) {
                alert(`Erro ao salvar: ${err.message}`);
            }
        }
    };

    window.CMSAdmin = CMSAdmin;
})();
