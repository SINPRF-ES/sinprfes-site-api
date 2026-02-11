/**
 * Módulo Publicações (Página Inicial)
 * Carregado como script clássico (window.Publicacoes)
 */

(function (global) {
    if (global.Publicacoes) return;

    let folderStack = [];
    let currentBlobUrl = null;

    async function inicializarPublicacoes(folderId = null, options = {}) {
        const { onSelectFile, containerId = "sec-publicacoes", isPicker = false } = options;
        const secPub = document.getElementById(containerId);
        if (!secPub) return;

        let container = isPicker ? secPub : secPub.querySelector('.section-card');
        if (!container) {
            container = document.createElement('div');
            container.className = 'section-card';
            secPub.appendChild(container);
        }

        container.innerHTML = `<p style="text-align:center; color:#666; padding: 40px;">🔄 Carregando biblioteca...</p>`;

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
                    width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
                }
                .doc-download {
                    position: absolute; top: -40px; right: 50px; color: #fff; font-size: 1.5rem; cursor: pointer;
                    width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
                    text-decoration: none;
                }
                .doc-download:hover, .doc-close:hover { color: #ccc; }
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
                        <a id="btn-baixar-modal" class="doc-download" title="Baixar Documento" download="documento.pdf">📥</a>
                        <div class="doc-close" id="btn-fechar-modal" title="Fechar">&times;</div>
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

            document.getElementById('btn-fechar-modal').addEventListener("click", fechar);
            document.getElementById('modal-documento').addEventListener("click", (e) => {
                if(e.target.id === 'modal-documento') fechar();
            });
        }

        async function abrirArquivoSeguro(idArquivo, titulo = "documento") {
            const modal = document.getElementById('modal-documento');
            const loader = document.getElementById('doc-loader');
            const iframe = document.getElementById('iframe-documento');
            const btnBaixar = document.getElementById('btn-baixar-modal');

            modal.classList.add('open');
            loader.style.display = 'flex';
            iframe.style.display = 'none';
            iframe.src = "";
            if (btnBaixar) btnBaixar.style.display = 'none';

            try {
                const res = await window.Api.apiFetch(`/api/publicacoes/arquivo/${idArquivo}`);
                if (!res.ok) throw new Error("Erro API");
                const blob = await res.blob();

                // Detecta tipo para nome do arquivo no download
                const contentType = res.headers.get("content-type") || "";
                const isImage = contentType.startsWith("image/");
                const extension = isImage ? ".jpg" : ".pdf";

                currentBlobUrl = URL.createObjectURL(blob);
                iframe.src = currentBlobUrl;

                if (btnBaixar) {
                    btnBaixar.href = currentBlobUrl;
                    btnBaixar.download = `${titulo}${extension}`;
                    btnBaixar.style.display = 'flex';
                }

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

            const r = await window.Api.apiFetch(url);
            if(!r.ok) throw new Error("Erro API");
            let lista = await r.json();

            // Filtragem de Pastas Técnicas (Apps, Noticias) para não-gestão
            const perfil = (options.perfil || "").toUpperCase();
            const perfisGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"];
            if (!perfisGestao.includes(perfil)) {
                const pastasOcultas = ["APPS", "APP", "NOTICIAS", "NOTÍCIAS", "NOTICIA", "NOTÍCIA"];
                lista = lista.filter(item => {
                    // Ocultar pastas técnicas apenas na raiz, conforme comportamento do App
                    if (item.isFolder && !folderId) {
                        const tituloNorm = (item.titulo || "").toUpperCase().trim();
                        if (pastasOcultas.includes(tituloNorm)) {
                            return false;
                        }
                    }
                    return true;
                });
            }

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
                navHtml = `<div class="pub-header af-standard-header"><h2>📚 Biblioteca Digital</h2><p>Documentos oficiais do FENAPRF</p></div>`;
            }

            if (!lista || lista.length === 0) {
                container.innerHTML = navHtml + `<p style="text-align:center; padding:40px;">Pasta vazia.</p>`;
                configurarVoltar();
                return;
            }

            const cardsHtml = lista.map(item => {
                const isFolder = item.isFolder;
                const icon = isFolder ? '📁' : (item.tipo === 'BALANCO' ? '📊' : '📄');
                let btnText = isFolder ? "Abrir Pasta ➡️" : "👁️ Visualizar Agora";
                if (isPicker && !isFolder) btnText = "✅ Selecionar este PDF";

                const dataAttr = isFolder ? `data-folder-id="${item.id}"` : `data-file-id="${item.id}"`;

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
                card.addEventListener("click", () => {
                    const idDestino = card.dataset.folderId;
                    folderStack.push(folderId);
                    inicializarPublicacoes(idDestino, options);
                });
            });

            container.querySelectorAll('.pub-card[data-file-id]').forEach(card => {
                card.addEventListener("click", () => {
                    const idArquivo = card.dataset.fileId;
                    const titulo = card.querySelector('.pub-title')?.innerText || "documento";
                    const item = lista.find(i => i.id === idArquivo);

                    if (isPicker && onSelectFile) {
                        onSelectFile(item);
                    } else {
                        abrirArquivoSeguro(idArquivo, Utils.normalizeText(titulo).replace(/\s+/g, '_'));
                    }
                });
            });

            configurarVoltar();

        } catch (e) {
            console.error(e);
            container.innerHTML = `<p style="color:red; text-align:center">Erro ao carregar documentos.</p>`;
        }

        function configurarVoltar() {
            const btn = document.getElementById("btn-pub-voltar");
            if (btn) {
                btn.addEventListener("click", () => {
                    const idAnterior = folderStack.pop();
                    inicializarPublicacoes(idAnterior, options);
                });
            }
        }
    }

    global.Publicacoes = {
        inicializarPublicacoes
    };

})(typeof window !== 'undefined' ? window : global);
