/**
 * Módulo Publicações (Página Inicial)
 * Carregado como script clássico (window.Publicacoes)
 */

(function (global) {
    if (global.Publicacoes) return;

    let folderStack = [];
    let currentBlobUrl = null;
    let currentFolderId = null;
    let currentOptions = {};

    async function inicializarPublicacoes(folderId = null, options = {}) {
        currentFolderId = folderId;
        currentOptions = options;
        const { onSelectFile, containerId = "sec-publicacoes", isPicker = false } = options;
        const secPub = document.getElementById(containerId);
        if (!secPub) return;

        let container = isPicker ? secPub : secPub.querySelector('.section-card');
        if (!container) {
            container = document.createElement('div');
            container.className = 'section-card';
            secPub.appendChild(container);
        }

        const perfil = (options.perfil || localStorage.getItem("perfil_acesso") || "").toUpperCase();
        const perfisGestao = ["ADMIN", "DIRETORIA", "COLABORADOR"];
        const ehGestao = perfisGestao.includes(perfil);

        container.innerHTML = `<p style="text-align:center; color:#666; padding: 40px;">🔄 Carregando biblioteca...</p>`;

        if (!document.getElementById('style-publicacoes')) {
            const s = document.createElement('style');
            s.id = 'style-publicacoes';
            s.textContent = `
                .pub-header { text-align: center; margin-bottom: 25px; }
                .pub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
                .pub-card {
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 15px; padding: 20px;
                    display: flex; flex-direction: column; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative; cursor: pointer;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                }
                .pub-card:hover { transform: translateY(-5px); box-shadow: 0 12px 25px rgba(0,0,0,0.1); border-color: var(--azul-header); }
                .pub-card.tipo-PASTA { border-left: 6px solid #FFCA28; }
                .pub-icon { font-size: 2.5rem; margin-bottom: 15px; text-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                .pub-title { font-size: 1.1rem; font-weight: bold; color: var(--azul-fundo); margin-bottom: 5px; line-height: 1.3; }
                .pub-meta { font-size: 0.8rem; color: #555; margin-top: 5px; }

                .btn-action {
                    margin-top: 15px; padding: 10px; border-radius: 8px; text-align: center;
                    font-weight: bold; font-size: 0.9rem; display: block;
                    border: 1px solid var(--azul-header); background: rgba(0, 51, 102, 0.05); color: var(--azul-header);
                    transition: all 0.2s;
                }
                .pub-card:hover .btn-action { background: var(--azul-header); color: #fff; }

                .nav-bar { display: flex; gap: 15px; margin-bottom: 25px; align-items: center; flex-wrap: wrap; }
                .btn-back {
                    background: #fff; border: 1px solid #ddd; padding: 10px 18px; border-radius: 10px;
                    cursor: pointer; font-weight: bold; color: #555; display: flex; align-items: center; gap: 8px;
                    transition: all 0.2s;
                }
                .btn-back:hover { background: #f5f5f5; border-color: #ccc; }

                .gestao-actions { display: flex; gap: 10px; margin-left: auto; }
                .btn-gestao-top {
                    padding: 10px 18px; border-radius: 10px; font-weight: bold; border: none; cursor: pointer;
                    display: flex; align-items: center; gap: 8px; transition: all 0.2s;
                }
                .btn-nova-pasta { background: #FFCA28; color: #333; }
                .btn-upload { background: var(--azul-header); color: #fff; }
                .btn-gestao-top:hover { opacity: 0.9; transform: scale(1.02); }

                /* Menu de contexto / ellipsis */
                .pub-menu-btn {
                    position: absolute; top: 10px; right: 10px; width: 32px; height: 32px;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 50%; color: var(--azul-header); font-size: 1.1rem; transition: all 0.2s;
                    z-index: 5; background: rgba(255,255,255,0.8);
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                .pub-menu-btn:hover { background: rgba(0,0,0,0.05); color: var(--azul-header); }

                /* Modal de Documento */
                .doc-modal {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.85); z-index: 9999;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    opacity: 0; pointer-events: none; transition: opacity 0.3s;
                }
                .doc-modal.open { opacity: 1; pointer-events: all; }
                .doc-content {
                    width: 90%; height: 85%; background: #fff; border-radius: 12px; overflow: hidden; position: relative;
                    display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.5);
                }
                .doc-iframe { flex: 1; width: 100%; border: none; display: none; }
                .doc-close {
                    position: absolute; top: -45px; right: 0; color: #fff; font-size: 2.5rem; cursor: pointer;
                    width: 45px; height: 45px; display: flex; align-items: center; justify-content: center;
                }
                .doc-download {
                    position: absolute; top: -45px; right: 55px; color: #fff; font-size: 1.8rem; cursor: pointer;
                    width: 45px; height: 45px; display: flex; align-items: center; justify-content: center;
                    text-decoration: none;
                }
                .doc-download:hover, .doc-close:hover { color: #ffc107; }
                .doc-loader {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    display: flex; align-items: center; justify-content: center;
                    flex-direction: column; color: #666; background: #fff;
                }

                /* Seletor de Pastas (Mover) */
                .folder-selector-list {
                    max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 8px; margin: 15px 0;
                }
                .folder-item {
                    padding: 12px 15px; display: flex; align-items: center; gap: 10px; cursor: pointer;
                    border-bottom: 1px solid #f9f9f9; transition: background 0.2s;
                }
                .folder-item:hover { background: #f0f7ff; }
                .folder-item.selected { background: #e3f2fd; font-weight: bold; border-left: 4px solid var(--azul-header); }
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

            // Filtragem de Pastas Técnicas (Apps, Noticias, Lixeira) para não-gestão
            const pastasOcultas = ["APPS", "APP", "NOTICIAS", "NOTÍCIAS", "NOTICIA", "NOTÍCIA", "LIXEIRA"];
            lista = lista.filter(item => {
                if (item.hidden) return false;
                // Ocultar pastas técnicas apenas na raiz, conforme comportamento do App
                if (!folderId) {
                    const tituloNorm = (item.name || item.titulo || "").toUpperCase().trim();
                    if (pastasOcultas.includes(tituloNorm)) {
                        return ehGestao; // Só mostra se for gestor
                    }
                }
                return true;
            });

            // Ordenação: Pastas primeiro, depois arquivos. Ambos alfabéticos.
            lista.sort((a, b) => {
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                const nameA = (a.name || a.titulo || "").toLowerCase();
                const nameB = (b.name || b.titulo || "").toLowerCase();
                return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
            });

            let navHtml = '';
            let gestaoHeaderHtml = '';

            if (ehGestao && !isPicker) {
                gestaoHeaderHtml = `
                    <div class="gestao-actions">
                        <button id="btn-nova-pasta" class="btn-gestao-top btn-nova-pasta">📁 Nova Pasta</button>
                        <button id="btn-upload-pub" class="btn-gestao-top btn-upload">📤 Enviar Arquivo</button>
                    </div>
                `;
            }

            if (folderId) {
                navHtml = `
                    <div class="nav-bar">
                        <button id="btn-pub-voltar" class="btn-back">⬅️ Voltar</button>
                        <span style="font-weight:bold; color:var(--azul-header); font-size:1.1rem;">📂 Subpasta</span>
                        ${gestaoHeaderHtml}
                    </div>`;
            } else {
                folderStack = [];
                navHtml = `
                    <div class="pub-header af-standard-header">
                        <h2>📚 Biblioteca Digital</h2>
                        <p>Documentos oficiais do FENAPRF</p>
                    </div>
                    <div class="nav-bar">
                        <span style="color:#666; font-size:0.9rem;">${ehGestao ? 'Modo Gestão Ativo' : 'Visualizando biblioteca pública'}</span>
                        ${gestaoHeaderHtml}
                    </div>
                `;
            }

            if (!lista || lista.length === 0) {
                container.innerHTML = navHtml + `<div class="user-card-v3" style="text-align:center; padding:60px; color:#666;">
                    <div style="font-size:3rem; margin-bottom:15px;">📁</div>
                    <p>Esta pasta está vazia.</p>
                </div>`;
                configurarVoltar();
                configurarGestaoTop();
                return;
            }

            const cardsHtml = lista.map(item => {
                const isFolder = item.isFolder;
                const icon = isFolder ? '📁' : (item.tipo === 'BALANCO' ? '📊' : '📄');
                let btnText = isFolder ? "Abrir Pasta ➡️" : "👁️ Visualizar Agora";
                if (isPicker && !isFolder) btnText = "✅ Selecionar este PDF";

                const dataAttr = isFolder ? `data-folder-id="${item.id}"` : `data-file-id="${item.id}"`;
                const titulo = item.name || item.titulo || "Sem título";

                const isProtected = item.hidden || (!folderId && ["App", "Lixeira"].includes(item.name));

                return `
                    <div class="pub-card tipo-${item.tipo || (isFolder ? 'PASTA' : 'DOC')}" ${dataAttr} data-name="${global.Utils?.escapeHTML(titulo)}">
                        ${ehGestao && !isPicker ? `
                            <div class="pub-menu-btn" data-id="${item.id}" data-is-protected="${isProtected}" title="Opções">
                                <i class="fas fa-ellipsis-v"></i>
                            </div>
                        ` : ''}
                        <div class="pub-icon">${icon}</div>
                        <h3 class="pub-title">${titulo}</h3>
                        <div class="pub-meta">${isFolder ? 'Pasta de arquivos' : (item.createdTime ? global.Formatters?.formatISOToBR(item.createdTime) : 'Documento oficial')}</div>
                        <div class="btn-action">${btnText}</div>
                    </div>
                `;
            }).join("");

            container.innerHTML = navHtml + `<div class="pub-grid">${cardsHtml}</div>`;

            // Handlers de Clique
            container.querySelectorAll('.pub-card[data-folder-id]').forEach(card => {
                card.addEventListener("click", (e) => {
                    if (e.target.closest('.pub-menu-btn')) return;
                    const idDestino = card.dataset.folderId;
                    folderStack.push(folderId);
                    inicializarPublicacoes(idDestino, options);
                });
            });

            container.querySelectorAll('.pub-card[data-file-id]').forEach(card => {
                card.addEventListener("click", (e) => {
                    if (e.target.closest('.pub-menu-btn')) return;
                    const idArquivo = card.dataset.fileId;
                    const titulo = card.dataset.name || "documento";
                    const item = lista.find(i => i.id === idArquivo);

                    if (isPicker && onSelectFile) {
                        onSelectFile(item);
                    } else {
                        abrirArquivoSeguro(idArquivo, Utils.normalizeText(titulo).replace(/\s+/g, '_'));
                    }
                });
            });

            // Menu de Contexto
            container.querySelectorAll('.pub-menu-btn').forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const name = btn.closest('.pub-card').dataset.name;
                    const isProtected = btn.dataset.isProtected === 'true';

                    abrirOpcoesItem(id, name, isProtected);
                });
            });

            configurarVoltar();
            configurarGestaoTop();

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

        function configurarGestaoTop() {
            const btnPasta = document.getElementById("btn-nova-pasta");
            if (btnPasta) btnPasta.onclick = handleNovaPasta;

            const btnUpload = document.getElementById("btn-upload-pub");
            if (btnUpload) btnUpload.onclick = handleUploadArquivo;
        }
    }

    // --- Ações de Gestão ---

    async function handleNovaPasta() {
        const nome = prompt("Nome da nova pasta:");
        if (!nome || !nome.trim()) return;

        try {
            const r = await window.Api.apiFetch('/api/publicacoes/folders', {
                method: 'POST',
                body: { name: nome.trim(), parentFolderId: currentFolderId || 'ROOT' }
            });
            if (r.ok) {
                alert("Pasta criada com sucesso.");
                inicializarPublicacoes(currentFolderId, currentOptions);
            } else {
                const data = await r.json();
                alert(data.message || "Erro ao criar pasta.");
            }
        } catch (e) { alert("Erro de conexão."); }
    }

    async function handleUploadArquivo() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,image/*';

        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;

            const fd = new FormData();
            fd.append('file', file);
            fd.append('parentFolderId', currentFolderId || 'ROOT');

            try {
                const btn = document.getElementById("btn-upload-pub");
                const oldText = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = "⏳ Enviando...";

                const r = await window.Api.apiFetch('/api/publicacoes/upload', {
                    method: 'POST',
                    body: fd
                });

                if (r.ok) {
                    alert("Arquivo enviado com sucesso.");
                    inicializarPublicacoes(currentFolderId, currentOptions);
                } else {
                    const data = await r.json();
                    alert(data.message || "Erro no upload.");
                }
            } catch (e) { alert("Erro de conexão."); }
            finally {
                const btn = document.getElementById("btn-upload-pub");
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = "📤 Enviar Arquivo";
                }
            }
        };
        input.click();
    }

    function abrirOpcoesItem(id, name, isProtected) {
        const opcs = [
            { label: '📂 Abrir / Visualizar', action: () => document.querySelector(`.pub-card[data-folder-id="${id}"], .pub-card[data-file-id="${id}"]`).click() }
        ];

        if (!isProtected) {
            opcs.push({ label: '✏️ Renomear', action: () => handleRenomear(id, name) });
            opcs.push({ label: '🚚 Mover para...', action: () => handleMover(id, name) });
            opcs.push({ label: '🗑️ Excluir (Lixeira)', action: () => handleExcluir(id, name), danger: true });
        }

        const html = `
            <div style="display:flex; flex-direction:column; gap:10px; padding: 10px 0;">
                <p style="margin-bottom:10px; font-weight:bold; color:#666;">Item: ${name}</p>
                ${opcs.map(o => `
                    <button class="btn ${o.danger ? 'btn-danger-outline' : 'btn-outline'}" style="text-align:left; justify-content:flex-start; width:100%;" id="btn-opt-${id}-${opcs.indexOf(o)}">
                        ${o.label}
                    </button>
                `).join('')}
            </div>
        `;

        global.Utils?.abrirModalGenerico("Ações do Item", html);

        opcs.forEach((o, idx) => {
            const btn = document.getElementById(`btn-opt-${id}-${idx}`);
            if (btn) btn.onclick = () => {
                global.Utils?.fecharModalGenerico();
                o.action();
            };
        });
    }

    async function handleRenomear(id, oldName) {
        const novoNome = prompt("Novo nome para o item:", oldName);
        if (!novoNome || !novoNome.trim() || novoNome === oldName) return;

        try {
            const r = await window.Api.apiFetch(`/api/publicacoes/items/${id}/rename`, {
                method: 'PATCH',
                body: { name: novoNome.trim() }
            });
            if (r.ok) {
                inicializarPublicacoes(currentFolderId, currentOptions);
            } else {
                const data = await r.json();
                alert(data.message || "Erro ao renomear.");
            }
        } catch (e) { alert("Erro de conexão."); }
    }

    async function handleExcluir(id, name) {
        if (!confirm(`Deseja realmente mover "${name}" para a lixeira?\n\nEle sairá desta listagem imediatamente.`)) return;

        try {
            const r = await window.Api.apiFetch(`/api/publicacoes/items/${id}/delete`, {
                method: 'POST'
            });
            if (r.ok) {
                inicializarPublicacoes(currentFolderId, currentOptions);
            } else {
                const data = await r.json();
                alert(data.message || "Erro ao excluir (Mover para Lixeira).");
            }
        } catch (e) {
            console.error("ExcluirErro", e);
            alert("Erro de conexão ao excluir.");
        }
    }

    async function handleMover(id, name) {
        let selectedFolderId = 'ROOT';
        let tempStack = [{ id: 'ROOT', name: 'Início / Biblioteca' }];

        async function carregarPastas(folderId) {
            const targetId = folderId === 'ROOT' ? null : folderId;
            let url = "/api/publicacoes";
            if (targetId) url += `?folderId=${targetId}`;

            const r = await window.Api.apiFetch(url);
            if (!r.ok) return [];
            const data = await r.json();
            return data.filter(i => i.isFolder && i.id !== id);
        }

        async function renderizarSeletor(activeFolder) {
            const pastas = await carregarPastas(activeFolder.id);
            selectedFolderId = activeFolder.id;

            const html = `
                <div style="padding: 10px 0;">
                    <div style="background:#eef2f7; padding:12px; border-radius:8px; margin-bottom:15px; font-size:0.9rem;">
                        <strong>Local selecionado:</strong> ${activeFolder.name}
                    </div>

                    <div class="folder-selector-list">
                        ${tempStack.length > 1 ? `
                            <div class="folder-item" id="btn-mover-voltar" style="color:var(--azul-header); font-weight:bold; background:#f5f5f5;">
                                ⬅️ Voltar nível
                            </div>
                        ` : ''}

                        ${pastas.length === 0 ? '<p style="padding:20px; text-align:center; color:#999;">Nenhuma subpasta encontrada.</p>' :
                          pastas.map(p => `
                            <div class="folder-item" data-id="${p.id}" data-name="${p.name || p.titulo}">
                                📁 ${p.name || p.titulo}
                            </div>
                        `).join('')}
                    </div>

                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button class="btn btn-outline" id="btn-mover-cancelar" style="flex:1;">Cancelar</button>
                        <button class="btn btn-primary" id="btn-mover-confirmar" style="flex:2;">Mover para aqui</button>
                    </div>
                </div>
            `;

            global.Utils?.abrirModalGenerico(`Mover "${name}"`, html);

            document.querySelectorAll('.folder-item[data-id]').forEach(item => {
                item.onclick = () => {
                    tempStack.push({ id: item.dataset.id, name: item.dataset.name });
                    renderizarSeletor(tempStack[tempStack.length - 1]);
                };
            });

            const btnVoltar = document.getElementById("btn-mover-voltar");
            if (btnVoltar) btnVoltar.onclick = () => {
                tempStack.pop();
                renderizarSeletor(tempStack[tempStack.length - 1]);
            };

            const btnConfirmar = document.getElementById("btn-mover-confirmar");
            if (btnConfirmar) btnConfirmar.onclick = async () => {
                try {
                    btnConfirmar.disabled = true;
                    btnConfirmar.innerText = "⏳ Movendo...";
                    const res = await window.Api.apiFetch(`/api/publicacoes/items/${id}/move`, {
                        method: 'PATCH',
                        body: { targetFolderId: selectedFolderId }
                    });
                    if (res.ok) {
                        global.Utils?.fecharModalGenerico();
                        inicializarPublicacoes(currentFolderId, currentOptions);
                    } else {
                        const data = await res.json();
                        alert(data.message || "Erro ao mover item.");
                        btnConfirmar.disabled = false;
                        btnConfirmar.innerText = "Mover para aqui";
                    }
                } catch (e) { alert("Erro de conexão."); }
            };

            const btnCancel = document.getElementById("btn-mover-cancelar");
            if (btnCancel) btnCancel.onclick = () => global.Utils?.fecharModalGenerico();
        }

        renderizarSeletor(tempStack[0]);
    }

    global.Publicacoes = {
        inicializarPublicacoes
    };

})(typeof window !== 'undefined' ? window : global);
