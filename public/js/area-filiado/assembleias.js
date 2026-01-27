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
                    <div style="display:flex; flex-direction:column; align-items:center; gap:15px; text-align:center;">
                        <h2 style="color:#003366; margin:0; font-size:1.6rem;">🗳️ Assembleias e Votações</h2>
                        <div style="width:100%; max-width:200px;">
                            <label style="font-size:0.8rem; color:#666; display:block; margin-bottom:4px;">Filtrar por status:</label>
                            <select id="filtro-assembleias" class="btn btn-outline" style="width:100%; color:#333; background:#fff; border-radius:8px;" onchange="Assembleias.mudarFiltro(this.value)">
                                <option value="ATIVAS">Ativas</option>
                                <option value="ENCERRADAS">Encerradas</option>
                                <option value="TODAS">Todas</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div id="area-assembleias-lista" style="margin-top:20px;">
                    <p class="text-center">Carregando assembleias...</p>
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
            container.innerHTML = "<p class='text-center' style='padding:40px; color:#666;'>Nenhuma assembleia nesta categoria.</p>";
            return;
        }

        container.innerHTML = assembleias.map(a => {
            const label = window.AssembleiaUtils.getStatusLabel(a.estado);
            const emoji = window.AssembleiaUtils.getStatusEmoji(a.estado);
            const dataBr = window.Formatters.formatISOToBR(a.data_evento);

            return `
                <div class="section-card filiado-card" style="margin-bottom:20px; background:#fff; border-left:6px solid #003366; transition:transform 0.2s;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                        <div style="flex:1; min-width:280px;">
                            <div style="margin-bottom:8px;">
                                <span class="filiado-badge" style="background:#eef2f7; color:#003366;">${label}</span>
                            </div>
                            <h3 style="margin:0; color:#003366; font-size:1.2rem;">${emoji} ${a.tipo} - ${a.titulo}</h3>
                            <div style="margin-top:8px; font-size:0.95rem; color:#555; display:flex; gap:15px; flex-wrap:wrap;">
                                <span>📅 <strong>Data:</strong> ${dataBr}</span>
                                <span>🕒 <strong>Horário:</strong> ${a.hora_primeira_chamada || '--:--'} (1ª) / ${a.hora_segunda_chamada || '--:--'} (2ª)</span>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <button class="btn btn-primary btn-lg" onclick="Assembleias.abrirDetalhes('${a.id}')">Ver Detalhes</button>
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
        container.innerHTML = "<p class='text-center'>Carregando detalhes...</p>";

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
                <div class="section-card" style="background:#fff; color:#333; padding:30px;">
                    <div style="display:flex; justify-content:flex-start; margin-bottom:20px;">
                        <button class="btn btn-outline btn-sm" onclick="Assembleias.voltarParaLista()">← Voltar para Lista</button>
                    </div>

                    <div style="text-align:center; margin-bottom:25px;">
                        <div style="margin-bottom:10px;">
                            <span class="filiado-badge">${label}</span>
                        </div>
                        <h2 style="color:#003366; margin:0; font-size:1.8rem;">${a.titulo}</h2>
                        <div style="margin-top:10px; color:#666; font-weight:600;">${a.tipo}</div>
                    </div>

                    <div class="section-block section-block-alt">
                        <h4 style="color:#003366; margin-bottom:15px; border-bottom:1px solid #ddd; padding-bottom:8px;">📌 Pauta da Assembleia</h4>
                        <div style="color:#444; white-space: pre-wrap; line-height:1.6; font-size:1rem;">${a.pauta}</div>
                    </div>

                    <div class="field-row" style="margin-bottom:30px; display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px;">
                        <div class="field-group">
                            <label style="font-weight:bold; color:#003366;">📅 Data do Evento</label>
                            <input type="text" value="${dataBr}" readonly style="background:#f9f9f9; font-weight:bold;" />
                        </div>
                        <div class="field-group">
                            <label style="font-weight:bold; color:#003366;">🕒 Chamadas (1ª / 2ª)</label>
                            <input type="text" value="${a.hora_primeira_chamada} / ${a.hora_segunda_chamada}" readonly style="background:#f9f9f9; font-weight:bold;" />
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:30px;">
                        <!-- Edital -->
                        <div class="section-box" style="background:#fff; border:1px solid #e0e0e0; border-radius:12px; padding:20px;">
                            <h4 style="color:#003366; margin-bottom:15px; display:flex; align-items:center; gap:8px;">📄 Edital de Convocação</h4>
                            ${a.edital_url ? `
                                <button class="btn btn-outline" style="width:100%; padding:12px;" onclick="window.open('${a.edital_url}', '_blank')">Visualizar Edital</button>
                            ` : '<p style="font-style:italic; color:#999; text-align:center;">Sem edital anexado.</p>'}
                        </div>

                        <!-- Quórum -->
                        <div class="section-box" style="background:#fff; border:1px solid #e0e0e0; border-radius:12px; padding:20px;">
                            <h4 style="color:#003366; margin-bottom:15px; display:flex; align-items:center; gap:8px;">👥 Quórum Atual</h4>
                            <div style="text-align:center;">
                                <p style="font-size:1.8rem; font-weight:bold; margin-bottom:5px; color:#003366;">${estado.quorumVigente?.total || 0}</p>
                                <p style="font-size:0.85rem; color:#666; margin-bottom:15px;">Filiados Presentes</p>
                            </div>
                            ${estado.quorumVigente ? `
                                <div style="font-size:0.85rem; color:#666; background:#f8f9fa; padding:10px; border-radius:6px; margin-bottom:15px;">
                                    ${a.estado !== 'EM_CURSO' ? `
                                        <strong>Chamada:</strong> ${estado.quorumVigente.tipo_chamada === 'PRIMEIRA' ? '1ª (Qualificado)' : '2ª (Real)'}<br>
                                        <strong>Mínimo:</strong> ${estado.quorumVigente.quorum_necessario || 'Qualquer número'}
                                    ` : '<strong>Status:</strong> Assembleia em andamento.'}
                                </div>
                            ` : ''}

                            <details style="margin-top:10px;">
                                <summary style="cursor:pointer; color:#003366; font-size:0.9rem; font-weight:600;">Ver Lista Nominal</summary>
                                <div style="margin-top:10px; max-height:150px; overflow-y:auto; font-size:0.85rem; padding:10px; background:#fff; border:1px solid #eee; border-radius:6px;">
                                    ${estado.quorumVigente?.presentes?.length ?
                                        estado.quorumVigente.presentes.map(p => `<div style="padding:4px 0; border-bottom:1px solid #f9f9f9;">✅ ${p.nome}</div>`).join("") :
                                        '<p style="color:#999; text-align:center;">Nenhum registro.</p>'}
                                </div>
                            </details>
                        </div>
                    </div>

                    <!-- Gestão (Diretoria) -->
                    ${isDiretoria ? `
                        <div class="section-block" style="margin-bottom:30px; border:2px solid #003366; background:#f0f4f8;">
                            <h4 style="color:#003366; margin-bottom:15px; text-transform:uppercase; font-size:0.9rem; letter-spacing:1px; display:flex; align-items:center; gap:8px;">🛠️ Ações de Gestão</h4>
                            <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
                                ${a.estado === 'CRIADA' ? `<button class="btn btn-primary" onclick="Assembleias.abrirAssembleia('${id}')">Abrir Assembleia</button>` : ''}
                                ${a.estado === 'ABERTA' ? `
                                    <button class="btn btn-primary" onclick="Assembleias.prepararMesa('${id}')">Compor Mesa</button>
                                    <button class="btn btn-primary" onclick="Assembleias.gerarTokenToken('${id}')">Gerar Token</button>
                                    <button class="btn btn-success" onclick="Assembleias.iniciarExecucao('${id}')">Iniciar Execução</button>
                                ` : ''}
                                ${isParticipavel ? `<button class="btn btn-danger" onclick="Assembleias.encerrarAssembleia('${id}')">Encerrar</button>` : ''}
                                ${a.estado === 'ENCERRADA' ? `<button class="btn btn-primary" onclick="Assembleias.solicitarRelatorio('${id}')">Solicitar Relatório PDF</button>` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Ações Principal -->
                    <div id="area-acoes-detalhe">
                        ${isParticipavel ? `
                            ${hasCheckedIn ? `
                                <button class="btn btn-success btn-lg" style="width:100%; padding:20px; font-size:1.4rem; border-radius:15px; box-shadow:0 4px 15px rgba(39, 174, 96, 0.3);" onclick="Assembleias.entrarNaSala('${id}')">🚪 Entrar na Sala de Votação</button>
                            ` : `
                                <div class="section-box" style="border:1px solid #f1c40f; background:#fffdf0; padding:25px; text-align:center; border-radius:15px;">
                                    <h4 style="color:#856404; margin-bottom:10px;">Check-in Necessário</h4>
                                    <p style="font-size:1rem; margin-bottom:20px; color:#555;">Para participar e votar, informe o token de 6 dígitos fornecido pela mesa.</p>
                                    <div style="display:flex; gap:10px; max-width:400px; margin:0 auto; flex-wrap:wrap;">
                                        <input type="text" id="token-input" placeholder="000000" maxlength="6" style="flex:1; text-align:center; font-size:1.8rem; letter-spacing:8px; padding:10px; border:2px solid #f1c40f; border-radius:10px;" />
                                        <button class="btn btn-primary btn-lg" style="padding:0 30px;" onclick="Assembleias.realizarCheckin('${id}')">Confirmar Presença</button>
                                    </div>
                                </div>
                            `}
                        ` : `
                            <div class="section-block section-block-alt" style="text-align:center; padding:40px;">
                                <div style="font-size:3rem; margin-bottom:15px;">${a.estado === 'CRIADA' ? '⏳' : '🏁'}</div>
                                <h3 style="color:#666;">
                                    ${a.estado === 'CRIADA' ? 'Assembleia agendada. Aguarde a abertura oficial.' : 'Esta assembleia já foi encerrada.'}
                                </h3>
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
            <div class="section-card" style="background:#fff; color:#333; padding:25px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px; flex-wrap:wrap; gap:10px;">
                    <button class="btn btn-outline btn-sm" onclick="Assembleias.abrirDetalhes('${assembleia.id}')">← Sair da Sala</button>
                    <h3 style="color:#003366; margin:0; text-align:center; flex:1; min-width:200px;">🏛️ Sala de Votação Interativa</h3>
                    <div class="filiado-badge" style="background:#003366; color:#fff;">${quorumVigente?.total || 0} Presentes</div>
                </div>

                <div style="text-align:center; margin-bottom:30px; border-bottom:1px solid #eee; padding-bottom:15px;">
                    <h4 style="color:#003366; font-size:1.3rem; margin:0;">${assembleia.titulo}</h4>
                    <p style="margin-top:5px; color:#666; font-size:0.9rem;">${assembleia.tipo}</p>
                </div>

                <!-- Mesa -->
                <div class="section-box" style="margin-bottom:30px; border:1px solid #003366; background:#f0f7ff; border-radius:12px; padding:20px;">
                    <h4 style="color:#003366; margin-bottom:15px; text-align:center; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px;">🧑‍⚖️ Mesa Diretora</h4>
                    <div style="display:flex; justify-content:space-around; flex-wrap:wrap; gap:20px;">
                        <div style="text-align:center;">
                            <small style="color:#666; font-weight:bold; text-transform:uppercase;">Presidente</small><br>
                            <strong style="font-size:1.1rem; color:#003366;">${mesa?.presidente_nome || 'A definir'}</strong>
                        </div>
                        <div style="text-align:center;">
                            <small style="color:#666; font-weight:bold; text-transform:uppercase;">Secretário</small><br>
                            <strong style="font-size:1.1rem; color:#003366;">${mesa?.secretario_nome || 'A definir'}</strong>
                        </div>
                    </div>
                </div>

                <!-- Votação Ativa -->
                <div id="area-votacao-ativa" style="margin-bottom:35px;">
                    ${votacaoAtiva ? `
                        <div class="section-block" style="border:3px solid #27ae60; background:#f9fff9; border-radius:15px; padding:25px; box-shadow:0 8px 25px rgba(39, 174, 96, 0.1);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                                <span class="filiado-badge" style="background:#27ae60; color:#fff; padding:6px 12px;">🗳️ VOTAÇÃO EM CURSO</span>
                                <div id="timer-votacao" style="font-weight:bold; color:#e74c3c; font-size:1.8rem; font-family:monospace;">--:--</div>
                            </div>
                            <h4 style="margin:0 0 10px 0; color:#003366; font-size:1.4rem;">${votacaoAtiva.titulo}</h4>
                            <p style="font-size:1rem; color:#444; line-height:1.5;">${votacaoAtiva.descricao}</p>

                            ${votacaoAtiva.status === 'ATIVA' && !votacaoAtiva.userVoted ? `
                                <div style="display:flex; gap:15px; margin-top:25px; flex-wrap:wrap;">
                                    <button class="btn btn-success btn-lg" style="flex:1; font-size:1.5rem; padding:15px; border-radius:12px;" onclick="Assembleias.votar('${assembleia.id}', '${votacaoAtiva.id}', 'SIM')">SIM</button>
                                    <button class="btn btn-danger btn-lg" style="flex:1; font-size:1.5rem; padding:15px; border-radius:12px;" onclick="Assembleias.votar('${assembleia.id}', '${votacaoAtiva.id}', 'NAO')">NÃO</button>
                                </div>
                            ` : `
                                <div style="margin-top:25px; padding:20px; text-align:center; color:#27ae60; font-weight:bold; background:#e8f5e9; border-radius:10px; font-size:1.2rem;">
                                    ${votacaoAtiva.userVoted ? '✅ Seu voto foi computado com sucesso.' : 'Aguardando encerramento...'}
                                </div>
                            `}

                            <div style="margin-top:25px; display:flex; justify-content:space-around; font-size:1rem; border-top:2px dashed #ddd; padding-top:20px; color:#333;">
                                <span>SIM: <strong style="color:#27ae60; font-size:1.2rem;">${votacaoAtiva.contagem?.SIM || 0}</strong></span>
                                <span>NÃO: <strong style="color:#e74c3c; font-size:1.2rem;">${votacaoAtiva.contagem?.NAO || 0}</strong></span>
                                <span>TOTAL: <strong style="font-size:1.2rem;">${votacaoAtiva.contagem?.total || 0}</strong></span>
                            </div>
                        </div>
                    ` : `
                        <div class="section-block section-block-alt" style="text-align:center; padding:50px; border-radius:15px;">
                            <div style="font-size:3rem; margin-bottom:15px;">📋</div>
                            <p style="color:#666; font-size:1.1rem;">Aguardando o próximo item de pauta ser liberado pela mesa para votação.</p>
                        </div>
                    `}
                </div>

                <!-- Ações de Interação -->
                <div style="display:flex; gap:15px; margin-bottom:35px; flex-wrap:wrap;">
                    <button class="btn btn-outline btn-lg" style="flex:1; padding:15px;" onclick="Assembleias.pedirPalavra('${assembleia.id}')">🎤 Pedir a Palavra</button>
                    <button class="btn btn-outline btn-lg" style="flex:1; padding:15px;" onclick="Assembleias.novaProposta('${assembleia.id}')">📝 Apresentar Proposta</button>
                </div>

                <!-- Listas de Interação -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:25px;">
                    <!-- Pedidos de Palavra -->
                    <div class="section-box" style="background:#fff; border:1px solid #ddd; border-radius:12px; padding:15px;">
                        <h4 style="color:#003366; margin-bottom:15px; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #eee; padding-bottom:8px; display:flex; align-items:center; gap:8px;">🗣️ Fila de Oradores</h4>
                        <div style="max-height:300px; overflow-y:auto; padding:5px;">
                            ${pedidosPalavra?.length ? pedidosPalavra.map(p => `
                                <div style="padding:12px; border-bottom:1px solid #f5f5f5; display:flex; justify-content:space-between; align-items:center;">
                                    <div style="font-size:0.95rem;">
                                        <strong style="color:#003366;">${p.filiado_nome}</strong><br>
                                        <span class="filiado-badge" style="font-size:0.7rem; margin-top:4px;">${p.status}</span>
                                    </div>
                                    ${temAutoridade && p.status === 'PENDENTE' ? `
                                        <button class="btn btn-primary btn-sm" onclick="Assembleias.concederPalavra('${assembleia.id}', '${p.id}')">Conceder</button>
                                    ` : ''}
                                </div>
                            `).join("") : '<p style="padding:20px; color:#999; font-size:0.9rem; text-align:center; font-style:italic;">Ninguém na fila no momento.</p>'}
                        </div>
                    </div>

                    <!-- Propostas -->
                    <div class="section-box" style="background:#fff; border:1px solid #ddd; border-radius:12px; padding:15px;">
                        <h4 style="color:#003366; margin-bottom:15px; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #eee; padding-bottom:8px; display:flex; align-items:center; gap:8px;">📝 Propostas em Pauta</h4>
                        <div style="max-height:300px; overflow-y:auto; padding:5px;">
                            ${propostas?.length ? propostas.map(pr => `
                                <div style="padding:12px; border-bottom:1px solid #f5f5f5;">
                                    <div style="font-size:0.95rem;">
                                        <strong style="color:#003366;">${pr.titulo}</strong><br>
                                        <small style="color:#666;">Autor: ${pr.autor_nome}</small>
                                    </div>
                                    <div style="margin-top:6px;">
                                        <span class="filiado-badge" style="font-size:0.7rem;">${pr.status}</span>
                                    </div>
                                    ${temAutoridade && pr.status === 'ATIVA' ? `
                                        <button class="btn btn-success btn-sm" style="margin-top:10px; width:100%;" onclick="Assembleias.votarProposta('${assembleia.id}', '${pr.id}')">Submeter à Votação</button>
                                    ` : ''}
                                </div>
                            `).join("") : '<p style="padding:20px; color:#999; font-size:0.9rem; text-align:center; font-style:italic;">Nenhuma proposta apresentada.</p>'}
                        </div>
                    </div>
                </div>

                ${temAutoridade ? `
                    <div class="section-block" style="margin-top:40px; border:2px solid #e74c3c; background:#fff8f8; border-radius:15px; padding:20px;">
                        <h4 style="color:#e74c3c; margin-bottom:15px; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; display:flex; align-items:center; gap:8px;">🛠️ Painel de Controle da Mesa</h4>
                        <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
                            <button class="btn btn-outline btn-sm" onclick="Assembleias.prepararVotacaoItem('${assembleia.id}')">➕ Novo Item Votação</button>
                            <button class="btn btn-outline btn-sm" onclick="Assembleias.solicitarRecontagem('${assembleia.id}')">🔄 Recontar Quórum</button>
                            ${votacaoAtiva && votacaoAtiva.status === 'ATIVA' ? `
                                <button class="btn btn-danger btn-sm" onclick="Assembleias.encerrarVotacaoManual('${assembleia.id}', '${votacaoAtiva.id}')">⏹️ Encerrar Votação Agora</button>
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
