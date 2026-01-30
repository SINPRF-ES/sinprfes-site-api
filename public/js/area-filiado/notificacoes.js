/**
 * Módulo de Notificações Push (Área do Filiado) - Padronizado
 */
(function (global) {
    if (global.Notificacoes) return;

    let historyCache = [];

    function init(perfil) {
        console.log("Notificacoes: Inicializando para perfil:", perfil);
        setupHandlers();
        carregarHistorico();
    }

    function setupHandlers() {
        const btnSend = document.getElementById('btn-send-push');
        const titleInput = document.getElementById('push-title');
        const messageInput = document.getElementById('push-message');

        if (titleInput) {
            titleInput.oninput = () => {
                const countEl = document.getElementById('push-title-count');
                if (countEl) countEl.textContent = titleInput.value.length;
            };
        }

        if (messageInput) {
            messageInput.oninput = () => {
                const countEl = document.getElementById('push-message-count');
                if (countEl) countEl.textContent = messageInput.value.length;
            };
        }

        if (btnSend) {
            btnSend.onclick = handleSend;
        }
    }

    async function handleSend() {
        const titleEl = document.getElementById('push-title');
        const messageEl = document.getElementById('push-message');

        // Garantir strings (evitar booleans acidentais do DOM ou extensões)
        const titleRaw = titleEl ? titleEl.value : '';
        const bodyRaw = messageEl ? messageEl.value : '';

        const title = String(titleRaw).trim();
        const body = String(bodyRaw).trim();

        if (!body) {
            alert("A mensagem é obrigatória.");
            return;
        }

        const confirmMsg = `Deseja realmente enviar esta notificação para TODOS os dispositivos registrados?\n\n"${body}"`;
        if (!confirm(confirmMsg)) return;

        const btnSend = document.getElementById('btn-send-push');
        const originalText = btnSend.innerHTML;

        try {
            btnSend.disabled = true;
            btnSend.innerHTML = "⌛ Enviando...";

            const payload = {
                title: title || null,
                body: body,
                targetType: 'ALL'
            };
            console.log("Notificacoes: Enviando push", {
                titleType: typeof payload.title,
                bodyType: typeof payload.body,
                titleLength: payload.title ? payload.title.length : 0,
                bodyLength: payload.body.length
            });

            const r = await window.Api.apiFetch('/api/push/campaigns/send', {
                method: 'POST',
                body: payload
            });

            const data = await r.json();

            if (r.ok) {
                alert(`Sucesso! Notificação enviada.\n🚀 Sucesso: ${data.sent}\n❌ Falhas: ${data.failed}`);
                if (titleEl) titleEl.value = '';
                if (messageEl) messageEl.value = '';

                const tc = document.getElementById('push-title-count');
                const mc = document.getElementById('push-message-count');
                if (tc) tc.textContent = '0';
                if (mc) mc.textContent = '0';

                carregarHistorico();
            } else {
                if (r.status === 429) {
                    alert("Limite atingido. Você só pode enviar 2 notificações por minuto.");
                } else {
                    alert(data.error || "Erro ao enviar notificação.");
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
            const r = await window.Api.apiFetch('/api/push/campaigns');
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

        container.innerHTML = historyCache.map(c => {
            const data = formatarData(c.created_at);
            const statusClass = c.status === 'SENT' ? 'status-sent' : 'status-failed';
            const statusLabel = c.status === 'SENT' ? 'Enviado' : 'Falhou';

            return `
                <div class="history-card">
                    <div class="history-header">
                        <span class="history-date">${data}</span>
                        <span class="history-status ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="history-author">Por: ${c.autor_nome || 'Sistema'}</div>
                    ${c.title ? `<div class="history-title">${c.title}</div>` : ''}
                    <div class="history-body">${c.body}</div>
                    <div class="history-results">
                        <span>🚀 ${c.result?.sent || 0}</span>
                        <span>❌ ${c.result?.failed || 0}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function formatarData(isoStr) {
        if (!isoStr) return "";
        const d = new Date(isoStr);
        return d.toLocaleString('pt-BR');
    }

    // Compatibilidade com código legado que pode chamar inicializarNotificacoes
    global.Notificacoes = {
        init,
        inicializarNotificacoes: init,
        carregarHistorico
    };

})(typeof window !== 'undefined' ? window : global);
