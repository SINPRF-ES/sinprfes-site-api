/**
 * Módulo de Notificações Push (Página Inicial)
 */
(function (global) {
    if (global.Notificacoes) return;

    let historyCache = [];
    let isShowingArchived = false;

    function inicializarNotificacoes(perfil) {
        // Controle de visibilidade do menu
        const perfisAutorizados = ["ADMIN", "DIRETORIA", "COLABORADOR"];
        const navItem = document.getElementById('nav-notificacoes');

        if (navItem) {
            if (perfisAutorizados.includes(perfil)) {
                navItem.style.display = "block";
            } else {
                navItem.style.display = "none";
            }
        }

        setupHandlers();
        carregarHistorico();
        popularUFs();
    }

    function popularUFs() {
        const select = document.getElementById('push-target-uf');
        if (!select) return;
        const ufs = global.Canon?.UFS || ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
        select.innerHTML = ufs.map(uf => `<option value="${uf}">${uf}</option>`).join('');
    }

    function setupHandlers() {
        const btnSend = document.getElementById('btn-send-push');
        const titleInput = document.getElementById('push-title');
        const messageInput = document.getElementById('push-message');
        const targetTypeSelect = document.getElementById('push-target-type');
        const userSearchInput = document.getElementById('push-target-user-search');

        if (titleInput) {
            titleInput.addEventListener("input", () => {
                const len = titleInput.value.length;
                const counter = document.getElementById('push-title-count');
                if (counter) {
                    counter.textContent = len;
                    counter.style.color = len > 54 ? '#e74c3c' : ''; // Red if > 90% of 60
                    counter.style.fontWeight = len > 54 ? 'bold' : 'normal';
                }
            });
        }

        if (messageInput) {
            messageInput.addEventListener("input", () => {
                const len = messageInput.value.length;
                const counter = document.getElementById('push-message-count');
                if (counter) {
                    counter.textContent = len;
                    counter.style.color = len > 216 ? '#e74c3c' : ''; // Red if > 90% of 240
                    counter.style.fontWeight = len > 216 ? 'bold' : 'normal';
                }
            });
        }

        if (btnSend) {
            btnSend.addEventListener("click", handleSend);
        }

        if (targetTypeSelect) {
            targetTypeSelect.addEventListener("change", handleTargetTypeChange);
        }

        if (userSearchInput) {
            let debounceTimer;
            userSearchInput.addEventListener("input", () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => handleUserSearch(userSearchInput.value), 400);
            });
        }
    }

    function handleTargetTypeChange() {
        const type = document.getElementById('push-target-type').value;
        const container = document.getElementById('push-target-value-container');
        const ufSelect = document.getElementById('push-target-uf');
        const userWrapper = document.getElementById('push-target-user-wrapper');
        const label = document.getElementById('push-target-value-label');

        container.style.display = 'none';
        if (ufSelect) ufSelect.style.display = 'none';
        userWrapper.style.display = 'none';

        if (type === 'UF') {
            container.style.display = 'block';
            label.textContent = 'Selecionar UF:';
            if (ufSelect) ufSelect.style.display = 'block';
        } else if (type === 'MEMBRO' || type === 'USER') {
            container.style.display = 'block';
            label.textContent = 'Buscar Membro:';
            userWrapper.style.display = 'block';
        }
    }

    async function handleUserSearch(query) {
        if (!query || query.length < 2) return;
        const select = document.getElementById('push-target-user-select');
        select.innerHTML = '<option>Buscando...</option>';

        try {
            const r = await window.Api.apiFetch(`/api/users?q=${encodeURIComponent(query)}`);
            if (r.ok) {
                const data = await r.json();
                const users = data.users || [];
                if (users.length === 0) {
                    select.innerHTML = '<option value="">Nenhum encontrado</option>';
                } else {
                    select.innerHTML = users.map(f => `<option value="${f.id}" data-nome="${f.nome}" data-cpf="${f.cpf}">${f.nome} (CPF: ${f.cpf})</option>`).join('');
                }
            }
        } catch (e) {
            console.error("Erro na busca de users", e);
            select.innerHTML = '<option value="">Erro na busca</option>';
        }
    }

    async function handleSend() {
        const titleEl = document.getElementById('push-title');
        const messageEl = document.getElementById('push-message');
        const targetTypeEl = document.getElementById('push-target-type');

        const title = (titleEl ? titleEl.value : '').trim();
        const body = (messageEl ? messageEl.value : '').trim();
        const targetType = targetTypeEl ? targetTypeEl.value : 'ALL';

        if (!body) {
            alert("A mensagem é obrigatória.");
            return;
        }

        let targetValue = null;
        if (targetType === 'UF') {
            targetValue = document.getElementById('push-target-uf').value;
        } else if (targetType === 'USER') {
            const select = document.getElementById('push-target-user-select');
            const opt = select.options[select.selectedIndex];
            if (!opt || !opt.value) {
                alert("Selecione um user válido.");
                return;
            }
            targetValue = {
                id: opt.value,
                nome: opt.dataset.nome,
                cpf: opt.dataset.cpf
            };
        }

        let targetLabel = targetType;
        if ((targetType === 'MEMBRO' || targetType === 'USER') && targetValue && typeof targetValue === 'object') {
            const cpfFmt = (window.Formatters && window.Formatters.formatCpf) ? window.Formatters.formatCpf(targetValue.cpf) : targetValue.cpf;
            targetLabel = `Membro — ${targetValue.nome} (${cpfFmt})`;
        } else if (targetValue) {
            targetLabel = `${targetType} (${targetValue})`;
        }

        const confirmMsg = `Deseja realmente enviar esta notificação?\n\nDestino: ${targetLabel}\nMensagem: "${body}"`;
        if (!confirm(confirmMsg)) return;

        const btnSend = document.getElementById('btn-send-push');
        const originalText = btnSend.innerHTML;

        try {
            btnSend.disabled = true;
            btnSend.innerHTML = "⌛ Enviando...";

            const payload = {
                title: title || null,
                body: body,
                targetType,
                targetValue,
                data: {
                    screen: 'Notificacoes',
                    route: 'NotificacoesTab'
                }
            };

            const r = await window.Api.apiFetch('/api/push/campaigns/send', {
                method: 'POST',
                body: payload
            });

            const data = await r.json();

            if (r.ok) {
                alert(`Sucesso! Notificação enviada.\n🚀 Sucesso: ${data.sent}\n❌ Falhas: ${data.failed}\n🚫 Sem Token/Negado: ${data.noTokenOrDenied || 0}`);
                document.getElementById('push-title').value = '';
                document.getElementById('push-message').value = '';

                const titleCount = document.getElementById('push-title-count');
                titleCount.textContent = '0';
                titleCount.style.color = '';
                titleCount.style.fontWeight = 'normal';

                const messageCount = document.getElementById('push-message-count');
                messageCount.textContent = '0';
                messageCount.style.color = '';
                messageCount.style.fontWeight = 'normal';

                carregarHistorico();
            } else {
                const errorMsg = data.message || data.error || "Erro ao enviar notificação.";
                if (r.status === 429) {
                    alert("Limite atingido. Você só pode enviar 2 notificações por minuto.");
                } else {
                    alert(errorMsg);
                }
            }
        } catch (e) {
            console.error("Notificacoes.SendErro", e);
            alert("Erro de conexão ao enviar notificação.");
        } finally {
            btnSend.disabled = false;
            btnSend.innerHTML = originalText;
        }
    }

    async function carregarHistorico() {
        const listEl = document.getElementById('push-history-list');
        if (!listEl) return;

        try {
            const url = isShowingArchived ? '/api/push/campaigns?includeArchived=1' : '/api/push/campaigns';
            const r = await window.Api.apiFetch(url);
            if (r.ok) {
                const data = await r.json();
                historyCache = data.campaigns || [];
                renderizarHistorico(listEl);
            } else {
                listEl.innerHTML = `<p style="color:red;">Erro ao carregar histórico.</p>`;
            }
        } catch (e) {
            console.error("Notificacoes.HistoryErro", e);
            listEl.innerHTML = `<p style="color:red;">Erro de conexão ao carregar histórico.</p>`;
        }
    }

    function renderizarHistorico(container) {
        if (!historyCache.length) {
            container.innerHTML = `<p>Nenhum envio realizado ainda.</p>`;
            return;
        }

        let html = historyCache.map(c => {
            const data = formatarData(c.created_at);
            const statusClass = c.status === 'SENT' ? 'status-sent' : 'status-failed';
            const statusLabel = c.status === 'SENT' ? 'Enviado' : 'Falhou';

            let displayTargetValue = c.target_value;
            if ((c.target_type === 'USER' || c.target_type === 'MEMBRO') && c.target_value) {
                let parsed = null;
                if (typeof c.target_value === 'object') {
                    parsed = c.target_value;
                } else {
                    try {
                        parsed = JSON.parse(c.target_value);
                    } catch (e) {
                        parsed = null;
                    }
                }

                if (parsed && typeof parsed === 'object') {
                    displayTargetValue = `${parsed.nome || ''} (${window.Formatters?.formatCpf(parsed.cpf || '') || parsed.cpf || ''})`;
                    if (displayTargetValue.trim() === '()') displayTargetValue = parsed.id || c.target_value;
                }
            }

            const targetLabel = c.target_type + (displayTargetValue ? `: ${displayTargetValue}` : '');

            return `
                <div class="history-card">
                    <div class="history-header">
                        <span class="history-date">${data}</span>
                        <span class="history-status ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="history-author">Por: ${c.autor_nome || 'Sistema'} | Destino: ${targetLabel}</div>
                    ${c.title ? `<div class="history-title">${c.title}</div>` : ''}
                    <div class="history-body" style="white-space: pre-wrap;">${c.body}</div>
                    <div class="history-results">
                        <span title="Sucesso">🚀 ${c.result?.sent || 0}</span>
                        <span title="Falhas">❌ ${c.result?.failed || 0}</span>
                        <span title="Sem Token ou Negado">🚫 ${c.result?.noTokenOrDenied || 0}</span>
                    </div>
                </div>
            `;
        }).join('');

        if (!isShowingArchived && historyCache.length >= 5) {
            html += `
                <div style="text-align: center; margin-top: 15px;">
                    <button id="btn-show-archived" class="btn btn-outline btn-sm">Visualizar anteriores</button>
                </div>
            `;
        } else if (isShowingArchived) {
            html += `
                <div style="text-align: center; margin-top: 15px;">
                    <button id="btn-hide-archived" class="btn btn-outline btn-sm">Ver apenas recentes</button>
                </div>
            `;
        }

        container.innerHTML = html;

        // Atribui handlers após renderizar
        const btnShow = document.getElementById('btn-show-archived');
        if (btnShow) btnShow.addEventListener("click", () => { isShowingArchived = true; carregarHistorico(); });

        const btnHide = document.getElementById('btn-hide-archived');
        if (btnHide) btnHide.addEventListener("click", () => { isShowingArchived = false; carregarHistorico(); });
    }

    function formatarData(isoStr) {
        if (!isoStr) return "";
        const d = new Date(isoStr);
        return d.toLocaleString('pt-BR');
    }

    global.Notificacoes = {
        inicializarNotificacoes,
        carregarHistorico
    };

})(typeof window !== 'undefined' ? window : global);
