/**
 * Módulo Publicações (Área do Filiado)
 * Carregado como script clássico (window.Publicacoes)
 */

(function (global) {
    if (global.PublicacoesLoaded) return;
    global.PublicacoesLoaded = true;

    let folderStack = [];
    let currentBlobUrl = null;

    async function inicializarPublicacoes(folderId = null) {
        const secPub = document.getElementById("sec-publicacoes");
        if (!secPub) return;

        let container = secPub.querySelector('.section-card');
        if (!container) {
            container = document.createElement('div');
            container.className = 'section-card';
            secPub.appendChild(container);
        }

        container.innerHTML = `<p style="text-align:center; color:#666; padding: 40px;">🔄 Carregando biblioteca...</p>`;

        const { apiFetch } = global.Utils || {};

        try {
            let url = "/api/publicacoes";
            if (folderId) url += `?folderId=${folderId}`;

            const r = await apiFetch(url);
            if (!r.ok) throw new Error("Erro API");
            const lista = await r.json();

            let navHtml = '';
            if (folderId) {
                navHtml = `<div class="nav-bar"><button id="btn-pub-voltar" class="btn-back">⬅️ Voltar</button><span>📂 Subpasta</span></div>`;
            } else {
                folderStack = [];
                navHtml = `<div class="pub-header"><h2>📚 Biblioteca Digital</h2><p>Documentos oficiais do SINPRF-ES</p></div>`;
            }

            if (!lista || lista.length === 0) {
                container.innerHTML = navHtml + `<p style="text-align:center; padding:40px;">Pasta vazia.</p>`;
                configurarVoltar();
                return;
            }

            const cardsHtml = lista.map(item => {
                const isFolder = item.isFolder;
                const icon = isFolder ? '📁' : '📄';
                const btnText = isFolder ? "Abrir Pasta ➡️" : "👁️ Visualizar";
                const dataAttr = isFolder ? `data-folder-id="${item.id}"` : `data-file-id="${item.id}"`;
                const dataFormatada = global.Formatters ? global.Formatters.formatISOToBR(item.data_publicacao) : new Date(item.data_publicacao).toLocaleDateString('pt-BR');

                return `
                    <div class="pub-card" ${dataAttr} style="border:1px solid #ccc; padding:10px; margin-bottom:10px; cursor:pointer;">
                        <div>${icon} <strong>${item.titulo}</strong></div>
                        <small>${dataFormatada}</small>
                        <div style="text-align:right;"><button class="btn btn-sm">${btnText}</button></div>
                    </div>
                `;
            }).join("");

            container.innerHTML = navHtml + `<div class="pub-grid">${cardsHtml}</div>`;

            container.querySelectorAll('.pub-card[data-folder-id]').forEach(card => {
                card.onclick = () => {
                    const idDestino = card.dataset.folderId;
                    folderStack.push(folderId);
                    inicializarPublicacoes(idDestino);
                };
            });

            container.querySelectorAll('.pub-card[data-file-id]').forEach(card => {
                card.onclick = () => {
                    const idArquivo = card.dataset.fileId;
                    alert("Abertura de arquivo via modal seguro (implementação resumida).");
                };
            });

            configurarVoltar();

        } catch (e) {
            container.innerHTML = `<p style="color:red; text-align:center">Erro ao carregar documentos.</p>`;
        }

        function configurarVoltar() {
            const btn = document.getElementById("btn-pub-voltar");
            if (btn) {
                btn.onclick = () => {
                    const idAnterior = folderStack.pop();
                    inicializarPublicacoes(idAnterior);
                };
            }
        }
    }

    global.Publicacoes = {
        inicializarPublicacoes
    };

})(typeof window !== 'undefined' ? window : global);
