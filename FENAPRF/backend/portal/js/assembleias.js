/**
 * Módulo Assembleias e Votações (Página Inicial)
 * Carregado como script clássico (window.Assembleias)
 */

(function (global) {
    if (global.Assembleias) return;

    let pollingInterval = null;
    let currentAssembleiaId = null;
    let currentFiltro = 'ATIVAS';
    let currentUserPerfil = 'USER';
    let currentUserId = null;
    let currentBlobUrl = null;
    let selectedDriveFile = null;
    let currentPresentes = [];

    async function inicializarAssembleias(perfil) {
        currentUserPerfil = perfil;
        const userInfo = window.Utils.obterUserInfo();
        currentUserId = userInfo.id || userInfo.sub;

        ensureModalDocumento();
        renderizarEstruturaBase();
        await carregarListaAssembleias();
    }

    function ensureModalDocumento() {
        if (document.getElementById('modal-documento')) return;

        const s = document.createElement('style');
        s.id = 'style-modal-documento';
        s.textContent = `
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
            const btnBaixar = document.getElementById('btn-baixar-modal');
            modal.classList.remove('open');
            iframe.src = "";
            if (btnBaixar) btnBaixar.href = "#";
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
                currentBlobUrl = null;
            }
        };

        const btnFechar = document.getElementById('btn-fechar-modal');
        if (btnFechar) {
            btnFechar.addEventListener('click', fechar);
        }

        const modalEl = document.getElementById('modal-documento');
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                if(e.target.id === 'modal-documento') fechar();
            });
        }
    }

    async function baixarEditalSeguro(idAssembleia) {
        try {
            const res = await window.Api.apiFetch(`/api/assembleias/${idAssembleia}/edital`);
            if (!res.ok) throw new Error("Erro API ao baixar edital");
            const blob = await res.blob();
            const contentType = res.headers.get("content-type") || "";
            const isImage = contentType.startsWith("image/");
            const extension = isImage ? ".jpg" : ".pdf";
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.download = `edital_${idAssembleia}${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Pequeno delay para revogar o objeto
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (error) {
            console.error(error);
            alert("Não foi possível baixar o edital.");
        }
    }

    async function abrirEditalSeguro(idAssembleia) {
        const modal = document.getElementById('modal-documento');
        const loader = document.getElementById('doc-loader');
        const iframe = document.getElementById('iframe-documento');
        const btnBaixar = document.getElementById('btn-baixar-modal');

        if (!modal) {
            ensureModalDocumento();
            return abrirEditalSeguro(idAssembleia);
        }

        modal.classList.add('open');
        loader.style.display = 'flex';
        iframe.style.display = 'none';
        iframe.src = "";
        if (btnBaixar) btnBaixar.style.display = 'none';

        try {
            const res = await window.Api.apiFetch(`/api/assembleias/${idAssembleia}/edital`);
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
                btnBaixar.download = `edital_${idAssembleia}${extension}`;
                btnBaixar.style.display = 'flex';
            }

            loader.style.display = 'none';
            iframe.style.display = 'block';
        } catch (error) {
            console.error(error);
            alert("Não foi possível carregar o edital.");
            modal.classList.remove('open');
        }
    }

    function renderizarEstruturaBase() {
        const section = document.getElementById("sec-assembleias");
        const ehGestao = window.Utils.isGestao(currentUserPerfil);

        section.innerHTML = `
            <div id="sec-assembleias-lista">
                <div class="section-card">
                    <div class="af-standard-header" style="display:flex; flex-direction:column; align-items:center; gap:15px; text-align:center;">
                        <h2 style="margin:0; font-size:1.8rem; font-weight: 800;">🗳️ Assembleias e Votações</h2>
                        <p style="margin:0; font-size:1rem;">Participe das decisões institucionais</p>

                        ${ehGestao ? `
                            <button id="btn-abrir-criacao-ass" class="btn btn-success" style="margin-top:10px; font-weight:800; padding:12px 25px; border-radius:30px;">➕ Criar Nova Assembleia</button>
                        ` : ''}

                        <div style="width:100%; max-width:250px; margin-top:10px;">
                            <label style="font-size:0.85rem; color:#fff; display:block; margin-bottom:6px; font-weight:700; text-transform:uppercase;">Filtrar por status:</label>
                            <select id="filtro-assembleias" class="btn btn-outline" style="width:100%; color:#fff; background:transparent; border: 2px solid #fff; border-radius:8px; font-weight:600;">
                                <option value="ATIVAS" style="color:#333;">Ativas</option>
                                <option value="ENCERRADAS" style="color:#333;">Encerradas</option>
                                <option value="TODAS" style="color:#333;">Todas</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div id="area-assembleias-lista" style="margin-top:25px;">
                    <p class="text-center" style="color:#fff;">Carregando assembleias...</p>
                </div>
            </div>

            <div id="sec-assembleias-criar" style="display:none;">
                <div id="area-assembleia-criar-conteudo"></div>
            </div>

            <div id="sec-assembleias-detalhe" style="display:none;">
                <div id="area-assembleia-detalhe-conteudo"></div>
            </div>

            <div id="sec-assembleias-sala" style="display:none;">
                <div id="area-assembleia-sala-conteudo"></div>
            </div>
        `;

        const btnCriar = document.getElementById("btn-abrir-criacao-ass");
        if (btnCriar) btnCriar.addEventListener("click", () => abrirCriacao());

        const selectFiltro = document.getElementById("filtro-assembleias");
        if (selectFiltro) selectFiltro.addEventListener("change", (e) => mudarFiltro(e.target.value));
    }

    async function mudarFiltro(novoFiltro) {
        currentFiltro = novoFiltro;
        await carregarListaAssembleias();
    }

    async function carregarListaAssembleias() {
        const container = document.getElementById("area-assembleias-lista");
        if (!container) return;

        container.innerHTML = "<p class='text-center' style='padding:40px; color:#ccc;'>Carregando assembleias...</p>";

        try {
            const r = await window.Api.apiFetch("/api/assembleias");
            let assembleias = await r.json();

            if (!assembleias || !assembleias.length) {
                container.innerHTML = "<p class='text-center' style='padding:40px; color:#ccc;'>Nenhuma assembleia encontrada.</p>";
                return;
            }

            if (currentFiltro === 'ATIVAS') {
                assembleias = assembleias.filter(a => ['CRIADO', 'EM_CREDENCIAMENTO', 'INICIADO', 'SUSPENSA'].includes(a.estado));
            } else if (currentFiltro === 'ENCERRADAS') {
                assembleias = assembleias.filter(a => a.estado === 'ENCERRADO');
            }

            const ordem = { 'INICIADO': 0, 'EM_CREDENCIAMENTO': 1, 'SUSPENSA': 2, 'CRIADO': 3, 'ENCERRADO': 4 };
            assembleias.sort((a, b) => (ordem[a.estado] ?? 99) - (ordem[b.estado] ?? 99));

            renderizarLista(assembleias, container);
        } catch (err) {
            console.error("Erro ao carregar assembleias:", err);
            container.innerHTML = "<p class='text-center' style='color:#ff6b6b; padding:40px;'>Erro ao carregar assembleias.</p>";
        }
    }

    function renderizarLista(assembleias, container) {
        if (!assembleias.length) {
            container.innerHTML = "<p class='text-center' style='padding:40px; color:#ccc;'>Nenhuma assembleia nesta categoria.</p>";
            return;
        }

        if (!container._hasListener) {
            container.addEventListener("click", (e) => {
                const btn = e.target.closest(".btn-ass-detalhes");
                if (btn) abrirDetalhes(btn.dataset.id);
            });
            container._hasListener = true;
        }

        container.innerHTML = assembleias.map(a => {
            const label = window.AssembleiaUtils.getStatusLabel(a.estado);
            const emoji = window.AssembleiaUtils.getStatusEmoji(a.estado);
            const dataBr = window.Formatters.formatISOToBR(a.data_evento);

            // Cores baseadas no status para melhor contraste
            let badgeStyle = "background:#eef2f7; color:#003366;";
            if (a.estado === 'INICIADO') badgeStyle = "background:#fff3cd; color:#856404; border: 1px solid #ffeeba;";
            if (a.estado === 'EM_CREDENCIAMENTO') badgeStyle = "background:#d1e7dd; color:#0f5132; border: 1px solid #badbcc;";
            if (a.estado === 'ENCERRADO') badgeStyle = "background:#f8d7da; color:#842029; border: 1px solid #f5c2c7;";
            if (a.estado === 'SUSPENSA') badgeStyle = "background:#e2e3e5; color:#333; border: 1px solid #d6d8db;";

            return `
                <div class="section-card user-card" style="margin-bottom:25px; background:#fff; border-top:5px solid #003366; transition:all 0.3s; box-shadow: 0 10px 20px rgba(0,0,0,0.1); padding: 30px; color:#333; border-radius:15px; text-align:center;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:15px;">
                        <div>
                            <span class="user-badge" style="${badgeStyle} font-weight:800; padding:8px 16px; border-radius:20px; font-size:0.8rem; text-transform:uppercase;">${label}</span>
                        </div>

                        <h3 style="margin:0; color:#003366; font-size:1.6rem; font-weight:900; line-height:1.3;">${emoji} ${a.tipo} - ${a.titulo}</h3>

                        <div style="margin-top:5px; font-size:1.1rem; color:#555; display:flex; gap:25px; flex-wrap:wrap; font-weight:600; justify-content:center;">
                            <span style="display:flex; align-items:center; gap:8px;">📅 Data: <span style="color:#003366;">${dataBr}</span></span>
                            <span style="display:flex; align-items:center; gap:8px;">🕒 Horário: <span style="color:#003366;">${a.hora_primeira_chamada || '--:--'}</span></span>
                        </div>

                        <div style="margin-top:15px;">
                            <button class="btn btn-primary btn-lg btn-ass-detalhes" style="padding: 15px 40px; font-weight: 800; border-radius: 30px; box-shadow: 0 5px 15px rgba(241, 196, 15, 0.4);" data-id="${a.id}">Ver Detalhes e Participar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    async function abrirDetalhes(id) {
        currentAssembleiaId = id;
        document.getElementById("sec-assembleias-lista").style.display = "none";
        document.getElementById("sec-assembleias-detalhe").style.display = "block";
        document.getElementById("sec-assembleias-sala").style.display = "none";

        await carregarDetalhesAssembleia(id);
    }

    async function carregarDetalhesAssembleia(id) {
        const container = document.getElementById("area-assembleia-detalhe-conteudo");

        if (!container._hasListener) {
            container.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-action]");
                if (!btn) return;

                const action = btn.dataset.action;
                const aid = btn.dataset.aid || currentAssembleiaId;
                const vid = btn.dataset.vid;
                const prid = btn.dataset.prid;
                const pid = btn.dataset.pid;
                const val = btn.dataset.value;

                if (action === "voltar-lista") voltarParaLista();
                else if (action === "abrir-edital") abrirEditalSeguro(aid);
                else if (action === "baixar-edital") baixarEditalSeguro(aid);
                else if (action === "abrir-ass") abrirAssembleia(aid);
                else if (action === "preparar-mesa") prepararMesa(aid);
                else if (action === "gerar-token-global") gerarTokenGlobal(aid);
                else if (action === "gerar-token-quorum") gerarTokenQuorum(aid);
                else if (action === "iniciar-execucao") iniciarExecucao(aid);
                else if (action === "solicitar-recontagem") solicitarRecontagem(aid);
                else if (action === "encerrar-ass") encerrarAssembleia(aid);
                else if (action === "solicitar-relatorio") solicitarRelatorio(aid);
                else if (action === "entrar-sala") entrarNaSala(aid);
                else if (action === "realizar-checkin") realizarCheckin(aid);
                else if (action === "votar-proposta") votarProposta(aid, prid);
                else if (action === "preparar-votacao-item") prepararVotacaoItem(aid);
                else if (action === "encerrar-votacao-manual") encerrarVotacaoManual(aid, vid);
            });
            container._hasListener = true;
        }

        container.innerHTML = "<p class='text-center' style='padding:40px; color:#ccc;'>Carregando detalhes...</p>";

        try {
            const [respA, respE] = await Promise.all([
                window.Api.apiFetch(`/api/assembleias/${id}`),
                window.Api.apiFetch(`/api/assembleias/${id}/estado`)
            ]);

            const a = await respA.json();
            const estado = await respE.json();
            currentPresentes = estado.quorumVigente?.presentes || [];

            const label = window.AssembleiaUtils.getStatusLabel(a.estado);
            const dataBr = window.Formatters.formatISOToBR(a.data_evento);
            const hasCheckedIn = estado.quorumVigente?.userHasCheckedIn || false;
            const isParticipavel = ['EM_CREDENCIAMENTO', 'INICIADO', 'SUSPENSA'].includes(a.estado);
            const isEncerrada = a.estado === 'ENCERRADO';

            const userInfo = window.Utils.obterUserInfo();
            const ehGestao = window.Utils.isGestao(currentUserPerfil);
            const isPresidente = estado.mesa && estado.mesa.presidente_user_id === currentUserId;
            const isMesa = estado.mesa && [
                estado.mesa.presidente_user_id,
                estado.mesa.vice_presidente_user_id,
                estado.mesa.secretario_user_id,
                estado.mesa.secretario_2_user_id
            ].includes(currentUserId);

            // CANON: Poder de Mesa - se houver mesa, apenas membros da mesa mandam.
            const temAutoridade = isMesa || (!estado.mesa && ehGestao);

            const canSeeToken = estado.quorumVigente?.token && (
                temAutoridade ||
                currentUserId === estado.quorumVigente.gerado_por_user_id
            );
            const isCredenciamento = a.estado === 'EM_CREDENCIAMENTO';

            container.innerHTML = `
                <div class="section-card" style="background:#fff; color:#333; padding:35px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-radius: 15px; text-align: center;">
                    <div style="display:flex; justify-content:center; margin-bottom:25px;">
                        <button class="btn btn-outline btn-sm" style="font-weight:700; color:#003366; border-color:#003366;" data-action="voltar-lista">← Voltar para Lista</button>
                    </div>

                    <div style="text-align:center; margin-bottom:35px; padding-bottom:25px; border-bottom: 2px solid #f0f0f0;">
                        <div style="margin-bottom:15px;">
                            <span class="user-badge" style="background:#003366; color:#fff; padding:8px 16px; font-size:0.85rem;">${label}</span>
                        </div>
                        <h2 style="color:#003366; margin:0; font-size:2.2rem; font-weight:800; line-height:1.2;">${a.titulo}</h2>
                        <div style="margin-top:12px; color:#555; font-weight:700; text-transform:uppercase; letter-spacing:1px; font-size:1rem;">${a.tipo}</div>
                    </div>

                    <div class="section-block section-block-alt" style="background: #f8fbff; border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid #e0e8f0; text-align: center;">
                        <h4 style="color:#003366; margin-bottom:20px; font-weight: 800; font-size: 1.2rem; display:flex; align-items:center; gap:10px; justify-content:center;">📌 Pauta da Assembleia</h4>
                        <div style="color:#333; white-space: pre-wrap; line-height:1.7; font-size:1.05rem; text-align: center;">${a.pauta}</div>
                    </div>

                    <div class="field-row" style="margin-bottom:35px; display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:25px;">
                        <div class="field-group" style="background:#fff; padding:15px; border-radius:10px; border:1px solid #ddd; text-align: center;">
                            <label style="font-weight:800; color:#003366; font-size:0.9rem; text-transform:uppercase; margin-bottom:8px; display:block;">📅 Data do Evento</label>
                            <div style="font-size:1.3rem; font-weight:700; color:#333;">${dataBr || '--/--/----'}</div>
                        </div>
                        ${!isEncerrada ? `
                        <div class="field-group" style="background:#fff; padding:15px; border-radius:10px; border:1px solid #ddd; text-align: center;">
                            <label style="font-weight:800; color:#003366; font-size:0.9rem; text-transform:uppercase; margin-bottom:8px; display:block;">🕒 Chamadas (1ª / 2ª)</label>
                            <div style="font-size:1.3rem; font-weight:700; color:#333;">${a.hora_primeira_chamada || '--:--'} / ${a.hora_segunda_chamada || '--:--'}</div>
                        </div>
                        ` : ''}
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:25px; margin-bottom:35px;">
                        <!-- Edital -->
                        <div class="section-box" style="background:#fff; border:2px solid #e0e0e0; border-radius:15px; padding:25px; display:flex; flex-direction:column; align-items:center; text-align:center;">
                            <h4 style="color:#003366; margin-bottom:20px; display:flex; align-items:center; gap:10px; font-weight:800;">📄 Edital de Convocação</h4>
                            ${a.edital_url ? `
                                <div style="font-size:3rem; margin-bottom:20px;">📄</div>
                                <button class="btn btn-primary" style="width:100%; padding:15px; font-weight:800; border-radius:10px;" data-action="abrir-edital" data-aid="${a.id}">Visualizar Edital no Portal</button>
                                <button class="btn btn-link" style="margin-top:12px; font-size:0.85rem; color:#666; font-weight:600; text-decoration:underline; border:none; background:none; cursor:pointer;" data-action="baixar-edital" data-aid="${a.id}">Abrir em nova aba / Download</button>
                            ` : '<div style="font-size:3rem; margin-bottom:15px; opacity:0.3;">🚫</div><p style="font-style:italic; color:#999; font-weight:600;">Sem edital anexado.</p>'}
                        </div>

                        <!-- Quórum -->
                        ${!isEncerrada ? `
                        <div class="section-box" style="background:#fff; border:2px solid #e0e0e0; border-radius:15px; padding:25px; display:flex; flex-direction:column; align-items:center; text-align:center;">
                            <h4 style="color:#003366; margin-bottom:20px; display:flex; align-items:center; gap:10px; font-weight:800;">👥 Quórum Atual</h4>
                            <div style="text-align:center; flex:1;">
                                <p style="font-size:3rem; font-weight:900; margin:0; color:#003366;">${estado.quorumVigente?.total || 0}</p>
                                <p style="font-size:0.9rem; color:#666; margin-bottom:15px; font-weight:700; text-transform:uppercase;">Users Presentes</p>
                            </div>
                            ${estado.quorumVigente ? `
                                <div style="font-size:0.9rem; color:#003366; background:#eef6ff; padding:12px; border-radius:10px; margin-bottom:15px; width:100%; font-weight:600;">
                                    ${a.estado !== 'EM_CURSO' ? `
                                        <strong>Chamada:</strong> ${estado.quorumVigente.tipo_chamada === 'PRIMEIRA' ? '1ª (Qualificado)' : '2ª (Real)'}<br>
                                        <strong>Mínimo:</strong> ${estado.quorumVigente.quorum_necessario || 'Qualquer número'}
                                    ` : '<strong>Status:</strong> Assembleia em andamento.'}
                                </div>
                            ` : ''}

                            <details style="width:100%; text-align:left;">
                                <summary style="cursor:pointer; color:#003366; font-size:0.95rem; font-weight:700; padding:10px; background:#f9f9f9; border-radius:8px;">Ver Lista Nominal</summary>
                                <div style="margin-top:10px; max-height:200px; overflow-y:auto; font-size:0.9rem; padding:15px; background:#fff; border:1px solid #eee; border-radius:10px; box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);">
                                    ${estado.quorumVigente?.presentes?.length ?
                                        estado.quorumVigente.presentes.map(p => `<div style="padding:8px 0; border-bottom:1px solid #f5f5f5; font-weight:500;">✅ ${p.nome}</div>`).join("") :
                                        '<p style="color:#999; text-align:center; padding:10px;">Nenhum registro de presença.</p>'}
                                </div>
                            </details>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Bloco de Token Vigente -->
                    ${canSeeToken ? `
                        <div class="section-block" style="margin-bottom:35px; border:3px solid #f1c40f; background:#fffdf0; border-radius:15px; padding:25px; text-align:center; box-shadow: 0 5px 15px rgba(241, 196, 15, 0.2);">
                            <h4 style="color:#856404; margin-bottom:15px; text-transform:uppercase; font-size:0.9rem; letter-spacing:1px; font-weight:900;">🔑 Token de Presença Vigente</h4>
                            <div style="font-size:3.5rem; font-weight:900; color:#003366; letter-spacing:10px;">${estado.quorumVigente.token}</div>
                            <p style="color:#666; margin-top:10px; font-size:0.9rem; font-weight:600;">Compartilhe este código com os users presentes.</p>
                        </div>
                    ` : ''}

                    <!-- Gestão (Diretoria / Presidente) -->
                    ${((ehGestao || isPresidente) && !isEncerrada) ? `
                        <div class="section-block" style="margin-bottom:35px; border:3px solid #003366; background:#f0f7ff; border-radius:15px; padding:30px; text-align: center;">
                            <h4 style="color:#003366; margin-bottom:20px; text-transform:uppercase; font-size:1rem; letter-spacing:1.5px; font-weight:900; display:flex; align-items:center; gap:10px; justify-content:center;">🛠️ Ações de Gestão e Controle</h4>
                            <div style="display:flex; flex-wrap:wrap; gap:15px; justify-content:center;">
                                ${ehGestao && a.estado === 'CRIADO' ? `<button class="btn btn-primary btn-lg" data-action="abrir-ass" data-aid="${id}">Abrir Assembleia</button>` : ''}
                                ${ehGestao && a.estado === 'EM_CREDENCIAMENTO' ? `
                                    ${window.Utils.canComposeMesa(userInfo) ? `<button class="btn btn-primary" style="font-weight:700;" data-action="preparar-mesa" data-aid="${id}">Compor Mesa</button>` : ''}
                                    ${(window.Utils.canCreateCredenciamentoToken(userInfo) && !estado.quorumVigente?.is_global) ? `<button class="btn btn-primary" style="font-weight:700;" data-action="gerar-token-global" data-aid="${id}">Gerar Token Global</button>` : ''}
                                    ${isMesa ? `<button class="btn btn-primary" style="font-weight:700;" data-action="gerar-token-quorum" data-aid="${id}">Novo Token Quórum</button>` : ''}
                                    <button class="btn btn-success" style="font-weight:700; padding: 10px 25px;" data-action="iniciar-execucao" data-aid="${id}">Iniciar Execução (Pauta)</button>
                                ` : ''}
                                ${isMesa && a.estado === 'INICIADO' ? `
                                    <button class="btn btn-primary" style="font-weight:700;" data-action="gerar-token-quorum" data-aid="${id}">Novo Token Quórum</button>
                                    <button class="btn btn-primary" style="font-weight:700;" data-action="solicitar-recontagem" data-aid="${id}">🔄 Recontagem de Quórum</button>
                                ` : ''}
                                ${ehGestao && isParticipavel ? `<button class="btn btn-danger" style="font-weight:700;" data-action="encerrar-ass" data-aid="${id}">Encerrar Assembleia</button>` : ''}
                                ${(currentUserPerfil !== 'COMUNICADOR' && (a.estado === 'ENCERRADA' || a.estado === 'EM_CURSO' || a.estado === 'ABERTA')) ? `<button class="btn btn-primary" style="font-weight:700;" data-action="solicitar-relatorio" data-aid="${id}">Solicitar Relatório PDF</button>` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Ações Principal -->
                    <div id="area-acoes-detalhe">
                        ${isParticipavel ? `
                            ${hasCheckedIn ? `
                                <button class="btn btn-success btn-lg" style="width:100%; padding:25px; font-size:1.6rem; border-radius:20px; box-shadow:0 10px 25px rgba(39, 174, 96, 0.3); font-weight:900;" data-action="entrar-sala" data-aid="${id}">🚪 Entrar na Sala de Votação Interativa</button>
                            ` : `
                                <div class="section-box" style="border:3px solid #f1c40f; background:#fffdf0; padding:35px; text-align:center; border-radius:20px;">
                                    <h4 style="color:#856404; margin-bottom:15px; font-weight:900; font-size:1.3rem;">Check-in Necessário</h4>
                                    <p style="font-size:1.1rem; margin-bottom:25px; color:#555; font-weight:500;">
                                        Para participar e votar, informe o <strong>token de ${isCredenciamento ? '10 caracteres' : '6 dígitos'}</strong> fornecido pela organização.
                                    </p>
                                    <div style="display:flex; gap:15px; max-width:500px; margin:0 auto; flex-wrap:wrap; justify-content:center;">
                                        <input type="text" id="token-input" placeholder="${isCredenciamento ? 'A1B2C3D4E5' : '000000'}" maxlength="${isCredenciamento ? 10 : 6}" style="flex:1; text-align:center; font-size:2.2rem; letter-spacing:${isCredenciamento ? '5px' : '10px'}; padding:15px; border:3px solid #f1c40f; border-radius:12px; font-weight:800; min-width:250px; text-transform:uppercase;" />
                                        <button class="btn btn-primary btn-lg" style="padding:0 40px; font-weight:900; border-radius:12px;" data-action="realizar-checkin" data-aid="${id}">Confirmar Presença</button>
                                    </div>
                                </div>
                            `}
                        ` : `
                            <div class="section-block section-block-alt" style="text-align:center; padding:60px; border-radius:20px; background:#f9f9f9; border: 1px dashed #ccc;">
                                <div style="font-size:4rem; margin-bottom:20px;">${a.estado === 'CRIADO' ? '⏳' : '🏁'}</div>
                                <h3 style="color:#444; font-weight:800; font-size:1.5rem;">
                                    ${a.estado === 'CRIADO' ? 'Assembleia agendada. Aguarde a abertura oficial.' : 'Esta assembleia já foi encerrada.'}
                                </h3>
                                <p style="color:#777; font-weight:500;">${a.estado === 'CRIADO' ? 'O acesso à sala será liberado no horário previsto.' : 'Os resultados e a ata estarão disponíveis em breve.'}</p>
                                ${isEncerrada && currentUserPerfil !== 'COMUNICADOR' ? `
                                    <button class="btn btn-primary btn-lg" style="margin-top:20px; font-weight:800;" data-action="solicitar-relatorio" data-aid="${id}">📄 Baixar Relatório PDF (E-mail)</button>
                                ` : ''}
                            </div>
                        `}
                    </div>
                </div>
            `;
        } catch (err) {
            console.error(err);
            container.innerHTML = "<p class='text-center' style='color:#ff6b6b; padding:40px;'>Erro ao carregar detalhes da assembleia.</p>";
        }
    }

    // --- Ações de Gestão ---
    async function abrirAssembleia(id) {
        if (!confirm("Deseja abrir esta assembleia para participação?")) return;
        try {
            await window.Api.apiFetch(`/api/assembleias/${id}/abrir`, { method: "POST" });
            await carregarDetalhesAssembleia(id);
        } catch (err) { alert("Erro ao abrir."); }
    }

    async function iniciarExecucao(id) {
        if (!confirm("Deseja iniciar a execução (pauta) desta assembleia?")) return;
        try {
            const r = await window.Api.apiFetch(`/api/assembleias/${id}/iniciar-execucao`, { method: "POST" });
            if (r.ok) {
                alert("Assembleia em execução!");
                await carregarDetalhesAssembleia(id);
            } else {
                const d = await r.json();
                alert(d.error || "Erro ao iniciar execução.");
            }
        } catch (err) { alert("Erro."); }
    }

    async function encerrarAssembleia(id) {
        if (!confirm("Deseja encerrar definitivamente esta assembleia?")) return;
        try {
            await window.Api.apiFetch(`/api/assembleias/${id}/encerrar`, { method: "POST" });
            await carregarDetalhesAssembleia(id);
            if (pollingInterval) voltarParaLista();
        } catch (err) { alert("Erro ao encerrar."); }
    }

    async function gerarTokenGlobal(id) {
        try {
            const r = await window.Api.apiFetch(`/api/assembleias/${id}/token`, {
                method: "POST",
                body: { tipo_chamada: 'GLOBAL', is_global: true }
            });
            if (!r.ok) {
                const err = await r.json();
                throw new Error(err.error || "Erro ao gerar token global.");
            }
            const data = await r.json();
            alert(`Token Global Gerado: ${data.token}\nO credenciamento está aberto.`);
            await carregarDetalhesAssembleia(id);
        } catch (err) { alert(err.message); }
    }

    async function gerarTokenQuorum(id) {
        try {
            const r = await window.Api.apiFetch(`/api/assembleias/${id}/token`, {
                method: "POST",
                body: { tipo_chamada: 'PRIMEIRA', is_global: false }
            });
            if (!r.ok) {
                const err = await r.json();
                throw new Error(err.error || "Erro ao gerar token de quórum.");
            }
            const data = await r.json();
            alert(`Novo Token de Quórum Gerado: ${data.token}.\nSeu check-in foi automático.`);
            await carregarDetalhesAssembleia(id);
        } catch (err) { alert(err.message); }
    }

    async function solicitarRelatorio(id) {
        try {
            await window.Api.apiFetch(`/api/assembleias/${id}/relatorio`, { method: "POST" });
            alert("Relatório solicitado. Você o receberá por e-mail em instantes.");
        } catch (err) { alert("Erro ao solicitar relatório."); }
    }

    function ensureModalMesa() {
        if (document.getElementById('modal-compor-mesa')) return;
        const modalHtml = `
            <div id="modal-compor-mesa" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 id="mesa-modal-titulo">Compor Mesa Diretora</h2>
                        <button type="button" class="modal-close" data-close="modal-compor-mesa">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="form-compor-mesa">
                            <div class="field-group" style="margin-bottom: 15px;">
                                <label style="font-weight:700; color:#003366;">Presidente</label>
                                <select id="mesa-presidente-select" class="btn btn-outline" style="width:100%; color:#333; border: 1px solid #ccc;"></select>
                            </div>
                            <div class="field-group" style="margin-bottom: 15px;">
                                <label style="font-weight:700; color:#003366;">Secretário</label>
                                <select id="mesa-secretario-select" class="btn btn-outline" style="width:100%; color:#333; border: 1px solid #ccc;"></select>
                            </div>
                            <div id="mesa-justificativa-area" style="display:none; margin-bottom: 15px;">
                                <label style="font-weight:700; color:#003366;">Justificativa (mín. 20 chars)</label>
                                <textarea id="mesa-justificativa" class="btn btn-outline" style="width:100%; color:#333; height:80px; border: 1px solid #ccc; padding:10px;"></textarea>
                            </div>
                            <div style="text-align:right; margin-top:20px;">
                                <button type="submit" class="btn btn-primary" style="font-weight:800; padding:10px 25px; border-radius:8px;">Confirmar Mesa</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async function prepararMesa(id, substituir = false) {
        if (!currentPresentes || !currentPresentes.length) {
            alert("Sem presentes para compor mesa. Gere/Informe token e registre check-ins.");
            return;
        }

        ensureModalMesa();
        const modal = document.getElementById('modal-compor-mesa');
        const pSelect = document.getElementById('mesa-presidente-select');
        const sSelect = document.getElementById('mesa-secretario-select');
        const jArea = document.getElementById('mesa-justificativa-area');
        const form = document.getElementById('form-compor-mesa');

        pSelect.innerHTML = currentPresentes.map(p => `<option value="${p.id}">${p.nome}</option>`).join("");
        sSelect.innerHTML = currentPresentes.map(p => `<option value="${p.id}">${p.nome}</option>`).join("");

        if (currentPresentes.length > 1) sSelect.selectedIndex = 1;

        jArea.style.display = substituir ? 'block' : 'none';
        document.getElementById('mesa-modal-titulo').innerText = substituir ? 'Substituir Mesa' : 'Compor Mesa';

        modal.style.display = 'flex';

        form.onsubmit = async (e) => {
            e.preventDefault();
            const pId = pSelect.value;
            const sId = sSelect.value;
            const justificativa = document.getElementById('mesa-justificativa').value;

            if (pId === sId) {
                alert("Presidente e Secretário devem ser pessoas diferentes.");
                return;
            }

            let body = { presidente_user_id: pId, secretario_user_id: sId };
            let url = `/api/assembleias/${id}/mesa`;

            if (substituir) {
                if (!justificativa || justificativa.trim().length < 20) {
                    alert("Justificativa obrigatória e deve ter pelo menos 20 caracteres.");
                    return;
                }
                body.justificativa = justificativa;
                url = `/api/assembleias/${id}/mesa/substituir`;
            }

            try {
                const r = await window.Api.apiFetch(url, {
                    method: "POST",
                    body: body
                });
                if (r.ok) {
                    alert("Mesa atualizada!");
                    modal.style.display = 'none';
                    await carregarDetalhesAssembleia(id);
                }
                else { const d = await r.json(); alert(d.message || d.error || "Erro."); }
            } catch (err) { alert("Erro."); }
        };
    }

    // --- Check-in ---
    async function realizarCheckin(id) {
        const input = document.getElementById("token-input");
        const token = input.value.trim();
        const expectedLen = input.maxLength;
        if (token.length !== expectedLen) { alert(`O token deve ter ${expectedLen} caracteres.`); return; }

        try {
            const r = await window.Api.apiFetch(`/api/assembleias/${id}/checkin`, {
                method: "POST",
                body: { token }
            });

            if (r.ok) {
                alert("Check-in realizado com sucesso!");
                await carregarDetalhesAssembleia(id);
            } else {
                const data = await r.json();
                alert(data.message || "Erro ao realizar check-in.");
            }
        } catch (err) { console.error(err); alert("Erro."); }
    }

    // --- Sala e Polling ---
    function voltarParaLista() {
        pararPolling();
        document.getElementById("sec-assembleias-lista").style.display = "block";
        document.getElementById("sec-assembleias-criar").style.display = "none";
        document.getElementById("sec-assembleias-detalhe").style.display = "none";
        document.getElementById("sec-assembleias-sala").style.display = "none";
    }

    function entrarNaSala(id) {
        document.getElementById("sec-assembleias-lista").style.display = "none";
        document.getElementById("sec-assembleias-detalhe").style.display = "none";
        document.getElementById("sec-assembleias-sala").style.display = "block";
        iniciarPolling(id);
    }

    function iniciarPolling(id) {
        pararPolling();
        sincronizarEstado(id);
        // O polling real será controlado por setTimeout dentro de sincronizarEstadoMini para ser smart
        // Mas por compatibilidade mantemos um fallback ou apenas iniciamos o ciclo
    }

    function pararPolling() {
        if (pollingInterval) { clearTimeout(pollingInterval); pollingInterval = null; }
    }

    async function sincronizarEstado(id) {
        try {
            const r = await window.Api.apiFetch(`/api/assembleias/${id}/estado`);
            const estado = await r.json();
            renderizarSala(estado);
            // Inicia o ciclo de polling mini após o primeiro full load
            iniciarPollingMini(id, estado);
        } catch (err) { console.error("Erro no load inicial da sala:", err); }
    }

    function iniciarPollingMini(id, estadoInicial) {
        pararPolling();

        const rodar = async () => {
            if (currentAssembleiaId !== id) return;
            if (document.visibilityState !== 'visible') {
                pollingInterval = setTimeout(rodar, 5000);
                return;
            }

            let interval = 8000;
            try {
                const res = await window.Api.apiFetch(`/api/assembleias/${id}/estado/mini`);
                if (!res.ok) throw new Error("Erro polling mini");
                const mini = await res.json();

                // Atualiza elementos específicos sem re-renderizar tudo se possível
                // Mas aqui o renderizarSala é rápido o suficiente por enquanto.
                // Idealmente atualizaríamos apenas o que mudou.
                const estadoAtualizado = { ...estadoInicial, ...mini };
                renderizarSala(estadoAtualizado);

                if (mini.assembleia.estado === 'ENCERRADA') {
                    alert("Esta assembleia foi encerrada.");
                    voltarParaLista();
                    return;
                }

                interval = 8000;
                if (mini.assembleia.estado === 'EM_CURSO') interval = 5000;
                if (mini.votacaoAtiva && mini.votacaoAtiva.status === 'ATIVA') interval = 2000;

            } catch (err) {
                console.warn("Erro no polling mini:", err);
            }

            pollingInterval = setTimeout(rodar, interval);
        };

        pollingInterval = setTimeout(rodar, 5000);
    }

    function renderizarSala(estado) {
        const container = document.getElementById("area-assembleia-sala-conteudo");

        if (!container._hasListener) {
            container.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-action]");
                if (!btn) return;

                const action = btn.dataset.action;
                const aid = btn.dataset.aid || currentAssembleiaId;
                const vid = btn.dataset.vid;
                const prid = btn.dataset.prid;
                const pid = btn.dataset.pid;
                const val = btn.dataset.value;

                if (action === "sair-sala") abrirDetalhes(aid);
                else if (action === "votar") votar(aid, vid, val);
                else if (action === "pedir-palavra") pedirPalavra(aid);
                else if (action === "nova-proposta") novaProposta(aid);
                else if (action === "conceder-palavra") concederPalavra(aid, pid);
                else if (action === "votar-proposta") votarProposta(aid, prid);
                else if (action === "preparar-votacao-item") prepararVotacaoItem(aid);
                else if (action === "solicitar-recontagem") solicitarRecontagem(aid);
                else if (action === "encerrar-votacao-manual") encerrarVotacaoManual(aid, vid);
                else if (action === "encerrar-ass") encerrarAssembleia(aid);
            });
            container._hasListener = true;
        }

        const { assembleia, quorumVigente, votacaoAtiva, mesa, pedidosPalavra, propostas } = estado;

        const ehGestao = window.Utils.isGestao(currentUserPerfil);
        const isMesa = mesa && [
            mesa.presidente_user_id,
            mesa.vice_presidente_user_id,
            mesa.secretario_user_id,
            mesa.secretario_2_user_id
        ].includes(currentUserId);

        // CANON: Poder de Mesa
        const temAutoridade = isMesa || (!mesa && ehGestao);

        const canSeeToken = quorumVigente?.token && (
            temAutoridade ||
            currentUserId === quorumVigente.gerado_por_user_id
        );

        container.innerHTML = `
            <div class="section-card" style="background:#fff; color:#333; padding:30px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); border-radius: 20px; text-align: center;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px; flex-wrap:wrap; gap:15px; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px;">
                    <button class="btn btn-outline btn-sm" style="font-weight:800; color:#003366; border-color:#003366;" data-action="sair-sala" data-aid="${assembleia.id}">← Sair da Sala</button>
                    <h3 style="color:#003366; margin:0; text-align:center; flex:1; min-width:200px; font-weight:900; font-size:1.6rem;">🏛️ Sala de Votação Interativa</h3>
                    <div class="user-badge" style="background:#003366; color:#fff; font-weight:800; padding:10px 20px; font-size:1rem; border-radius:10px;">${quorumVigente?.total || 0} Presentes</div>
                </div>

                <div style="text-align:center; margin-bottom:35px;">
                    <h4 style="color:#003366; font-size:1.8rem; margin:0; font-weight:800;">${assembleia.titulo}</h4>
                    <p style="margin-top:8px; color:#666; font-size:1.1rem; font-weight:600; text-transform:uppercase; letter-spacing:1px;">${assembleia.tipo}</p>
                </div>

                <!-- Bloco de Token Vigente na Sala -->
                ${canSeeToken ? `
                    <div class="section-block" style="margin-bottom:35px; border:3px solid #f1c40f; background:#fffdf0; border-radius:15px; padding:20px; text-align:center;">
                        <h4 style="color:#856404; margin-bottom:10px; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px; font-weight:900;">🔑 Token de Presença Vigente</h4>
                        <div style="font-size:2.5rem; font-weight:900; color:#003366; letter-spacing:8px;">${quorumVigente.token}</div>
                    </div>
                ` : ''}

                <!-- Mesa -->
                <div class="section-box" style="margin-bottom:35px; border:2px solid #003366; background:#f4f9ff; border-radius:15px; padding:25px;">
                    <h4 style="color:#003366; margin-bottom:20px; text-align:center; font-size:0.95rem; text-transform:uppercase; letter-spacing:2px; font-weight:900;">🧑‍⚖️ Mesa Diretora</h4>
                    <div style="display:flex; justify-content:space-around; flex-wrap:wrap; gap:30px;">
                        <div style="text-align:center;">
                            <small style="color:#666; font-weight:800; text-transform:uppercase; font-size:0.75rem;">Presidente</small><br>
                            <strong style="font-size:1.3rem; color:#003366; font-weight:800;">${mesa?.presidente_nome || 'A definir'}</strong>
                        </div>
                        <div style="text-align:center;">
                            <small style="color:#666; font-weight:800; text-transform:uppercase; font-size:0.75rem;">Secretário</small><br>
                            <strong style="font-size:1.3rem; color:#003366; font-weight:800;">${mesa?.secretario_nome || 'A definir'}</strong>
                        </div>
                    </div>
                </div>

                <!-- Votação Ativa -->
                <div id="area-votacao-ativa" style="margin-bottom:40px;">
                    ${votacaoAtiva ? `
                        <div class="section-block" style="border:4px solid #27ae60; background:#f4fff4; border-radius:20px; padding:35px; box-shadow:0 15px 35px rgba(39, 174, 96, 0.15);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                                <span class="user-badge" style="background:#27ae60; color:#fff; padding:8px 16px; font-weight:900; font-size:0.9rem;">🗳️ VOTAÇÃO EM CURSO</span>
                                <div id="timer-votacao" style="font-weight:900; color:#e74c3c; font-size:2.5rem; font-family:'Courier New', monospace; background:#fff; padding:5px 15px; border-radius:10px; border:2px solid #e74c3c;">--:--</div>
                            </div>
                            <h4 style="margin:0 0 15px 0; color:#003366; font-size:1.8rem; font-weight:800;">${votacaoAtiva.titulo}</h4>
                            <p style="font-size:1.1rem; color:#333; line-height:1.6; font-weight:500;">${votacaoAtiva.descricao}</p>

                            ${votacaoAtiva.status === 'ATIVA' && !votacaoAtiva.userVoted ? `
                                <div style="display:flex; gap:20px; margin-top:30px; flex-wrap:wrap;">
                                    <button class="btn btn-success btn-lg" style="flex:1; font-size:1.8rem; padding:20px; border-radius:15px; font-weight:900; box-shadow: 0 8px 20px rgba(39, 174, 96, 0.3);" data-action="votar" data-aid="${assembleia.id}" data-vid="${votacaoAtiva.id}" data-value="SIM">Votar SIM</button>
                                    <button class="btn btn-danger btn-lg" style="flex:1; font-size:1.8rem; padding:20px; border-radius:15px; font-weight:900; box-shadow: 0 8px 20px rgba(192, 57, 43, 0.3);" data-action="votar" data-aid="${assembleia.id}" data-vid="${votacaoAtiva.id}" data-value="NAO">Votar NÃO</button>
                                </div>
                            ` : `
                                <div style="margin-top:30px; padding:25px; text-align:center; color:#27ae60; font-weight:900; background:#fff; border: 2px solid #27ae60; border-radius:15px; font-size:1.4rem;">
                                    ${votacaoAtiva.userVoted ? '✅ SEU VOTO FOI COMPUTADO COM SUCESSO' : 'AGUARDANDO ENCERRAMENTO...'}
                                </div>
                            `}

                            <div style="margin-top:30px; display:flex; justify-content:space-around; font-size:1.1rem; border-top:2px dashed #ccc; padding-top:25px; color:#333; font-weight:700;">
                                <div style="text-align:center;">
                                    <span style="display:block; font-size:0.8rem; color:#666; text-transform:uppercase;">Favoráveis</span>
                                    <strong style="color:#27ae60; font-size:2rem;">${votacaoAtiva.contagem?.SIM || 0}</strong>
                                </div>
                                <div style="text-align:center;">
                                    <span style="display:block; font-size:0.8rem; color:#666; text-transform:uppercase;">Contrários</span>
                                    <strong style="color:#e74c3c; font-size:2rem;">${votacaoAtiva.contagem?.NAO || 0}</strong>
                                </div>
                                <div style="text-align:center;">
                                    <span style="display:block; font-size:0.8rem; color:#666; text-transform:uppercase;">Total Parcial</span>
                                    <strong style="font-size:2rem; color:#003366;">${votacaoAtiva.contagem?.total || 0}</strong>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="section-block section-block-alt" style="text-align:center; padding:70px; border-radius:20px; background:#f9f9f9; border: 2px dashed #ddd;">
                            <div style="font-size:5rem; margin-bottom:20px; opacity:0.5;">📋</div>
                            <h3 style="color:#555; font-weight:800;">Nenhum item em votação no momento</h3>
                            <p style="color:#888; font-size:1.1rem; font-weight:500;">Aguarde o próximo item de pauta ser liberado pela mesa diretora.</p>
                        </div>
                    `}
                </div>

                <!-- Ações de Interação -->
                <div style="display:flex; gap:20px; margin-bottom:40px; flex-wrap:wrap;">
                    <button class="btn btn-outline btn-lg" style="flex:1; padding:20px; font-weight:800; border-radius:12px; border:2px solid #003366; color:#003366;" data-action="pedir-palavra" data-aid="${assembleia.id}">🎤 Pedir Palavra</button>
                    <button class="btn btn-outline btn-lg" style="flex:1; padding:20px; font-weight:800; border-radius:12px; border:2px solid #003366; color:#003366;" data-action="nova-proposta" data-aid="${assembleia.id}">📝 Nova Proposta</button>
                </div>

                <!-- Listas de Interação -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:30px;">
                    <!-- Pedidos de Palavra -->
                    <div class="section-box" style="background:#fff; border:1px solid #ddd; border-radius:15px; padding:20px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); text-align: center;">
                        <h4 style="color:#003366; margin-bottom:20px; font-size:1rem; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #f0f0f0; padding-bottom:12px; font-weight:900; display:flex; align-items:center; gap:10px; justify-content:center;">🗣️ Fila de Oradores</h4>
                        <div style="max-height:350px; overflow-y:auto; padding:5px;">
                            ${pedidosPalavra?.length ? pedidosPalavra.map(p => `
                                <div style="padding:15px; border-bottom:1px solid #f5f5f5; display:flex; justify-content:space-between; align-items:center; background:${p.status === 'EM_FALA' ? '#fff9e6' : 'transparent'}; border-radius:8px;">
                                    <div style="font-size:1rem;">
                                        <strong style="color:#003366; font-weight:800;">${p.user_nome}</strong> <small style="color:#999;">· ${window.Formatters.formatTimeSP(p.criado_em)}</small><br>
                                        <span class="user-badge" style="font-size:0.7rem; margin-top:6px; font-weight:700;">${p.status}</span>
                                    </div>
                                    ${temAutoridade && p.status === 'PENDENTE' ? `
                                        <button class="btn btn-primary btn-sm" style="font-weight:700;" data-action="conceder-palavra" data-aid="${assembleia.id}" data-pid="${p.id}">Conceder Fala</button>
                                    ` : ''}
                                </div>
                            `).join("") : '<p style="padding:30px; color:#999; font-size:1rem; text-align:center; font-style:italic; font-weight:500;">A fila de oradores está vazia.</p>'}
                        </div>
                    </div>

                    <!-- Propostas -->
                    <div class="section-box" style="background:#fff; border:1px solid #ddd; border-radius:15px; padding:20px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); text-align: center;">
                        <h4 style="color:#003366; margin-bottom:20px; font-size:1rem; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #f0f0f0; padding-bottom:12px; font-weight:900; display:flex; align-items:center; gap:10px; justify-content:center;">📝 Propostas em Pauta</h4>
                        <div style="max-height:350px; overflow-y:auto; padding:5px;">
                            ${propostas?.length ? propostas.map(pr => `
                                <div style="padding:15px; border-bottom:1px solid #f5f5f5; background:${pr.status === 'EM_VOTACAO' ? '#e8f5e9' : 'transparent'}; border-radius:8px; margin-bottom:10px;">
                                    <div style="font-size:1rem;">
                                        <strong style="color:#003366; font-weight:800;">${pr.titulo}</strong> <small style="color:#999;">· ${window.Formatters.formatTimeSP(pr.criado_em)}</small><br>
                                        <small style="color:#666; font-weight:600;">Autor: ${pr.autor_nome}</small>
                                    </div>
                                    <div style="margin-top:8px;">
                                        <span class="user-badge" style="font-size:0.7rem; font-weight:700;">${pr.status}</span>
                                    </div>
                                    ${temAutoridade && pr.status === 'ATIVA' ? `
                                        <button class="btn btn-success btn-sm" style="margin-top:12px; width:100%; font-weight:800;" data-action="votar-proposta" data-aid="${assembleia.id}" data-prid="${pr.id}">Lançar para Votação</button>
                                    ` : ''}
                                </div>
                            `).join("") : '<p style="padding:30px; color:#999; font-size:1rem; text-align:center; font-style:italic; font-weight:500;">Nenhuma proposta apresentada ainda.</p>'}
                        </div>
                    </div>
                </div>

                ${temAutoridade ? `
                    <div class="section-block" style="margin-top:50px; border:3px solid #e74c3c; background:#fff8f8; border-radius:20px; padding:30px;">
                        <h4 style="color:#e74c3c; margin-bottom:20px; font-size:1rem; text-transform:uppercase; letter-spacing:2px; font-weight:900; display:flex; align-items:center; gap:10px;">🛠️ Painel de Controle e Autoridade da Mesa</h4>
                        <div style="display:flex; gap:15px; flex-wrap:wrap; justify-content:center;">
                            <button class="btn btn-outline btn-sm" style="font-weight:700; border-color:#e74c3c; color:#e74c3c;" data-action="preparar-votacao-item" data-aid="${assembleia.id}">➕ Iniciar Votação</button>
                            <button class="btn btn-outline btn-sm" style="font-weight:700; border-color:#e74c3c; color:#e74c3c;" data-action="solicitar-recontagem" data-aid="${assembleia.id}">🔄 Solicitar Recontagem</button>
                            ${temAutoridade && votacaoAtiva && votacaoAtiva.status === 'ATIVA' ? `
                                <button class="btn btn-danger btn-sm" style="font-weight:800;" data-action="encerrar-votacao-manual" data-aid="${assembleia.id}" data-vid="${votacaoAtiva.id}">⏹️ Encerrar Votacao Item</button>
                            ` : ''}
                            ${temAutoridade ? `
                                <button class="btn btn-danger btn-sm" style="font-weight:800;" data-action="encerrar-ass" data-aid="${assembleia.id}">🚫 Encerrar Assembleia</button>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        atualizarTimer(votacaoAtiva);
    }

    function atualizarTimer(votacaoAtiva) {
        if (!votacaoAtiva || votacaoAtiva.status !== 'ATIVA') return;
        const el = document.getElementById("timer-votacao");
        if (!el) return;

        const fim = new Date(votacaoAtiva.encerra_em).getTime();
        const agora = new Date().getTime();
        const diff = Math.max(0, Math.floor((fim - agora) / 1000));

        const min = Math.floor(diff / 60);
        const seg = diff % 60;
        el.innerText = `${min}:${seg.toString().padStart(2, '0')}`;

        if (diff > 0) setTimeout(() => atualizarTimer(votacaoAtiva), 1000);
    }

    // --- Ações de Sala ---
    async function votar(aid, vid, opcao) {
        try {
            const r = await window.Api.apiFetch(`/api/assembleias/${aid}/votacoes/${vid}/voto`, {
                method: "POST",
                body: { voto: opcao }
            });
            if (r.ok) { sincronizarEstado(aid); }
            else { const d = await r.json(); alert(d.error || "Erro ao votar."); }
        } catch (err) { alert("Erro."); }
    }

    async function pedirPalavra(aid) {
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/pedir-palavra`, { method: "POST" });
            alert("Pedido de palavra registrado na fila!");
        } catch (err) { alert("Erro."); }
    }

    async function concederPalavra(aid, pid) {
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/pedidos/${pid}/conceder`, { method: "POST" });
        } catch (err) { alert("Erro."); }
    }

    async function novaProposta(aid) {
        const titulo = prompt("Título da Proposta:");
        const pauta = prompt("Pauta/Descrição da Proposta:");
        if (!titulo || !pauta) return;
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/propostas`, {
                method: "POST",
                body: { titulo, pauta }
            });
            alert("Proposta submetida à mesa!");
        } catch (err) { alert("Erro."); }
    }

    async function votarProposta(aid, prid) {
        if (!confirm("Deseja iniciar a votação desta proposta agora?")) return;
        try {
            const r = await window.Api.apiFetch(`/api/assembleias/${aid}/propostas/${prid}/votar`, { method: "POST" });
            const data = await r.json();
            if (data.status === 'RETIRADA_AUTOR_AUSENTE') {
                alert("Proposta retirada de pauta: autor ausente da votação.");
                sincronizarEstado(aid);
            }
        } catch (err) { alert("Erro."); }
    }

    async function solicitarRecontagem(aid) {
        if (!confirm("Atenção: Novo token exige novo check-in!\n\nIsso invalidará todos os check-ins atuais e gerará um novo token. Todos os presentes deverão realizar o check-in novamente. Continuar?")) return;
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/token`, {
                method: "POST",
                body: { tipo_chamada: 'RECONTAGEM' }
            });
            alert("Recontagem iniciada! O quórum foi zerado.");
            await abrirDetalhes(aid);
        } catch (err) { alert("Erro ao solicitar recontagem."); }
    }

    function ensureModalVotacao() {
        if (document.getElementById('modal-criar-votacao')) return;
        const modalHtml = `
            <div id="modal-criar-votacao" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>Iniciar Nova Votação</h2>
                        <button type="button" class="modal-close" data-close="modal-criar-votacao">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="form-criar-votacao">
                            <div class="field-group" style="margin-bottom: 15px;">
                                <label style="font-weight:700; color:#003366;">Título do Item</label>
                                <input type="text" id="votacao-titulo" class="btn btn-outline" style="width:100%; color:#333; border: 1px solid #ccc;" required placeholder="Ex: Aprovação de Contas">
                            </div>
                            <div class="field-group" style="margin-bottom: 15px;">
                                <label style="font-weight:700; color:#003366;">Descrição/Pauta</label>
                                <textarea id="votacao-descricao" class="btn btn-outline" style="width:100%; color:#333; height:80px; border: 1px solid #ccc; padding:10px;" required></textarea>
                            </div>
                            <div class="field-group" style="margin-bottom: 15px;">
                                <label style="font-weight:700; color:#003366;">Duração</label>
                                <select id="votacao-duracao" class="btn btn-outline" style="width:100%; color:#333; border: 1px solid #ccc;">
                                    <option value="60">1 Minuto</option>
                                    <option value="120" selected>2 Minutos (Padrão)</option>
                                    <option value="180">3 Minutos</option>
                                    <option value="300">5 Minutos</option>
                                </select>
                            </div>
                            <div style="text-align:right; margin-top:20px;">
                                <button type="submit" class="btn btn-primary" style="font-weight:800; padding:10px 25px; border-radius:8px;">🚀 Lançar Votação</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async function prepararVotacaoItem(aid) {
        ensureModalVotacao();
        const modal = document.getElementById('modal-criar-votacao');
        const form = document.getElementById('form-criar-votacao');

        form.reset();
        document.getElementById('votacao-duracao').value = "120";
        modal.style.display = 'flex';

        form.onsubmit = async (e) => {
            e.preventDefault();
            const titulo = document.getElementById('votacao-titulo').value;
            const descricao = document.getElementById('votacao-descricao').value;
            const duracao = document.getElementById('votacao-duracao').value;

            try {
                const r = await window.Api.apiFetch(`/api/assembleias/${aid}/votacoes`, {
                    method: "POST",
                    body: { titulo, descricao, duracao_segundos: parseInt(duracao) }
                });
                if (r.ok) {
                    modal.style.display = 'none';
                    sincronizarEstado(aid);
                } else {
                    const d = await r.json();
                    alert(d.error || "Erro ao iniciar votação.");
                }
            } catch (err) { alert("Erro de rede."); }
        };
    }

    async function encerrarVotacaoManual(aid, vid) {
        if (!confirm("Deseja encerrar esta votação manualmente agora?")) return;
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/votacoes/${vid}/encerrar`, { method: "POST" });
        } catch (err) { alert("Erro."); }
    }

    async function abrirCriacao() {
        document.getElementById("sec-assembleias-lista").style.display = "none";
        document.getElementById("sec-assembleias-criar").style.display = "block";
        document.getElementById("sec-assembleias-detalhe").style.display = "none";

        const container = document.getElementById("area-assembleia-criar-conteudo");
        container.innerHTML = `
            <div class="section-card" style="background:#fff; color:#333; padding:35px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-radius: 15px; max-width: 800px; margin: 0 auto;">
                <div style="display:flex; justify-content:flex-start; margin-bottom:25px;">
                    <button class="btn btn-outline btn-sm" style="font-weight:700; color:#003366; border-color:#003366;" data-action="voltar-lista">← Cancelar e Voltar</button>
                </div>

                <div style="text-align:center; margin-bottom:30px;">
                    <h2 style="color:#003366; margin:0; font-size:2rem; font-weight:800;">➕ Nova Assembleia</h2>
                    <p style="color:#666; font-weight:600;">Preencha os dados básicos para agendamento</p>
                </div>

                <form id="form-criar-assembleia">
                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-weight:800; color:#003366; margin-bottom:8px; font-size:0.9rem; text-transform:uppercase;">Título da Assembleia *</label>
                        <input type="text" name="titulo" required placeholder="Ex: Assembleia Geral Extraordinária 01/2026" style="width:100%; padding:12px; border:2px solid #ddd; border-radius:10px; font-size:1rem;">
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px;">
                        <div>
                            <label style="display:block; font-weight:800; color:#003366; margin-bottom:8px; font-size:0.9rem; text-transform:uppercase;">Tipo *</label>
                            <select name="tipo" required style="width:100%; padding:12px; border:2px solid #ddd; border-radius:10px; font-size:1rem; background:white;">
                                <option value="AGE">Extraordinária (AGE)</option>
                                <option value="AGO">Ordinária (AGO)</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-weight:800; color:#003366; margin-bottom:8px; font-size:0.9rem; text-transform:uppercase;">Data do Evento *</label>
                            <input type="date" name="data_evento" required style="width:100%; padding:12px; border:2px solid #ddd; border-radius:10px; font-size:1rem;">
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px;">
                        <div>
                            <label style="display:block; font-weight:800; color:#003366; margin-bottom:8px; font-size:0.9rem; text-transform:uppercase;">1ª Chamada *</label>
                            <input type="time" name="hora_primeira_chamada" required style="width:100%; padding:12px; border:2px solid #ddd; border-radius:10px; font-size:1rem;">
                        </div>
                        <div>
                            <label style="display:block; font-weight:800; color:#003366; margin-bottom:8px; font-size:0.9rem; text-transform:uppercase;">2ª Chamada *</label>
                            <input type="time" name="hora_segunda_chamada" required style="width:100%; padding:12px; border:2px solid #ddd; border-radius:10px; font-size:1rem;">
                        </div>
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="display:block; font-weight:800; color:#003366; margin-bottom:8px; font-size:0.9rem; text-transform:uppercase;">Pauta / Ordem do Dia *</label>
                        <textarea name="pauta" required rows="5" placeholder="Descreva os itens a serem debatidos e votados..." style="width:100%; padding:12px; border:2px solid #ddd; border-radius:10px; font-size:1rem; resize:vertical;"></textarea>
                    </div>

                    <div style="margin-bottom:30px; padding:25px; border:2px dashed #003366; border-radius:12px; text-align:center; background:#f0f7ff;">
                        <label style="display:block; font-weight:800; color:#003366; margin-bottom:15px; font-size:0.9rem; text-transform:uppercase;">Edital de Convocação (Obrigatório PDF) *</label>

                        <div id="area-edital-selecionado" style="display:none; margin-bottom:15px; background:#fff; padding:15px; border-radius:10px; border:1px solid #27ae60; color:#27ae60; font-weight:700;">
                            ✅ Edital selecionado: <span id="nome-edital-selecionado"></span>
                        </div>

                        <button type="button" class="btn btn-outline" id="btn-selecionar-drive" style="font-weight:700;">
                            📂 Selecionar edital no Drive (Publicações)
                        </button>

                        <input type="hidden" name="edital_drive_file_id" id="input-edital-drive-id" required>
                        <p style="font-size:0.8rem; color:#666; margin-top:10px;">O edital deve ser um arquivo PDF previamente salvo na biblioteca digital.</p>
                    </div>

                    <div id="container-picker-drive" style="display:none; margin-bottom:30px; padding:20px; border:1px solid #ddd; border-radius:10px; background:#fafafa; max-height:400px; overflow-y:auto;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <h4 style="margin:0; color:#003366;">Escolha o arquivo PDF:</h4>
                            <button type="button" class="btn btn-sm btn-outline" id="btn-fechar-picker">Fechar Seletor</button>
                        </div>
                        <div id="lista-picker-drive"></div>
                    </div>

                    <div style="text-align:right;">
                        <button type="submit" id="btn-salvar-assembleia" class="btn btn-primary btn-lg" style="padding:15px 40px; font-weight:800; border-radius:10px;">Agendar Assembleia 🚀</button>
                    </div>
                </form>
            </div>
        `;

        selectedDriveFile = null;

        document.getElementById("btn-selecionar-drive").addEventListener("click", () => {
            const container = document.getElementById("container-picker-drive");
            container.style.display = "block";
            window.Publicacoes.inicializarPublicacoes(null, {
                isPicker: true,
                containerId: "lista-picker-drive",
                onSelectFile: (file) => {
                    if (file.mimeType !== "application/vnd.google-apps.folder" && file.mimeType !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
                        alert("Por favor, selecione apenas arquivos PDF.");
                        return;
                    }
                    if (file.mimeType === "application/vnd.google-apps.folder") return; // Folder click is handled by inicializarPublicacoes

                    selectedDriveFile = file;
                    document.getElementById("input-edital-drive-id").value = file.id;
                    document.getElementById("nome-edital-selecionado").innerText = file.name;
                    document.getElementById("area-edital-selecionado").style.display = "block";
                    container.style.display = "none";
                    document.getElementById("btn-selecionar-drive").innerText = "🔄 Trocar Edital";
                }
            });
        });

        document.getElementById("btn-fechar-picker").addEventListener("click", () => {
            document.getElementById("container-picker-drive").style.display = "none";
        });

        document.getElementById("form-criar-assembleia").onsubmit = (e) => {
            e.preventDefault();
            salvarNovaAssembleia();
        };
    }

    async function salvarNovaAssembleia() {
        const form = document.getElementById("form-criar-assembleia");
        const btn = document.getElementById("btn-salvar-assembleia");

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.edital_drive_file_id) {
            alert("O edital (PDF) é obrigatório.");
            return;
        }

        btn.disabled = true;
        btn.innerText = "Processando...";

        try {
            // Criação da assembleia
            btn.innerText = "Criando assembleia...";
            const payload = {
                ...data,
                edital_url: "",
                edital_public_id: null,
                edital_resource_type: null,
                edital_type: null,
                edital_format: 'pdf'
            };

            const res = await window.Api.apiFetch("/api/assembleias", {
                method: "POST",
                body: payload
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erro ao criar assembleia.");
            }

            alert("Assembleia criada com sucesso!");
            voltarParaLista();
            await carregarListaAssembleias();
        } catch (error) {
            console.error(error);
            alert("Erro: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "Agendar Assembleia 🚀";
        }
    }

    global.Assembleias = {
        inicializarAssembleias,
        mudarFiltro,
        abrirCriacao,
        abrirDetalhes,
        voltarParaLista,
        entrarNaSala,
        realizarCheckin,
        abrirEditalSeguro,
        baixarEditalSeguro,

        // Ações de Gestão
        abrirAssembleia,
        iniciarExecucao,
        encerrarAssembleia,
        gerarTokenToken,
        solicitarRelatorio,
        prepararMesa,

        // Ações de Sala
        votar,
        pedirPalavra,
        concederPalavra,
        novaProposta,
        votarProposta,
        solicitarRecontagem,
        prepararVotacaoItem,
        encerrarVotacaoManual
    };

})(typeof window !== 'undefined' ? window : global);
