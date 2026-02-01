/**
 * Módulo Notícias Admin (Página Inicial)
 * Gerenciamento de Notícias: Listagem, Criação, Edição e Publicação.
 */

(function (global) {
    if (global.NoticiasAdmin) return;

    let cacheNoticias = [];
    let perfilLogado = null;

    async function inicializarNoticias(perfil) {
        perfilLogado = (perfil || "").toUpperCase();
        const container = document.getElementById("sec-noticias");
        if (!container) return;

        const ehGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "COMUNICADOR"].includes(perfilLogado);

        container.innerHTML = `
            <div class="section-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div>
                        <h2 style="margin:0;">📰 Gerenciar Notícias</h2>
                        <p class="section-subtitle">Crie e publique informes para os filiados.</p>
                    </div>
                    ${ehGestao ? `<button id="btn-nova-noticia" class="btn btn-primary">+ Nova Notícia</button>` : ''}
                </div>

                <div id="lista-noticias-admin" class="noticias-grid">
                    <p style="text-align:center; padding:40px; color:#666;">Carregando notícias...</p>
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
            const r = await window.Api.apiFetch("/api/noticias");
            if (r.ok) {
                cacheNoticias = await r.json();
                renderizarLista();
            } else {
                listaEl.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar notícias.</p>`;
            }
        } catch (e) {
            listaEl.innerHTML = `<p style="color:red; text-align:center;">Erro de conexão.</p>`;
        }
    }

    function renderizarLista() {
        const listaEl = document.getElementById("lista-noticias-admin");
        if (!listaEl || !cacheNoticias.length) {
            listaEl.innerHTML = `<p style="text-align:center; padding:40px; color:#999;">Nenhuma notícia encontrada.</p>`;
            return;
        }

        listaEl.innerHTML = cacheNoticias.map(n => {
            const isDraft = n.status === 'RASCUNHO';
            const date = new Date(n.published_at || n.created_at).toLocaleDateString('pt-BR');

            return `
                <div class="noticia-admin-card ${isDraft ? 'draft' : ''}" style="background:#fff; border:1px solid #ddd; border-radius:12px; padding:15px; margin-bottom:15px; display:flex; gap:15px; align-items:center;">
                    ${n.capa_url ? `<img src="${n.capa_url}" style="width:80px; height:80px; object-fit:cover; border-radius:8px;">` : `<div style="width:80px; height:80px; background:#f0f0f0; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#ccc;">📷</div>`}
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="font-size:0.8rem; color:#888;">${date}</span>
                            ${isDraft ? `<span class="badge badge-warning" style="font-size:0.7rem;">RASCUNHO</span>` : `<span class="badge badge-success" style="font-size:0.7rem;">PUBLICADA</span>`}
                        </div>
                        <h4 style="margin:5px 0; color:#003366;">${n.titulo}</h4>
                        <p style="margin:0; font-size:0.85rem; color:#666; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${n.conteudo}</p>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <button class="btn btn-outline btn-sm" onclick="NoticiasAdmin.abrirModalNoticia('${n.id}')">✏️ Editar</button>
                        ${isDraft ? `<button class="btn btn-primary btn-sm" onclick="NoticiasAdmin.publicarNoticia('${n.id}')">🚀 Publicar</button>` : ''}
                    </div>
                </div>
            `;
        }).join("");
    }

    function abrirModalNoticia(id = null) {
        const noticia = id ? cacheNoticias.find(n => n.id === id) : { titulo: '', conteudo: '', capa_url: '', status: 'RASCUNHO' };

        const modal = document.getElementById("modal-generic");
        if (!modal) {
            // Se não existir um modal genérico, usamos o de editar filiado adaptado ou criamos um
            alert("Estrutura de modal não encontrada. Verifique area-filiado.html");
            return;
        }

        const tituloEl = document.getElementById("modal-generic-titulo");
        const corpoEl = document.getElementById("modal-generic-corpo");

        tituloEl.textContent = id ? "Editar Notícia" : "Nova Notícia";

        corpoEl.innerHTML = `
            <form id="form-noticia-admin">
                <div class="field-group">
                    <label>Título</label>
                    <input type="text" name="titulo" value="${noticia.titulo}" required placeholder="Título chamativo...">
                </div>
                <div class="field-group" style="margin-top:15px;">
                    <label>Conteúdo (Markdown)</label>
                    <textarea name="conteudo" rows="10" required placeholder="Texto da notícia..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc;">${noticia.conteudo}</textarea>
                </div>
                <div class="field-group" style="margin-top:15px;">
                    <label>URL da Imagem de Capa (Opcional)</label>
                    <input type="text" name="capa_url" value="${noticia.capa_url || ''}" placeholder="https://...">
                    ${noticia.capa_url ? `<img src="${noticia.capa_url}" style="width:100%; height:120px; object-fit:cover; margin-top:10px; border-radius:8px;">` : ''}
                </div>

                <div style="margin-top:25px; display:flex; justify-content:space-between; align-items:center;">
                    ${id ? `<button type="button" class="btn btn-danger-outline btn-sm" onclick="NoticiasAdmin.deletarNoticia('${id}')">🗑️ Excluir</button>` : '<div></div>'}
                    <div style="display:flex; gap:10px;">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-generic').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Salvar Rascunho</button>
                    </div>
                </div>
            </form>
        `;

        modal.style.display = "flex";

        document.getElementById("form-noticia-admin").onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const payload = {
                titulo: fd.get("titulo"),
                conteudo: fd.get("conteudo"),
                capa_url: fd.get("capa_url") || null
            };

            try {
                const url = id ? `/api/noticias/${id}` : "/api/noticias";
                const method = id ? "PUT" : "POST";
                const r = await window.Api.apiFetch(url, { method, body: payload });

                if (r.ok) {
                    modal.style.display = "none";
                    await carregarNoticias();
                } else {
                    const err = await r.json();
                    alert(err.message || "Erro ao salvar notícia.");
                }
            } catch (err) {
                alert("Erro de conexão.");
            }
        };
    }

    async function publicarNoticia(id) {
        if (!confirm("Deseja publicar esta notícia agora? Ela ficará visível para todos.")) return;
        try {
            const r = await window.Api.apiFetch(`/api/noticias/${id}/publicar`, { method: "POST" });
            if (r.ok) {
                await carregarNoticias();
            } else {
                alert("Erro ao publicar.");
            }
        } catch (e) { alert("Erro de conexão."); }
    }

    async function deletarNoticia(id) {
        if (!confirm("Tem certeza que deseja EXCLUIR permanentemente esta notícia?")) return;
        try {
            const r = await window.Api.apiFetch(`/api/noticias/${id}`, { method: "DELETE" });
            if (r.ok) {
                document.getElementById("modal-generic").style.display = "none";
                await carregarNoticias();
            } else {
                alert("Erro ao excluir.");
            }
        } catch (e) { alert("Erro de conexão."); }
    }

    global.NoticiasAdmin = {
        inicializarNoticias,
        abrirModalNoticia,
        publicarNoticia,
        deletarNoticia
    };

})(typeof window !== 'undefined' ? window : global);
