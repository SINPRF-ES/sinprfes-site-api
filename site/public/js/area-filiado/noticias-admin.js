/**
 * Módulo Notícias Admin (Página Inicial)
 * Gerenciamento de Notícias: Listagem, Criação, Edição e Publicação.
 */

(function (global) {
    if (global.NoticiasAdmin) return;

    let cacheNoticias = [];
    let perfilLogado = null;

    function ehGestaoNoticias() {
        return ["ADMIN", "DIRETORIA", "FUNCIONARIO", "COMUNICADOR"].includes(perfilLogado);
    }

    async function inicializarNoticias(perfil) {
        perfilLogado = (perfil || "").toUpperCase();
        const container = document.getElementById("sec-noticias");
        if (!container) return;

        const ehGestao = ehGestaoNoticias();

        container.innerHTML = `
            <div class="ui-card">
                <div class="af-standard-header" style="display:flex; flex-direction:column; align-items:center; gap:10px; margin-bottom:20px;">
                    <div>
                        <h2 style="margin:0;">📰 Gerenciar Informes</h2>
                        <p class="section-subtitle">Crie e publique informes para os filiados.</p>
                    </div>
                    ${ehGestao ? `<button id="btn-nova-noticia" class="ui-button ui-button-secondary" style="margin-top:10px;">+ Novo Informe</button>` : ''}
                </div>

                <div id="lista-noticias-admin" class="noticias-grid">
                    <p style="text-align:center; padding:40px; color:#666;">Carregando informes...</p>
                </div>
            </div>
        `;

        if (ehGestao) {
            document.getElementById("btn-nova-noticia").onclick = () => abrirModalNoticia();
        }

        await carregarNoticias();
    }

    async function carregarNoticias() {
        const listaEl = document.getElementById("lista-noticias-admin");
        if (!listaEl) return;

        try {
            const r = await window.Api.apiFetch("/api/informes");
            if (r.ok) {
                cacheNoticias = await r.json();
                renderizarLista();
            } else {
                listaEl.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar informes.</p>`;
            }
        } catch (e) {
            listaEl.innerHTML = `<p style="color:red; text-align:center;">Erro de conexão.</p>`;
        }
    }

    function renderizarLista() {
        const listaEl = document.getElementById("lista-noticias-admin");
        if (!listaEl || !cacheNoticias.length) {
            listaEl.innerHTML = `<p style="text-align:center; padding:40px; color:#999;">Nenhum informe encontrado.</p>`;
            return;
        }

        const safeEscape = (v) => (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : "";
        const resumoSemMarkdown = (conteudo) => {
            if (window.InformesRenderer?.renderInformesPlainText) {
                return window.InformesRenderer.renderInformesPlainText(conteudo || '');
            }
            return String(conteudo || '').replace(/\n+/g, ' ').trim();
        };

        const ehGestao = ehGestaoNoticias();

        listaEl.innerHTML = cacheNoticias.map(n => {
            const isDraft = n.status === 'RASCUNHO';
            const date = new Date(n.published_at || n.created_at).toLocaleDateString('pt-BR');

            return `
                <div class="noticia-admin-card ${isDraft ? 'draft' : ''}" style="background:#fff; border:1px solid #ddd; border-radius:12px; padding:15px; margin-bottom:15px; display:flex; gap:15px; align-items:center;">
                    ${n.capa_url ? `<img src="${safeEscape(n.capa_url)}" style="width:80px; height:80px; object-fit:cover; border-radius:8px;">` : `<div style="width:80px; height:80px; background:#f0f0f0; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#ccc;">📷</div>`}
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="font-size:0.8rem; color:#888;">${date}</span>
                            ${ehGestao ? (isDraft ? `<span class="badge badge-warning" style="font-size:0.7rem;">RASCUNHO</span>` : `<span class="badge badge-success" style="font-size:0.7rem;">PUBLICADA</span>`) : ''}
                        </div>
                        <h4 style="margin:5px 0; color:#003366;">${safeEscape(n.titulo)}</h4>
                        <p style="margin:0; font-size:0.85rem; color:#666; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${safeEscape(resumoSemMarkdown(n.conteudo))}</p>
                    </div>
                    ${ehGestao ? `
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <button class="btn btn-outline btn-sm" onclick="NoticiasAdmin.abrirModalNoticia('${n.id}')">✏️ Editar</button>
                        <button class="btn btn-outline btn-sm" onclick="NoticiasAdmin.abrirVisualizacaoNoticia('${n.id}')">📖 Ler informe</button>
                        ${isDraft ? `<button class="btn btn-primary btn-sm" onclick="NoticiasAdmin.publicarNoticia('${n.id}')">🚀 Publicar</button>` : ''}
                    </div>
                    ` : `
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <button class="btn btn-outline btn-sm" onclick="NoticiasAdmin.abrirVisualizacaoNoticia('${n.id}')">📖 Ler informe</button>
                    </div>
                    `}
                </div>
            `;
        }).join("");
    }

    function formatarConteudoHtml(conteudo) {
        if (window.InformesRenderer?.renderInformesMarkdown) {
            return window.InformesRenderer.renderInformesMarkdown(conteudo);
        }

        const safeEscape = (v) => (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : "";
        return `<p>${safeEscape(conteudo || '')}</p>`;
    }

    async function abrirVisualizacaoNoticia(id) {
        let noticia = cacheNoticias.find(n => n.id === id);

        try {
            const r = await window.Api.apiFetch(`/api/informes/${id}`);
            if (r.ok) noticia = await r.json();
        } catch (e) { }

        if (!noticia) {
            alert("Não foi possível carregar o informe.");
            return;
        }

        const modal = document.getElementById("modal-generic");
        if (!modal) {
            alert("Estrutura de modal não encontrada. Verifique area-filiado.html");
            return;
        }

        const tituloEl = document.getElementById("modal-generic-titulo");
        const corpoEl = document.getElementById("modal-generic-corpo");
        const safeEscape = (v) => (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : "";
        const date = new Date(noticia.published_at || noticia.created_at).toLocaleDateString('pt-BR');

        tituloEl.textContent = "Informe";

        if (window.Utils?.lockScroll) window.Utils.lockScroll();

        corpoEl.innerHTML = `
            <article>
                ${noticia.capa_url ? `<img src="${safeEscape(noticia.capa_url)}" alt="Capa do informe" style="width:100%; max-height:320px; object-fit:cover; border-radius:10px; margin-bottom:15px;">` : ''}
                <p style="font-size:0.8rem; color:#777; margin:0 0 8px 0;">${date}</p>
                <h3 style="margin:0 0 15px 0; color:#003366;">${safeEscape(noticia.titulo)}</h3>
                <div style="color:#333; line-height:1.6; font-size:1rem;">${formatarConteudoHtml(noticia.conteudo)}</div>
                ${(noticia.midias || []).length ? `
                <div style="margin-top:20px;">
                    <h4 style="margin-bottom:10px;">Mídias</h4>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px;">
                        ${(noticia.midias || []).map(m => m.tipo === 'IMAGEM'
                            ? `<img src="${safeEscape(m.url)}" alt="Mídia do informe" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">`
                            : `<a href="${safeEscape(m.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="text-align:center;">🎬 Ver vídeo</a>`
                        ).join('')}
                    </div>
                </div>
                ` : ''}
                <div style="margin-top:20px; display:flex; justify-content:flex-end;">
                    <button type="button" class="ui-button ui-button-outline" onclick="Utils.fecharModal('modal-generic')">Fechar</button>
                </div>
            </article>
        `;

        modal.style.display = "flex";
    }

    async function abrirModalNoticia(id = null) {
        if (!ehGestaoNoticias()) {
            alert("Apenas perfis de gestão podem editar informes.");
            return;
        }

        let noticia = { titulo: '', conteudo: '', capa_url: '', status: 'RASCUNHO', midias: [] };

        if (id) {
            try {
                const r = await window.Api.apiFetch(`/api/informes/${id}`);
                if (r.ok) noticia = await r.json();
            } catch (e) { console.error("Erro ao carregar detalhe", e); }
        }

        const modal = document.getElementById("modal-generic");
        if (!modal) {
            alert("Estrutura de modal não encontrada. Verifique area-filiado.html");
            return;
        }

        const tituloEl = document.getElementById("modal-generic-titulo");
        const corpoEl = document.getElementById("modal-generic-corpo");

        tituloEl.textContent = id ? "Editar Informe" : "Novo Informe";

        if (window.Utils?.lockScroll) window.Utils.lockScroll();

        const safeEscape = (v) => (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : "";

        corpoEl.innerHTML = `
            <form id="form-noticia-admin">
                <div class="field-group">
                    <label>Título</label>
                    <input class="ui-input" type="text" name="titulo" value="${safeEscape(noticia.titulo)}" required placeholder="Título chamativo...">
                </div>
                <div class="field-group" style="margin-top:15px;">
                    <label>Conteúdo (Markdown suportado)</label>
                    <textarea class="ui-textarea" name="conteudo" rows="10" required placeholder="Texto da notícia..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc;">${safeEscape(noticia.conteudo)}</textarea>
                </div>

                <div class="field-group" style="margin-top:15px;">
                    <label>Capa da Notícia (Upload)</label>
                    <div id="capa-preview-container" style="margin-bottom:10px;">
                        ${noticia.capa_url ? `<img src="${safeEscape(noticia.capa_url)}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">` : '<p style="font-size:0.8rem; color:#999;">Nenhuma capa selecionada.</p>'}
                    </div>
                    <input class="ui-input" type="file" id="input-capa" accept="image/*" style="display:none;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('input-capa').click()">📸 Selecionar Capa</button>
                    <p id="capa-status" style="font-size:0.7rem; color:#666; margin-top:5px;"></p>
                </div>

                <div class="field-group" style="margin-top:20px;">
                    <label>Mídias Adicionais (Galeria)</label>
                    <div id="midias-galeria" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:10px;">
                        ${(noticia.midias || []).map(m => `
                            <div class="midia-thumb" style="position:relative; aspect-ratio:1/1; background:#eee; border-radius:8px; overflow:hidden;">
                                ${m.tipo === 'IMAGEM' ? `<img src="${safeEscape(m.url)}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="display:flex; align-items:center; justify-content:center; height:100%;">🎬</div>`}
                                <button type="button" onclick="NoticiasAdmin.removerMidia('${m.id}', '${noticia.id}')" style="position:absolute; top:2px; right:2px; background:rgba(255,255,255,0.8); border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; color:red;">×</button>
                            </div>
                        `).join('')}
                    </div>
                    <input class="ui-input" type="file" id="input-midia" accept="image/*,video/*" multiple style="display:none;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('input-midia').click()">➕ Adicionar Mídias</button>
                    <p id="midias-status" style="font-size:0.7rem; color:#666; margin-top:5px;"></p>
                </div>

                <div style="margin-top:25px; display:flex; justify-content:space-between; align-items:center;">
                    ${id ? `<button type="button" class="btn btn-danger btn-sm" onclick="NoticiasAdmin.deletarNoticia('${id}')">🗑️ Excluir</button>` : '<div></div>'}
                    <div style="display:flex; gap:10px;">
                        <button type="button" class="ui-button ui-button-outline" onclick="Utils.fecharModal('modal-generic')">Cancelar</button>
                        <button type="submit" id="btn-salvar-noticia" class="ui-button ui-button-secondary">Salvar Informe</button>
                    </div>
                </div>
            </form>
        `;

        modal.style.display = "flex";

        const inputCapa = document.getElementById('input-capa');
        const inputMidia = document.getElementById('input-midia');

        inputCapa.onchange = async (e) => {
            if (!id) { alert("Salve a notícia primeiro como rascunho."); inputCapa.value = ""; return; }
            const file = e.target.files[0];
            if (!file) return;
            await realizarUpload(id, file, 'IMAGEM', true);
        };

        inputMidia.onchange = async (e) => {
            if (!id) { alert("Salve a notícia primeiro como rascunho."); inputMidia.value = ""; return; }
            const files = Array.from(e.target.files);
            for (const file of files) {
                const tipo = file.type.startsWith('video') ? 'VIDEO' : 'IMAGEM';
                await realizarUpload(id, file, tipo, false);
            }
        };

        document.getElementById("form-noticia-admin").onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const payload = {
                titulo: fd.get("titulo"),
                conteudo: fd.get("conteudo")
            };

            try {
                const url = id ? `/api/informes/${id}` : "/api/informes";
                const method = id ? "PUT" : "POST";
                const r = await window.Api.apiFetch(url, { method, body: payload });

                if (r.ok) {
                    const saved = await r.json();
                    if (!id) {
                        // Se era nova, agora temos um ID, reabre para permitir uploads
                        abrirModalNoticia(saved.id);
                    } else {
                        if (window.Utils?.fecharModal) window.Utils.fecharModal("modal-generic");
                        else modal.style.display = "none";
                    }
                    await carregarNoticias();
                } else {
                    const err = await r.json();
                    alert(err.message || "Erro ao salvar informe.");
                }
            } catch (err) {
                alert("Erro de conexão.");
            }
        };
    }

    async function realizarUpload(noticiaId, file, tipo, isCapa) {
        const statusEl = document.getElementById(isCapa ? 'capa-status' : 'midias-status');
        statusEl.textContent = "Enviando...";
        statusEl.style.color = "#003366";

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('tipo', tipo);

            const r = await window.Api.apiFetch(`/api/informes/${noticiaId}/midias`, {
                method: 'POST',
                body: formData
            });

            if (r && r.ok) {
                const midia = await r.json();
                statusEl.textContent = "Upload concluído!";
                statusEl.style.color = "green";

                if (isCapa) {
                    // Atualiza a capa da notícia com a URL recém obtida
                    await window.Api.apiFetch(`/api/informes/${noticiaId}`, {
                        method: 'PUT',
                        body: { capa_url: midia.url }
                    });
                }
                // Recarrega o modal para mostrar as novidades
                abrirModalNoticia(noticiaId);
            } else {
                statusEl.textContent = "Erro no upload.";
                statusEl.style.color = "red";
            }
        } catch (err) {
            statusEl.textContent = "Erro de conexão.";
            statusEl.style.color = "red";
        }
    }

    async function removerMidia(midiaId, noticiaId) {
        if (!confirm("Remover esta mídia?")) return;
        try {
            const r = await window.Api.apiFetch(`/api/informes/midias/${midiaId}`, { method: 'DELETE' });
            if (r.ok) {
                abrirModalNoticia(noticiaId);
            }
        } catch (e) { alert("Erro ao remover mídia."); }
    }

    async function publicarNoticia(id) {
        if (!ehGestaoNoticias()) {
            alert("Apenas perfis de gestão podem publicar informes.");
            return;
        }

        if (!confirm("Deseja publicar esta notícia agora? Ela ficará visível para todos.")) return;
        try {
            const r = await window.Api.apiFetch(`/api/informes/${id}/publicar`, { method: "POST" });
            if (r.ok) {
                await carregarNoticias();
            } else {
                alert("Erro ao publicar.");
            }
        } catch (e) { alert("Erro de conexão."); }
    }

    async function deletarNoticia(id) {
        if (!ehGestaoNoticias()) {
            alert("Apenas perfis de gestão podem excluir informes.");
            return;
        }

        if (!confirm("Tem certeza que deseja EXCLUIR permanentemente esta notícia?")) return;
        try {
            const r = await window.Api.apiFetch(`/api/informes/${id}`, { method: "DELETE" });
            if (r.ok) {
                if (window.Utils?.fecharModal) window.Utils.fecharModal("modal-generic");
                else document.getElementById("modal-generic").style.display = "none";
                await carregarNoticias();
            } else {
                alert("Erro ao excluir.");
            }
        } catch (e) { alert("Erro de conexão."); }
    }

    global.NoticiasAdmin = {
        inicializarNoticias,
        abrirModalNoticia,
        abrirVisualizacaoNoticia,
        publicarNoticia,
        deletarNoticia,
        removerMidia
    };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : self));
