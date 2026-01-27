/**
 * Módulo Assembleias e Votações (Área do Filiado)
 * Carregado como script clássico (window.Assembleias)
 */

(function (global) {
    if (global.Assembleias) return;

    let pollingInterval = null;
    let currentAssembleiaId = null;
    let currentFiltro = 'ATIVAS';
    let currentUserPerfil = 'FILIADO';
    let currentUserId = null;

    async function inicializarAssembleias(perfil) {
        console.log("Inicializando módulo de Assembleias...");
        currentUserPerfil = perfil;
        const userInfo = window.Utils.obterUserInfo();
        currentUserId = userInfo.id || userInfo.sub;

        renderizarEstruturaBase();
        await carregarListaAssembleias();
    }

    function renderizarEstruturaBase() {
        const section = document.getElementById("sec-assembleias");
        section.innerHTML = `
            <div id="sec-assembleias-lista">
                <div class="section-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <h2 style="color:#003366; margin:0;">🗳️ Assembleias e Votações</h2>
                        <select id="filtro-assembleias" class="btn btn-outline" style="color:#333; background:#fff;" onchange="Assembleias.mudarFiltro(this.value)">
                            <option value="ATIVAS">Ativas</option>
                            <option value="ENCERRADAS">Encerradas</option>
                            <option value="TODAS">Todas</option>
                        </select>
                    </div>
                </div>
                <div id="area-assembleias-lista" style="margin-top:20px;">
                    <p>Carregando assembleias...</p>
                </div>
            </div>

            <div id="sec-assembleias-detalhe" style="display:none;">
                <div id="area-assembleia-detalhe-conteudo"></div>
            </div>

            <div id="sec-assembleias-sala" style="display:none;">
                <div id="area-assembleia-sala-conteudo"></div>
            </div>
        `;
    }

    async function mudarFiltro(novoFiltro) {
        currentFiltro = novoFiltro;
        await carregarListaAssembleias();
    }

    async function carregarListaAssembleias() {
        const container = document.getElementById("area-assembleias-lista");
        if (!container) return;

        container.innerHTML = "<p>Carregando assembleias...</p>";

        try {
            const r = await window.Api.apiFetch("/api/assembleias");
            let assembleias = await r.json();

            if (!assembleias || !assembleias.length) {
                container.innerHTML = "<p>Nenhuma assembleia encontrada.</p>";
                return;
            }

            if (currentFiltro === 'ATIVAS') {
                assembleias = assembleias.filter(a => ['CRIADA', 'ABERTA', 'EM_CURSO'].includes(a.estado));
            } else if (currentFiltro === 'ENCERRADAS') {
                assembleias = assembleias.filter(a => a.estado === 'ENCERRADA');
            }

            const ordem = { 'EM_CURSO': 0, 'ABERTA': 1, 'CRIADA': 2, 'ENCERRADA': 3 };
            assembleias.sort((a, b) => (ordem[a.estado] ?? 99) - (ordem[b.estado] ?? 99));

            renderizarLista(assembleias, container);
        } catch (err) {
            console.error("Erro ao carregar assembleias:", err);
            container.innerHTML = "<p style='color:red;'>Erro ao carregar assembleias.</p>";
        }
    }

    function renderizarLista(assembleias, container) {
        if (!assembleias.length) {
            container.innerHTML = "<p>Nenhuma assembleia nesta categoria.</p>";
            return;
        }

        container.innerHTML = assembleias.map(a => {
            const label = window.AssembleiaUtils.getStatusLabel(a.estado);
            const emoji = window.AssembleiaUtils.getStatusEmoji(a.estado);
            const dataBr = window.Formatters.formatISOToBR(a.data_evento);

            return `
                <div class="section-box filiado-card" style="margin-bottom:15px; background:#fff; color:#333;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <strong style="font-size:1.1rem; color:#003366;">${emoji} ${a.tipo} - ${a.titulo}</strong>
                            <div style="margin-top:5px; font-size:0.9rem; color:#666;">
                                📅 Data: ${dataBr} | 🕒 ${a.hora_primeira_chamada || '--:--'} (1ª) / ${a.hora_segunda_chamada || '--:--'} (2ª)
                            </div>
                            <div style="margin-top:5px;">
                                <span class="filiado-badge">${label}</span>
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="Assembleias.abrirDetalhes('${a.id}')">Ver Detalhes</button>
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
        container.innerHTML = "<p>Carregando detalhes...</p>";

        try {
            const [respA, respE] = await Promise.all([
                window.Api.apiFetch(`/api/assembleias/${id}`),
                window.Api.apiFetch(`/api/assembleias/${id}/estado`)
            ]);

            const a = await respA.json();
            const estado = await respE.json();

            const label = window.AssembleiaUtils.getStatusLabel(a.estado);
            const dataBr = window.Formatters.formatISOToBR(a.data_evento);
            const hasCheckedIn = estado.quorumVigente?.userHasCheckedIn || false;
            const isParticipavel = a.estado === 'ABERTA' || a.estado === 'EM_CURSO';

            const isDiretoria = ['ADMIN', 'DIRETORIA'].includes(currentUserPerfil);

            container.innerHTML = `
                <div class="section-card" style="background:#fff; color:#333;">
                    <button class="btn btn-outline btn-sm" style="margin-bottom:15px;" onclick="Assembleias.voltarParaLista()">← Voltar para Lista</button>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <span class="filiado-badge">${label}</span>
                        <strong style="color:#666;">${a.tipo}</strong>
                    </div>

                    <h2 style="color:#003366; margin-bottom:10px;">${a.titulo}</h2>
                    <div class="section-box" style="background:#f8f9fa; color:#555; margin-bottom:20px; white-space: pre-wrap;">${a.pauta}</div>

                    <div class="field-row" style="margin-bottom:20px;">
                        <div class="field-group">
                            <label>📅 Data do Evento</label>
                            <input type="text" value="${dataBr}" readonly />
                        </div>
                        <div class="field-group">
                            <label>🕒 Chamadas (1ª / 2ª)</label>
                            <input type="text" value="${a.hora_primeira_chamada} / ${a.hora_segunda_chamada}" readonly />
                        </div>
                    </div>

                    <!-- Edital -->
                    <div class="section-box" style="margin-bottom:20px;">
                        <h4 style="color:#003366; margin-bottom:10px;">📄 Edital de Convocação</h4>
                        ${a.edital_url ? `
                            <button class="btn btn-outline" style="width:100%;" onclick="window.open('${a.edital_url}', '_blank')">Visualizar Edital</button>
                        ` : '<p style="font-style:italic; color:#999;">Sem edital anexado.</p>'}
                    </div>

                    <!-- Quórum -->
                    <div class="section-box" style="margin-bottom:20px;">
                        <h4 style="color:#003366; margin-bottom:10px;">👥 Quórum Atual</h4>
                        <p style="font-size:1.4rem; font-weight:bold; margin-bottom:5px;">${estado.quorumVigente?.total || 0} presentes</p>
                        ${estado.quorumVigente ? `
                            <div style="font-size:0.85rem; color:#666;">
                                ${a.estado !== 'EM_CURSO' ? `
                                    Chamada: ${estado.quorumVigente.tipo_chamada === 'PRIMEIRA' ? '1ª (Qualificado)' : '2ª (Real)'}<br>
                                    Mínimo necessário: ${estado.quorumVigente.quorum_necessario || 'Qualquer número'}
                                ` : 'Assembleia em andamento.'}
                            </div>
                        ` : ''}

                        <details style="margin-top:10px;">
                            <summary style="cursor:pointer; color:#003366; font-size:0.9rem;">Ver Lista Nominal</summary>
                            <div style="margin-top:10px; max-height:150px; overflow-y:auto; font-size:0.9rem;">
                                ${estado.quorumVigente?.presentes?.length ?
                                    estado.quorumVigente.presentes.map(p => `<div>✅ ${p.nome}</div>`).join("") :
                                    '<p style="color:#999;">Nenhum registro.</p>'}
                            </div>
                        </details>
                    </div>

                    <!-- Gestão (Diretoria) -->
                    ${isDiretoria ? `
                        <div class="section-box" style="margin-bottom:20px; border:1px solid #003366;">
                            <h4 style="color:#003366; margin-bottom:10px;">🛠️ Ações de Gestão</h4>
                            <div style="display:flex; flex-wrap:wrap; gap:10px;">
                                ${a.estado === 'CRIADA' ? `<button class="btn btn-primary btn-sm" onclick="Assembleias.abrirAssembleia('${id}')">Abrir Assembleia</button>` : ''}
                                ${a.estado === 'ABERTA' ? `
                                    <button class="btn btn-primary btn-sm" onclick="Assembleias.prepararMesa('${id}')">Compor Mesa</button>
                                    <button class="btn btn-primary btn-sm" onclick="Assembleias.gerarTokenToken('${id}')">Gerar Token</button>
                                    <button class="btn btn-success btn-sm" onclick="Assembleias.iniciarExecucao('${id}')">Iniciar Execução</button>
                                ` : ''}
                                ${isParticipavel ? `<button class="btn btn-danger btn-sm" onclick="Assembleias.encerrarAssembleia('${id}')">Encerrar</button>` : ''}
                                ${a.estado === 'ENCERRADA' ? `<button class="btn btn-primary btn-sm" onclick="Assembleias.solicitarRelatorio('${id}')">Solicitar Relatório PDF</button>` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Ações -->
                    <div id="area-acoes-detalhe">
                        ${isParticipavel ? `
                            ${hasCheckedIn ? `
                                <button class="btn btn-success btn-lg" style="width:100%;" onclick="Assembleias.entrarNaSala('${id}')">🚪 Ir para Sala de Votação</button>
                            ` : `
                                <div class="section-box" style="border:1px solid #f1c40f; background:#fffdf0;">
                                    <h4 style="color:#856404;">Check-in Necessário</h4>
                                    <p style="font-size:0.9rem; margin-bottom:10px;">Informe o token de 6 dígitos para registrar sua presença.</p>
                                    <div style="display:flex; gap:10px;">
                                        <input type="text" id="token-input" placeholder="000000" maxlength="6" style="flex:1; text-align:center; font-size:1.2rem; letter-spacing:4px;" />
                                        <button class="btn btn-primary" onclick="Assembleias.realizarCheckin('${id}')">Confirmar</button>
                                    </div>
                                </div>
                            `}
                        ` : `
                            <div class="section-box" style="text-align:center; color:#666;">
                                ${a.estado === 'CRIADA' ? 'Assembleia agendada. Aguarde a abertura.' : 'Assembleia encerrada.'}
                            </div>
                        `}
                    </div>
                </div>
            `;
        } catch (err) {
            console.error(err);
            container.innerHTML = "<p style='color:red;'>Erro ao carregar detalhes.</p>";
        }
    }

    // --- Ações de Gestão ---
    async function abrirAssembleia(id) {
        if (!confirm("Deseja abrir esta assembleia?")) return;
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

    async function gerarTokenToken(id) {
        try {
            const r = await window.Api.apiFetch(`/api/assembleias/${id}/token`, {
                method: "POST",
                body: { tipo_chamada: 'PRIMEIRA' }
            });
            const data = await r.json();
            alert(`Token Gerado: ${data.token}\nSeu check-in foi automático.`);
            await carregarDetalhesAssembleia(id);
        } catch (err) { alert("Erro ao gerar token."); }
    }

    async function solicitarRelatorio(id) {
        try {
            await window.Api.apiFetch(`/api/assembleias/${id}/relatorio`, { method: "POST" });
            alert("Relatório solicitado. Você o receberá por e-mail em instantes.");
        } catch (err) { alert("Erro ao solicitar relatório."); }
    }

    async function prepararMesa(id, substituir = false) {
        const pId = prompt("ID do Usuário Presidente:");
        const sId = prompt("ID do Usuário Secretário:");
        if (!pId || !sId) return;

        if (pId === sId) {
            alert("Presidente e Secretário devem ser pessoas diferentes.");
            return;
        }

        let body = { presidente_user_id: pId, secretario_user_id: sId };
        let url = `/api/assembleias/${id}/mesa`;

        if (substituir) {
            const justification = prompt("Justificativa para alteração da mesa (mín. 20 caracteres):");
            if (!justification || justification.length < 20) {
                alert("Justificativa obrigatória e deve ter pelo menos 20 caracteres.");
                return;
            }
            body.justificativa = justification;
            url = `/api/assembleias/${id}/mesa/substituir`;
        }

        try {
            const r = await window.Api.apiFetch(url, {
                method: "POST",
                body: body
            });
            if (r.ok) { alert("Mesa atualizada!"); await carregarDetalhesAssembleia(id); }
            else { const d = await r.json(); alert(d.message || d.error || "Erro."); }
        } catch (err) { alert("Erro."); }
    }

    // --- Check-in ---
    async function realizarCheckin(id) {
        const input = document.getElementById("token-input");
        const token = input.value.trim();
        if (token.length !== 6) { alert("O token deve ter 6 dígitos."); return; }

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
        pollingInterval = setInterval(() => sincronizarEstado(id), 5000);
    }

    function pararPolling() {
        if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
    }

    async function sincronizarEstado(id) {
        try {
            const r = await window.Api.apiFetch(`/api/assembleias/${id}/estado`);
            const estado = await r.json();
            renderizarSala(estado);
        } catch (err) { console.error("Erro no polling:", err); }
    }

    function renderizarSala(estado) {
        const container = document.getElementById("area-assembleia-sala-conteudo");
        const { assembleia, quorumVigente, votacaoAtiva, mesa, pedidosPalavra, propostas } = estado;

        const isPresidente = mesa && mesa.presidente_user_id === currentUserId;
        const isDiretoria = ['ADMIN', 'DIRETORIA'].includes(currentUserPerfil);
        const temAutoridade = isPresidente || isDiretoria;

        container.innerHTML = `
            <div class="section-card" style="background:#fff; color:#333;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <button class="btn btn-outline btn-sm" onclick="Assembleias.abrirDetalhes('${assembleia.id}')">← Sair da Sala</button>
                    <h3 style="color:#003366; margin:0;">🏛️ Sala de Votação</h3>
                    <div class="filiado-badge">${quorumVigente?.total || 0} presentes</div>
                </div>

                <div style="text-align:center; margin-bottom:20px;">
                    <strong style="font-size:1.2rem; color:#003366;">${assembleia.titulo}</strong>
                </div>

                <!-- Mesa -->
                <div class="section-box" style="margin-bottom:20px; border-left:5px solid #003366; background:#f0f7ff;">
                    <h4 style="color:#003366; margin-bottom:10px; text-align:center;">🧑‍⚖️ Mesa Diretora</h4>
                    <div style="display:flex; justify-content:space-around; flex-wrap:wrap; gap:15px;">
                        <div style="text-align:center;">
                            <small style="color:#666;">Presidente</small><br>
                            <strong>${mesa?.presidente_nome || 'A definir'}</strong>
                        </div>
                        <div style="text-align:center;">
                            <small style="color:#666;">Secretário</small><br>
                            <strong>${mesa?.secretario_nome || 'A definir'}</strong>
                        </div>
                    </div>
                </div>

                <!-- Votação Ativa -->
                <div id="area-votacao-ativa" style="margin-bottom:20px;">
                    ${votacaoAtiva ? `
                        <div class="section-box" style="border:2px solid #27ae60; background:#fafffa;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span class="filiado-badge" style="background:#27ae60; color:#fff;">VOTAÇÃO ATIVA</span>
                                <div id="timer-votacao" style="font-weight:bold; color:#e74c3c; font-size:1.2rem;">--:--</div>
                            </div>
                            <h4 style="margin:10px 0; color:#333;">${votacaoAtiva.titulo}</h4>
                            <p style="font-size:0.9rem; color:#666;">${votacaoAtiva.descricao}</p>

                            ${votacaoAtiva.status === 'ATIVA' && !votacaoAtiva.userVoted ? `
                                <div style="display:flex; gap:10px; margin-top:15px;">
                                    <button class="btn btn-success" style="flex:1; font-size:1.2rem;" onclick="Assembleias.votar('${assembleia.id}', '${votacaoAtiva.id}', 'SIM')">SIM</button>
                                    <button class="btn btn-danger" style="flex:1; font-size:1.2rem;" onclick="Assembleias.votar('${assembleia.id}', '${votacaoAtiva.id}', 'NAO')">NÃO</button>
                                </div>
                            ` : `
                                <div style="margin-top:15px; text-align:center; color:#27ae60; font-weight:bold;">
                                    ${votacaoAtiva.userVoted ? '✅ Seu voto foi registrado.' : 'Votação em processamento...'}
                                </div>
                            `}

                            <div style="margin-top:15px; display:flex; justify-content:space-between; font-size:0.9rem; border-top:1px solid #eee; padding-top:10px;">
                                <span>SIM: <strong>${votacaoAtiva.contagem?.SIM || 0}</strong></span>
                                <span>NÃO: <strong>${votacaoAtiva.contagem?.NAO || 0}</strong></span>
                                <span>TOTAL: <strong>${votacaoAtiva.contagem?.total || 0}</strong></span>
                            </div>
                        </div>
                    ` : `
                        <div class="section-box" style="text-align:center; background:#f8f9fa; color:#999; padding:30px;">
                            <p>Aguardando próximo item de pauta para votação...</p>
                        </div>
                    `}
                </div>

                <!-- Ações de Interação -->
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <button class="btn btn-outline" style="flex:1;" onclick="Assembleias.pedirPalavra('${assembleia.id}')">🎤 Pedir Palavra</button>
                    <button class="btn btn-outline" style="flex:1;" onclick="Assembleias.novaProposta('${assembleia.id}')">📝 Nova Proposta</button>
                </div>

                <!-- Listas de Interação -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                    <!-- Pedidos de Palavra -->
                    <div>
                        <h4 style="color:#003366; margin-bottom:10px; font-size:0.9rem; text-transform:uppercase;">🗣️ Fila de Fala</h4>
                        <div class="section-box" style="max-height:300px; overflow-y:auto; padding:5px;">
                            ${pedidosPalavra?.length ? pedidosPalavra.map(p => `
                                <div style="padding:8px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                                    <div style="font-size:0.85rem;">
                                        <strong>${p.filiado_nome}</strong><br>
                                        <small style="color:#999;">${p.status}</small>
                                    </div>
                                    ${temAutoridade && p.status === 'PENDENTE' ? `
                                        <button class="btn btn-primary btn-sm" style="padding:2px 6px; font-size:0.7rem;" onclick="Assembleias.concederPalavra('${assembleia.id}', '${p.id}')">Conceder</button>
                                    ` : ''}
                                </div>
                            `).join("") : '<p style="padding:10px; color:#999; font-size:0.8rem;">Ninguém na fila.</p>'}
                        </div>
                    </div>

                    <!-- Propostas -->
                    <div>
                        <h4 style="color:#003366; margin-bottom:10px; font-size:0.9rem; text-transform:uppercase;">📝 Propostas</h4>
                        <div class="section-box" style="max-height:300px; overflow-y:auto; padding:5px;">
                            ${propostas?.length ? propostas.map(pr => `
                                <div style="padding:8px; border-bottom:1px solid #eee;">
                                    <div style="font-size:0.85rem;">
                                        <strong>${pr.titulo}</strong><br>
                                        <small style="color:#666;">${pr.autor_nome}</small>
                                    </div>
                                    <div style="font-size:0.75rem; color:#888; margin-top:4px;">${pr.status}</div>
                                    ${temAutoridade && pr.status === 'ATIVA' ? `
                                        <button class="btn btn-success btn-sm" style="padding:2px 6px; font-size:0.7rem; margin-top:5px; width:100%;" onclick="Assembleias.votarProposta('${assembleia.id}', '${pr.id}')">Votar Proposta</button>
                                    ` : ''}
                                </div>
                            `).join("") : '<p style="padding:10px; color:#999; font-size:0.8rem;">Sem propostas.</p>'}
                        </div>
                    </div>
                </div>

                ${temAutoridade ? `
                    <div class="section-box" style="margin-top:20px; border:1px solid #e74c3c;">
                        <h4 style="color:#e74c3c; margin-bottom:10px; font-size:0.9rem; text-transform:uppercase;">🛠️ Comandos de Mesa</h4>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button class="btn btn-outline btn-sm" onclick="Assembleias.prepararVotacaoItem('${assembleia.id}')">➕ Novo Item Votação</button>
                            <button class="btn btn-outline btn-sm" onclick="Assembleias.solicitarRecontagem('${assembleia.id}')">🔄 Recontar Quórum</button>
                            ${votacaoAtiva && votacaoAtiva.status === 'ATIVA' ? `
                                <button class="btn btn-danger btn-sm" onclick="Assembleias.encerrarVotacaoManual('${assembleia.id}', '${votacaoAtiva.id}')">⏹️ Encerrar Votação</button>
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
            alert("Pedido registrado!");
        } catch (err) { alert("Erro."); }
    }

    async function concederPalavra(aid, pid) {
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/pedidos/${pid}/conceder`, { method: "POST" });
        } catch (err) { alert("Erro."); }
    }

    async function novaProposta(aid) {
        const titulo = prompt("Título da Proposta:");
        const descricao = prompt("Descrição:");
        if (!titulo || !descricao) return;
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/propostas`, {
                method: "POST",
                body: { titulo, descricao }
            });
            alert("Proposta submetida!");
        } catch (err) { alert("Erro."); }
    }

    async function votarProposta(aid, prid) {
        if (!confirm("Deseja iniciar a votação desta proposta agora?")) return;
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/propostas/${prid}/votar`, { method: "POST" });
        } catch (err) { alert("Erro."); }
    }

    async function solicitarRecontagem(aid) {
        if (!confirm("Deseja invalidar o quórum atual e solicitar recontagem?")) return;
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/token`, {
                method: "POST",
                body: { tipo_chamada: 'RECONTAGEM' }
            });
            alert("Recontagem iniciada! Todos devem fazer check-in novamente.");
            voltarParaLista();
        } catch (err) { alert("Erro."); }
    }

    async function prepararVotacaoItem(aid) {
        const titulo = prompt("Título do Item:");
        const descricao = prompt("Descrição:");
        const duracao = prompt("Duração em segundos (ex: 60):", "60");
        if (!titulo || !descricao) return;
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/votacoes`, {
                method: "POST",
                body: { titulo, descricao, duracao_segundos: parseInt(duracao) || 60 }
            });
        } catch (err) { alert("Erro."); }
    }

    async function encerrarVotacaoManual(aid, vid) {
        if (!confirm("Deseja encerrar esta votação manualmente?")) return;
        try {
            await window.Api.apiFetch(`/api/assembleias/${aid}/votacoes/${vid}/encerrar`, { method: "POST" });
        } catch (err) { alert("Erro."); }
    }

    global.Assembleias = {
        inicializarAssembleias,
        mudarFiltro,
        abrirDetalhes,
        voltarParaLista,
        entrarNaSala,
        realizarCheckin,

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
