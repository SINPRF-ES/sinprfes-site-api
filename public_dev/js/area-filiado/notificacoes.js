/**
 * Módulo de Notificações Push (Página Inicial)
 */
(function (global) {
    if (global.Notificacoes) return;

    let historyCache = [];
    let isShowingArchived = false;

    function inicializarNotificacoes(perfil) {
        console.log("Notificacoes: Inicializando para perfil:", perfil);

        // Controle de visibilidade do menu
        const perfisAutorizados = ["ADMIN", "DIRETORIA", "FUNCIONARIO"];
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
    }

    function setupHandlers() {
        const btnSend = document.getElementById('btn-send-push');
        const titleInput = document.getElementById('push-title');
        const messageInput = document.getElementById('push-message');
        const targetTypeSelect = document.getElementById('push-target-type');
        const filiadoSearchInput = document.getElementById('push-target-filiado-search');

        if (titleInput) {
            titleInput.oninput = () => {
                document.getElementById('push-title-count').textContent = titleInput.value.length;
            };
        }

        if (messageInput) {
            messageInput.oninput = () => {
                document.getElementById('push-message-count').textContent = messageInput.value.length;
            };
        }

        if (btnSend) {
            btnSend.onclick = handleSend;
        }

        if (targetTypeSelect) {
            targetTypeSelect.onchange = handleTargetTypeChange;
        }

        if (filiadoSearchInput) {
            let debounceTimer;
            filiadoSearchInput.oninput = () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => handleFiliadoSearch(filiadoSearchInput.value), 400);
            };
        }
    }

    function handleTargetTypeChange() {
        const type = document.getElementById('push-target-type').value;
        const container = document.getElementById('push-target-value-container');
        const lotacaoSelect = document.getElementById('push-target-lotacao');
        const filiadoWrapper = document.getElementById('push-target-filiado-wrapper');
        const label = document.getElementById('push-target-value-label');

        container.style.display = 'none';
        lotacaoSelect.style.display = 'none';
        filiadoWrapper.style.display = 'none';

        if (type === 'LOTACAO') {
            container.style.display = 'block';
            label.textContent = 'Selecionar Lotação:';
            lotacaoSelect.style.display = 'block';
        } else if (type === 'FILIADO') {
            container.style.display = 'block';
            label.textContent = 'Buscar Filiado:';
            filiadoWrapper.style.display = 'block';
        }
    }

    async function handleFiliadoSearch(query) {
        if (!query || query.length < 2) return;
        const select = document.getElementById('push-target-filiado-select');
        select.innerHTML = '<option>Buscando...</option>';

        try {
            const r = await window.Api.apiFetch(`/api/filiados?q=${encodeURIComponent(query)}`);
            if (r.ok) {
                const data = await r.json();
                const filiados = data.filiados || [];
                if (filiados.length === 0) {
                    select.innerHTML = '<option value="">Nenhum encontrado</option>';
                } else {
                    select.innerHTML = filiados.map(f => `<option value="${f.id}" data-nome="${f.nome}" data-cpf="${f.cpf}">${f.nome} (CPF: ${f.cpf})</option>`).join('');
                }
            }
        } catch (e) {
            console.error("Erro na busca de filiados", e);
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
        if (targetType === 'LOTACAO') {
            targetValue = document.getElementById('push-target-lotacao').value;
        } else if (targetType === 'FILIADO') {
            const select = document.getElementById('push-target-filiado-select');
            const opt = select.options[select.selectedIndex];
            if (!opt || !opt.value) {
                alert("Selecione um filiado válido.");
                return;
            }
            targetValue = {
                id: opt.value,
                nome: opt.dataset.nome,
                cpf: opt.dataset.cpf
            };
        }

        let targetLabel = targetType;
        if (targetType === 'FILIADO' && targetValue && typeof targetValue === 'object') {
            targetLabel = `Filiado — ${targetValue.nome} (${window.Formatters?.formatCpf(targetValue.cpf) || targetValue.cpf})`;
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
                targetValue
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
                document.getElementById('push-title-count').textContent = '0';
                document.getElementById('push-message-count').textContent = '0';
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
            if (c.target_type === 'FILIADO' && c.target_value) {
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
        if (btnShow) btnShow.onclick = () => { isShowingArchived = true; carregarHistorico(); };

        const btnHide = document.getElementById('btn-hide-archived');
        if (btnHide) btnHide.onclick = () => { isShowingArchived = false; carregarHistorico(); };
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
