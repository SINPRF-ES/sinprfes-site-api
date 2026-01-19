/**
 * Módulo Publicações (Área do Filiado)
 * Carregado como script clássico (window.Publicacoes)
 */

(function (global) {
    if (global.Publicacoes) return;

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

        if (!document.getElementById('style-publicacoes')) {
            const s = document.createElement('style');
            s.id = 'style-publicacoes';
            s.textContent = `
                .pub-header { text-align: center; margin-bottom: 25px; }
                .pub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
                .pub-card {
                    background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px;
                    display: flex; flex-direction: column; transition: all 0.2s; position: relative; cursor: pointer;
                }
                .pub-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
                .pub-card.tipo-PASTA { background: #f8fbff; border-color: #bcd4e6; border-left: 5px solid #003366; }
                .pub-icon { font-size: 2rem; margin-bottom: 10px; }
                .pub-title { font-size: 1.1rem; font-weight: bold; color: #333; margin-bottom: 5px; }
                .pub-meta { font-size: 0.85rem; color: #777; margin-bottom: 15px; }
                .btn-action { margin-top: auto; padding: 8px; border-radius: 5px; text-align: center; font-weight: bold; font-size: 0.9rem; display: block; border: 1px solid #ccc; background: #fff; color: #333; }
                .nav-bar { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; }
                .btn-back { background: #eee; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; color: #555; }
                .doc-modal {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.85); z-index: 9999;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    opacity: 0; pointer-events: none; transition: opacity 0.3s;
                }
                .doc-modal.open { opacity: 1; pointer-events: all; }
                .doc-content {
                    width: 90%; height: 85%; background: #fff; border-radius: 8px; overflow: hidden; position: relative;
                    display: flex; flex-direction: column;
                }
                .doc-iframe { flex: 1; width: 100%; border: none; display: none; }
                .doc-close {
                    position: absolute; top: -40px; right: 0; color: #fff; font-size: 2rem; cursor: pointer;
                }
                .doc-loader {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    display: flex; align-items: center; justify-content: center;
                    flex-direction: column; color: #666;
                }
            `;
            document.head.appendChild(s);
            
            const modalHtml = `
                <div id="modal-documento" class="doc-modal">
                    <div style="position:relative; width:90%; height:90%;">
                        <div class="doc-close" id="btn-fechar-modal">&times;</div>
                        <div class="doc-content">
                            <div id="doc-loader" class="doc-loader">
                                <div style="font-size:2rem; margin-bottom:10px;">⏳</div>
                                <div>Baixando documento com segurança...</div>
                            </div>
                            <iframe id="iframe-documento" class="doc-iframe"></iframe>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            const fechar = () => {
                const modal = document.getElementById('modal-documento');
                const iframe = document.getElementById('iframe-documento');
                modal.classList.remove('open');
                iframe.src = "";
                if (currentBlobUrl) {
                    URL.revokeObjectURL(currentBlobUrl);
                    currentBlobUrl = null;
                }
            };

            document.getElementById('btn-fechar-modal').onclick = fechar;
            document.getElementById('modal-documento').onclick = (e) => {
                if(e.target.id === 'modal-documento') fechar();
            };
        }

        async function abrirArquivoSeguro(idArquivo) {
            const modal = document.getElementById('modal-documento');
            const loader = document.getElementById('doc-loader');
            const iframe = document.getElementById('iframe-documento');

            modal.classList.add('open');
            loader.style.display = 'flex';
            iframe.style.display = 'none';
            iframe.src = "";

            try {
                const res = await apiFetch(`/api/publicacoes/arquivo/${idArquivo}`);
                if (!res.ok) throw new Error("Erro API");
                const blob = await res.blob();
                currentBlobUrl = URL.createObjectURL(blob);
                iframe.src = currentBlobUrl;
                loader.style.display = 'none';
                iframe.style.display = 'block';
            } catch (error) {
                console.error(error);
                alert("Não foi possível carregar o documento.");
                modal.classList.remove('open');
            }
        }

        try {
            let url = "/api/publicacoes";
            if (folderId) url += `?folderId=${folderId}`;

            const r = await apiFetch(url);
            if(!r.ok) throw new Error("Erro API");
            let lista = await r.json();

            // Ordenação Alfabética (Case-Insensitive)
            if (lista && Array.isArray(lista)) {
                lista.sort((a, b) => {
                    const nameA = (a.titulo || "").toLowerCase();
                    const nameB = (b.titulo || "").toLowerCase();
                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;
                    return 0;
                });
            }

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
                const icon = isFolder ? '📁' : (item.tipo === 'BALANCO' ? '📊' : '📄');
                const btnText = isFolder ? "Abrir Pasta ➡️" : "👁️ Visualizar Agora";
                const dataAttr = isFolder ? `data-folder-id="${item.id}"` : `data-file-id="${item.id}"`;

                // Removida a exibição da data (pub-meta) conforme solicitado

                return `
                    <div class="pub-card tipo-${item.tipo}" ${dataAttr}>
                        <div class="pub-icon">${icon}</div>
                        <h3 class="pub-title">${item.titulo}</h3>
                        <div class="btn-action">${btnText}</div>
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
                    abrirArquivoSeguro(idArquivo);
                };
            });

            configurarVoltar();

        } catch (e) {
            console.error(e);
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
