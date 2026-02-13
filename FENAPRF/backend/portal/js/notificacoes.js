/**
 * Módulo de Notificações Push (Página Inicial)
 * Espelhamento 1:1 com o App
 */
(function (global) {
    if (global.Notificacoes) return;

    let historyCache = [];
    let isShowingArchived = false;
    let selectedUsers = []; // Array de objetos {id, nome, cpf}

    function inicializarNotificacoes(perfil) {
        // Regra de acesso já tratada pelo orchestrator, mas garantimos aqui
        const perfisAutorizados = ["ADMIN", "DIRETORIA", "COLABORADOR"];
        if (!perfisAutorizados.includes(perfil)) return;

        setupInterface();
        setupHandlers();
        carregarHistorico();
    }

    function setupInterface() {
        const secNotif = document.getElementById('sec-notificacoes');
        if (!secNotif) return;

        // Injetar Estilos para Chips e Targets
        if (!document.getElementById('style-notificacoes')) {
            const s = document.createElement('style');
            s.id = 'style-notificacoes';
            s.textContent = `
                .notif-form-grid { display: grid; grid-template-columns: 1fr; gap: 20px; max-width: 700px; margin: 0 auto; }
                @media (min-width: 900px) { .notif-form-grid { grid-template-columns: 1fr; } }

                .target-chips-container { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
                .target-chip {
                    background: #eef2f7; border: 1px solid var(--azul-header); border-radius: 20px;
                    padding: 5px 12px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;
                    color: var(--azul-header);
                }
                .target-chip i { cursor: pointer; color: #c53030; }
                .target-chip i:hover { color: #e53e3e; }

                .search-results-dropdown {
                    position: absolute; z-index: 100; background: #fff; border: 1px solid #ddd;
                    border-radius: 8px; width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    max-height: 200px; overflow-y: auto; display: none;
                }
                .search-item { padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f9f9f9; }
                .search-item:hover { background: #f0f7ff; }
                .search-item strong { display: block; color: var(--azul-header); }
                .search-item small { color: #888; }
            `;
            document.head.appendChild(s);
        }

        secNotif.innerHTML = `
            <div class="section-card">
                <div class="af-standard-header">
                    <h2>📢 Notificações Push</h2>
                    <p class="section-subtitle">Envie mensagens em tempo real para os membros com o app instalado.</p>
                </div>

                <div class="notif-form-grid">
                    <div class="form-container">
                        <div class="field-group">
                            <label>Público de Destino</label>
                            <select id="push-target-type">
                                <option value="ALL">Todos os membros com app</option>
                                ${global.Canon?.FILTROS_MEMBROS
                                    .filter(f => !['ADMIN_COLAB', 'ADMIN', 'COLABORADOR'].includes(f.value))
                                    .map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
                                <option value="USER">Individual (Pesquisar)</option>
                            </select>
                        </div>

                        <!-- Container para UF -->
                        <div id="container-target-uf" class="field-group" style="display:none; margin-top:15px;">
                            <label>Selecionar UF</label>
                            <select id="push-target-uf">
                                ${ (global.Canon?.UFS || []).map(uf => `<option value="${uf}">${uf}</option>`).join('') }
                            </select>
                        </div>

                        <!-- Container para Usuários Individuais -->
                        <div id="container-target-users" class="field-group" style="display:none; margin-top:15px; position:relative;">
                            <label>Buscar Membros</label>
                            <input type="text" id="push-user-search" placeholder="Digite nome ou CPF..." autocomplete="off">
                            <div id="push-search-results" class="search-results-dropdown"></div>

                            <div id="selected-users-chips" class="target-chips-container"></div>
                            <small class="info-label" style="display:block; margin-top:5px; color:#999; font-style:italic;">Selecione um ou mais membros para o envio específico.</small>
                        </div>

                        <div class="field-group" style="margin-top:20px;">
                            <label>Título *</label>
                            <input type="text" id="push-title" maxlength="60" placeholder="Ex: Informativo FENAPRF">
                            <small class="char-counter"><span id="push-title-count">0</span>/60</small>
                        </div>

                        <div class="field-group" style="margin-top:15px;">
                            <label>Mensagem *</label>
                            <textarea id="push-message" maxlength="240" rows="4" placeholder="Digite sua mensagem aqui..."></textarea>
                            <small class="char-counter"><span id="push-message-count">0</span>/240</small>
                        </div>

                        <button id="btn-send-push" class="btn btn-primary" style="margin-top:25px; width:100%; height:50px; font-size:1.1rem;">
                            <i class="fas fa-paper-plane"></i> Enviar Agora
                        </button>
                    </div>

                    <div class="history-container" style="margin-top:40px;">
                        <h3 style="border-bottom:2px solid #eee; padding-bottom:10px; margin-bottom:20px; color:#333;">📜 Histórico de Envios</h3>
                        <div id="push-history-list" class="history-list">
                            <p style="text-align:center; padding:20px; color:#999;">Carregando histórico...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function setupHandlers() {
        const targetType = document.getElementById('push-target-type');
        const userSearch = document.getElementById('push-user-search');
        const titleInput = document.getElementById('push-title');
        const messageInput = document.getElementById('push-message');
        const btnSend = document.getElementById('btn-send-push');

        if (!targetType) return;

        targetType.addEventListener('change', () => {
            document.getElementById('container-target-uf').style.display = (targetType.value === 'UF') ? 'block' : 'none';
            document.getElementById('container-target-users').style.display = (targetType.value === 'USER') ? 'block' : 'none';
        });

        // Busca de Usuários
        let debounceTimer;
        userSearch.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = userSearch.value.trim();
            if (query.length < 2) {
                document.getElementById('push-search-results').style.display = 'none';
                return;
            }
            debounceTimer = setTimeout(() => realizarBuscaUsuarios(query), 400);
        });

        // Contadores
        titleInput.addEventListener('input', () => {
            document.getElementById('push-title-count').textContent = titleInput.value.length;
        });
        messageInput.addEventListener('input', () => {
            document.getElementById('push-message-count').textContent = messageInput.value.length;
        });

        btnSend.addEventListener('click', handleSend);

        // Clique fora para fechar busca
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#container-target-users')) {
                document.getElementById('push-search-results').style.display = 'none';
            }
        });
    }

    async function realizarBuscaUsuarios(query) {
        const resultsDiv = document.getElementById('push-search-results');
        resultsDiv.innerHTML = '<div style="padding:10px; color:#999;">Buscando...</div>';
        resultsDiv.style.display = 'block';

        try {
            // Usa o helper de busca global do portal
            const results = await global.Utils.searchUsers(query);

            if (results.length === 0) {
                resultsDiv.innerHTML = '<div style="padding:10px; color:#999;">Nenhum membro encontrado.</div>';
            } else {
                resultsDiv.innerHTML = results.slice(0, 10).map(u => `
                    <div class="search-item" onclick="window.Notificacoes.selecionarUsuario('${u.id}', '${u.nome}', '${u.cpf}')">
                        <strong>${u.nome}</strong>
                        <small>CPF: ${global.Formatters?.formatCpf(u.cpf) || u.cpf}</small>
                    </div>
                `).join('');
            }
        } catch (e) {
            resultsDiv.innerHTML = '<div style="padding:10px; color:red;">Erro na busca.</div>';
        }
    }

    function selecionarUsuario(id, nome, cpf) {
        if (selectedUsers.find(u => u.id === id)) {
            document.getElementById('push-search-results').style.display = 'none';
            return;
        }
        selectedUsers.push({ id, nome, cpf });
        renderizarChips();
        document.getElementById('push-user-search').value = '';
        document.getElementById('push-search-results').style.display = 'none';
    }

    function removerUsuario(id) {
        selectedUsers = selectedUsers.filter(u => u.id !== id);
        renderizarChips();
    }

    function renderizarChips() {
        const container = document.getElementById('selected-users-chips');
        container.innerHTML = selectedUsers.map(u => `
            <div class="target-chip">
                ${u.nome}
                <i class="fas fa-times-circle" onclick="window.Notificacoes.removerUsuario('${u.id}')"></i>
            </div>
        `).join('');
    }

    async function handleSend() {
        const title = document.getElementById('push-title').value.trim();
        const body = document.getElementById('push-message').value.trim();
        const targetType = document.getElementById('push-target-type').value;

        if (!title) return alert("O título é obrigatório.");
        if (!body) return alert("A mensagem é obrigatória.");

        let targetValue = null;
        if (targetType === 'UF') {
            targetValue = document.getElementById('push-target-uf').value;
        } else if (targetType === 'USER') {
            if (selectedUsers.length === 0) return alert("Selecione pelo menos um membro.");
            targetValue = selectedUsers.map(u => ({ id: u.id, nome: u.nome, cpf: u.cpf }));
        }

        const confirmMsg = `Deseja realmente enviar esta notificação?\n\nTítulo: ${title}\nMensagem: ${body}`;
        if (!confirm(confirmMsg)) return;

        const btn = document.getElementById('btn-send-push');
        const oldHtml = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

            const payload = {
                title,
                body,
                targetType,
                targetValue,
                data: { screen: 'Notificacoes', route: 'NotificacoesTab' }
            };

            const r = await window.Api.apiFetch('/api/push/campaigns/send', {
                method: 'POST',
                body: payload
            });

            const data = await r.json();

            if (r.ok) {
                alert(`Sucesso! Notificação enviada.\n🚀 Sucesso: ${data.sent}\n❌ Falhas: ${data.failed}`);
                document.getElementById('push-title').value = '';
                document.getElementById('push-message').value = '';
                document.getElementById('push-title-count').textContent = '0';
                document.getElementById('push-message-count').textContent = '0';
                selectedUsers = [];
                renderizarChips();
                carregarHistorico();
            } else {
                alert(data.message || "Erro ao enviar.");
            }
        } catch (e) {
            alert("Erro de conexão.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    }

    async function carregarHistorico() {
        const container = document.getElementById('push-history-list');
        try {
            const url = isShowingArchived ? '/api/push/campaigns?includeArchived=1' : '/api/push/campaigns';
            const r = await window.Api.apiFetch(url);
            if (!r.ok) throw new Error();
            const data = await r.json();
            historyCache = data.campaigns || [];
            renderizarHistorico(container);
        } catch (e) {
            container.innerHTML = '<p style="color:red; text-align:center;">Erro ao carregar histórico.</p>';
        }
    }

    function renderizarHistorico(container) {
        if (historyCache.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">Nenhum envio registrado.</p>';
            return;
        }

        container.innerHTML = historyCache.map(c => {
            const dataFmt = global.Formatters?.formatISOToBR(c.created_at) || c.created_at;
            const statusColor = c.status === 'SENT' ? '#2ecc71' : '#e74c3c';

            let targetLabel = c.target_type;
            if (c.target_type === 'USER' && c.target_value) {
                try {
                    const val = typeof c.target_value === 'string' ? JSON.parse(c.target_value) : c.target_value;
                    if (Array.isArray(val)) {
                        targetLabel = val.length === 1 ? `Individual: ${val[0].nome}` : `${val.length} membros`;
                    } else if (val.nome) {
                        targetLabel = `Individual: ${val.nome}`;
                    }
                } catch(e) {}
            } else if (c.target_type === 'UF') {
                targetLabel = `UF: ${c.target_value}`;
            } else {
                const filtro = global.Canon?.FILTROS_MEMBROS.find(f => f.value === c.target_type);
                if (filtro) targetLabel = filtro.label;
            }

            return `
                <div class="history-card" style="border-left:4px solid var(--azul-header); padding:15px; background:#fff; border-radius:10px; margin-bottom:12px; border:1px solid #eee;">
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#999; margin-bottom:5px;">
                        <span>${dataFmt}</span>
                        <span style="color:${statusColor}; font-weight:bold;">${c.status === 'SENT' ? 'ENVIADO' : 'FALHOU'}</span>
                    </div>
                    <div style="font-size:0.85rem; color:#666; margin-bottom:8px;">
                        Por: ${c.autor_nome || 'Sistema'} | Destino: ${targetLabel}
                    </div>
                    <strong style="display:block; margin-bottom:5px; color:#333;">${c.title || '(Sem título)'}</strong>
                    <div style="font-size:0.95rem; color:#444; white-space:pre-wrap; margin-bottom:10px;">${c.body}</div>
                    <div style="display:flex; gap:15px; font-size:0.8rem; border-top:1px solid #f9f9f9; padding-top:8px;">
                        <span title="Sucesso">🚀 ${c.result?.sent || 0}</span>
                        <span title="Falhas">❌ ${c.result?.failed || 0}</span>
                        <span title="Sem Token/Negado">🚫 ${c.result?.noTokenOrDenied || 0}</span>
                    </div>
                </div>
            `;
        }).join('') + (historyCache.length >= 5 ? `
            <div style="text-align:center; margin-top:15px;">
                <button class="btn btn-outline btn-sm" onclick="window.Notificacoes.toggleArquivados()">
                    ${isShowingArchived ? 'Ver apenas recentes' : 'Visualizar anteriores'}
                </button>
            </div>
        ` : '');
    }

    function toggleArquivados() {
        isShowingArchived = !isShowingArchived;
        carregarHistorico();
    }

    global.Notificacoes = {
        inicializarNotificacoes,
        selecionarUsuario,
        removerUsuario,
        toggleArquivados
    };

})(typeof window !== 'undefined' ? window : global);
