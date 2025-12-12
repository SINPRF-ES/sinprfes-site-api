import { apiFetch } from './utils.js';

let folderStack = []; 
let currentBlobUrl = null; // Variável para limpar memória depois

export async function inicializarPublicacoes(folderId = null) {
    const secPub = document.getElementById("sec-publicacoes");
    if (!secPub) return;

    let container = secPub.querySelector('.section-card');
    if (!container) {
        container = document.createElement('div');
        container.className = 'section-card';
        secPub.appendChild(container);
    }

    // Loader inicial da lista
    container.innerHTML = `<p style="text-align:center; color:#666; padding: 40px;">🔄 Carregando biblioteca...</p>`;

    // 1. CSS DO MODAL E CARDS
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
            
            /* Cores por tipo */
            .pub-card.tipo-PASTA { background: #f8fbff; border-color: #bcd4e6; border-left: 5px solid #003366; }
            .pub-card.tipo-ATA { border-left: 5px solid #003366; }
            .pub-card.tipo-NOTA { border-left: 5px solid #ffc107; }
            .pub-card.tipo-BALANCO { border-left: 5px solid #27ae60; }
            .pub-card.tipo-OUTROS { border-left: 5px solid #95a5a6; }

            .pub-icon { font-size: 2rem; margin-bottom: 10px; }
            .pub-title { font-size: 1.1rem; font-weight: bold; color: #333; margin-bottom: 5px; }
            .pub-meta { font-size: 0.85rem; color: #777; margin-bottom: 15px; }
            .btn-action { margin-top: auto; padding: 8px; border-radius: 5px; text-align: center; font-weight: bold; font-size: 0.9rem; display: block; border: 1px solid #ccc; background: #fff; color: #333; }
            .btn-action:hover { background: #003366; color: #fff; border-color: #003366; }

            .nav-bar { display: flex; gap: 10px; margin-bottom: 20px; align-items: center; }
            .btn-back { background: #eee; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; color: #555; }

            /* --- MODAL --- */
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
            .doc-iframe { flex: 1; width: 100%; border: none; display: none; } /* Começa oculto */
            
            .doc-close {
                position: absolute; top: -40px; right: 0; color: #fff; font-size: 2rem; cursor: pointer;
            }
            /* Loader dentro do modal */
            .doc-loader {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                display: flex; align-items: center; justify-content: center;
                flex-direction: column; color: #666;
            }
        `;
        document.head.appendChild(s);
        
        // HTML do Modal
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
        
        // Fechar Modal
        const fechar = () => {
            const modal = document.getElementById('modal-documento');
            const iframe = document.getElementById('iframe-documento');
            
            modal.classList.remove('open');
            iframe.src = ""; // Para o carregamento
            
            // Limpa memória do navegador
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
                currentBlobUrl = null;
            }
        };

        document.getElementById('btn-fechar-modal').addEventListener('click', fechar);
        document.getElementById('modal-documento').addEventListener('click', (e) => {
            if(e.target.id === 'modal-documento') fechar();
        });
    }

    // 🟢 FUNÇÃO SEGURA DE CARREGAMENTO
    async function abrirArquivoSeguro(idArquivo) {
        const modal = document.getElementById('modal-documento');
        const loader = document.getElementById('doc-loader');
        const iframe = document.getElementById('iframe-documento');

        // 1. Abre o modal mostrando o loader
        modal.classList.add('open');
        loader.style.display = 'flex';
        iframe.style.display = 'none';
        iframe.src = "";

        try {
            // 2. Faz o fetch autenticado (com Token)
            const res = await apiFetch(`/api/publicacoes/arquivo/${idArquivo}`);
            
            if (!res.ok) throw new Error("Erro ao baixar arquivo (401/404)");

            // 3. Converte a resposta em um "Arquivo na Memória" (Blob)
            const blob = await res.blob();
            
            // 4. Cria uma URL temporária para esse Blob
            currentBlobUrl = URL.createObjectURL(blob);

            // 5. Coloca no iframe e exibe
            iframe.src = currentBlobUrl;
            loader.style.display = 'none';
            iframe.style.display = 'block';

        } catch (error) {
            console.error(error);
            alert("Não foi possível carregar o documento. Verifique sua conexão.");
            modal.classList.remove('open'); // Fecha se der erro
        }
    }

    // --- CARREGAMENTO DA LISTA ---
    try {
        let url = "/api/publicacoes";
        if (folderId) url += `?folderId=${folderId}`;

        const r = await apiFetch(url);
        if(!r.ok) throw new Error("Erro API");
        const lista = await r.json();

        // Navegação
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

        // Renderiza Cards
        const cardsHtml = lista.map(item => {
            const isFolder = item.isFolder;
            const icon = isFolder ? '📁' : (item.tipo === 'BALANCO' ? '📊' : '📄');
            const btnText = isFolder ? "Abrir Pasta ➡️" : "👁️ Visualizar Agora";
            
            // Atributos de dados
            const dataAttr = isFolder ? `data-folder-id="${item.id}"` : `data-file-id="${item.id}"`;
            const dataFormatada = new Date(item.data_publicacao).toLocaleDateString('pt-BR');

            return `
                <div class="pub-card tipo-${item.tipo}" ${dataAttr}>
                    <div class="pub-icon">${icon}</div>
                    <h3 class="pub-title">${item.titulo}</h3>
                    <span class="pub-meta">${dataFormatada}</span>
                    <div class="btn-action">${btnText}</div>
                </div>
            `;
        }).join("");

        container.innerHTML = navHtml + `<div class="pub-grid">${cardsHtml}</div>`;

        // --- LISTENERS ---
        
        // 1. Clique em PASTA
        container.querySelectorAll('.pub-card[data-folder-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                const idDestino = card.dataset.folderId;
                folderStack.push(folderId);
                inicializarPublicacoes(idDestino);
            });
        });

        // 2. Clique em ARQUIVO (Chama a função segura)
        container.querySelectorAll('.pub-card[data-file-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                const idArquivo = card.dataset.fileId;
                abrirArquivoSeguro(idArquivo); // 🟢 Usa o fetch com token!
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
                inicializarPublicacoes(idAnterior);
            });
        }
    }
}