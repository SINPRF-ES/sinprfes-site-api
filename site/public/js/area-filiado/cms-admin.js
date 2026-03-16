// public/js/area-filiado/cms-admin.js
(function() {
    const CMS_FOLDER = 'sinprfes/avatars/cms';

    const CMSAdmin = {
        page: 'home',

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
                this.renderBlocks(blocks);
            } catch (err) {
                console.error('CMSAdmin.loadBlocks.Error', err);
                container.innerHTML = `<div style="padding: 20px; border: 1px dashed #e74c3c; color: #e74c3c; border-radius: 8px; text-align: center;">Erro ao carregar CMS: ${err.message}</div>`;
            }
        },

        renderBlocks(blocks) {
            const container = document.getElementById('cms-blocks-admin');
            container.innerHTML = '';

            if (!blocks.length) {
                container.innerHTML = '<p>Nenhum bloco encontrado para esta página.</p>';
                return;
            }

            blocks.forEach(block => {
                const div = document.createElement('div');
                div.className = 'section-box';
                div.style.background = '#fff';
                div.style.padding = '20px';

                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; gap:10px; flex-wrap:wrap;">
                        <h4 style="margin:0; color:var(--ui-primary);">ID: ${block.id}</h4>
                        <label style="font-size:0.8rem; cursor: pointer; color:#334155;">
                            <input type="checkbox" style="width:auto;" id="active-${block.id}" ${block.is_active ? 'checked' : ''}> Ativo no site
                        </label>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Título</label>
                            <input class="ui-input" type="text" id="title-${block.id}" value="${block.title || ''}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Corpo (Texto)</label>
                            <textarea class="ui-textarea" id="body-${block.id}" rows="3">${block.body || ''}</textarea>
                        </div>
                    </div>
                    <div class="field-row">
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
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Link (URL Saiba Mais)</label>
                            <input class="ui-input" type="text" id="link-${block.id}" value="${block.link_url || ''}">
                        </div>
                        <div class="field-group">
                            <label>Ordem</label>
                            <input class="ui-input" type="number" style="width: 100px;" id="order-${block.id}" value="${block.ordenacao || 0}">
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="CMSAdmin.save('${block.id}')" style="margin-top:10px;">Salvar Alterações</button>
                `;
                container.appendChild(div);

                const input = div.querySelector(`#upload-${block.id}`);
                if (input) {
                    input.onchange = (e) => this.uploadMedia(block.id, e.target.files?.[0]);
                }
            });
        },

        triggerUpload(id) {
            document.getElementById(`upload-${id}`)?.click();
        },

        async uploadMedia(id, file) {
            if (!file) return;
            const statusEl = document.getElementById(`status-${id}`);
            const urlEl = document.getElementById(`url-${id}`);
            if (statusEl) statusEl.textContent = 'Preparando upload...';

            try {
                const signRes = await window.Api.apiFetch('/api/content-blocks/upload-signature', {
                    method: 'POST',
                    body: { folder: CMS_FOLDER, tags: 'cms,site-publico' }
                });
                if (!signRes?.ok) throw new Error('Falha ao obter assinatura de upload');
                const sign = await signRes.json();

                const fd = new FormData();
                fd.append('file', file);
                fd.append('api_key', sign.api_key);
                fd.append('timestamp', String(sign.timestamp));
                fd.append('signature', sign.signature);
                fd.append('folder', sign.folder || CMS_FOLDER);
                if (sign.tags) fd.append('tags', sign.tags);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloud_name}/auto/upload`, {
                    method: 'POST',
                    body: fd
                });
                if (!uploadRes.ok) throw new Error('Falha no upload Cloudinary');

                const up = await uploadRes.json();
                if (urlEl) urlEl.value = up.secure_url || up.url || '';
                if (statusEl) {
                    statusEl.textContent = 'Upload concluído.';
                    statusEl.style.color = 'green';
                }
            } catch (err) {
                if (statusEl) {
                    statusEl.textContent = `Erro: ${err.message}`;
                    statusEl.style.color = 'red';
                }
            }
        },

        async save(id) {
            const data = {
                title: document.getElementById(`title-${id}`)?.value,
                body: document.getElementById(`body-${id}`)?.value,
                media_type: document.getElementById(`type-${id}`)?.value,
                media_url: document.getElementById(`url-${id}`)?.value,
                link_url: document.getElementById(`link-${id}`)?.value,
                ordenacao: parseInt(document.getElementById(`order-${id}`)?.value) || 0,
                is_active: !!document.getElementById(`active-${id}`)?.checked,
                page: this.page
            };

            try {
                const res = await window.Api.apiFetch(`/api/content-blocks/${id}`, { method: 'PUT', body: data });
                if (res?.ok) {
                    alert('Bloco atualizado com sucesso!');
                    this.loadBlocks(this.page);
                } else if (res) {
                    const errData = await res.json();
                    alert('Erro ao salvar: ' + (errData.error || errData.message || 'Erro desconhecido'));
                }
            } catch (err) {
                if (err.message !== 'Sessão expirada') alert('Erro na requisição: ' + err.message);
            }
        }
    };

    window.CMSAdmin = CMSAdmin;
})();
