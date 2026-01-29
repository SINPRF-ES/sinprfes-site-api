/**
 * Módulo Notificações (Área do Filiado)
 * Carregado como script clássico (window.Notificacoes)
 */

(function (global) {
    if (global.Notificacoes) return;

    let perfilAtual = null;
    let handlersConfigurados = false;

    function inicializarNotificacoes(perfil) {
        perfilAtual = (perfil || "").toUpperCase();
        const ehGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);

        const navItem = document.getElementById("nav-notificacoes");
        if (navItem && ehGestao) {
            navItem.style.display = "block";
        }

        if (!handlersConfigurados && ehGestao) {
            configurarForm();
            handlersConfigurados = true;
        }

        if (ehGestao) {
            carregarHistorico();
        }
    }

    function configurarForm() {
        const form = document.getElementById("form-enviar-push");
        const bodyInput = document.getElementById("push-body");
        const charNow = document.getElementById("push-char-now");
        const titleInput = document.getElementById("push-title");
        const titleCharNow = document.getElementById("push-title-char-now");

        if (bodyInput && charNow) {
            bodyInput.addEventListener("input", () => {
                charNow.textContent = bodyInput.value.length;
            });
        }

        if (titleInput && titleCharNow) {
            titleInput.addEventListener("input", () => {
                titleCharNow.textContent = titleInput.value.length;
            });
        }

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();

                const title = document.getElementById("push-title").value.trim();
                const body = document.getElementById("push-body").value.trim();
                const targetType = document.getElementById("push-target").value;

                if (!body) return alert("A mensagem é obrigatória.");

                const confirmacao = confirm(`Você tem certeza que deseja enviar esta notificação para TODOS os filiados registrados?\n\n"${body}"`);
                if (!confirmacao) return;

                const btn = document.getElementById("btn-enviar-push");
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.textContent = "Enviando...";

                try {
                    const r = await window.Api.apiFetch("/api/push/campaigns/send", {
                        method: "POST",
                        body: { title, body, targetType }
                    });

                    if (r.ok) {
                        const res = await r.json();
                        alert(`Notificação enviada com sucesso!\nEnviados: ${res.sent}\nFalhas: ${res.failed}`);
                        form.reset();
                        charNow.textContent = "0";
                        if (titleCharNow) titleCharNow.textContent = "0";
                        await carregarHistorico();
                    } else {
                        const err = await r.json();
                        alert(err.error || "Erro ao enviar notificação.");
                    }
                } catch (err) {
                    console.error(err);
                    alert("Erro de conexão com o servidor.");
                } finally {
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            };
        }
    }

    async function carregarHistorico() {
        const container = document.getElementById("push-historico-lista");
        if (!container) return;

        try {
            const r = await window.Api.apiFetch("/api/push/campaigns");
            if (r.ok) {
                const data = await r.json();
                renderizarHistorico(data.campaigns);
            } else {
                container.innerHTML = `<p style="color:red;">Erro ao carregar histórico.</p>`;
            }
        } catch (err) {
            container.innerHTML = `<p style="color:red;">Erro de conexão.</p>`;
        }
    }

    function renderizarHistorico(campaigns) {
        const container = document.getElementById("push-historico-lista");
        if (!campaigns || campaigns.length === 0) {
            container.innerHTML = `<p>Nenhum envio realizado ainda.</p>`;
            return;
        }

        container.innerHTML = `
            <table class="af-table">
                <thead>
                    <tr>
                        <th>Data/Hora</th>
                        <th>Autor</th>
                        <th>Mensagem</th>
                        <th>Resultado</th>
                    </tr>
                </thead>
                <tbody>
                    ${campaigns.map(c => {
                        const data = new Date(c.created_at).toLocaleString('pt-BR');
                        const result = c.result || {};
                        const statusColor = c.status === 'SENT' ? '#2ecc71' : '#e74c3c';

                        return `
                            <tr>
                                <td style="white-space:nowrap; font-size:0.85rem;">${data}</td>
                                <td style="font-size:0.85rem;">${c.autor_nome || 'Sistema'}</td>
                                <td style="max-width:300px; font-size:0.85rem;">
                                    <strong>${c.title || ''}</strong><br>
                                    ${c.body}
                                </td>
                                <td style="font-size:0.85rem;">
                                    <span style="color:${statusColor}; font-weight:bold;">${c.status}</span><br>
                                    🚀 ${result.sent || 0} | ❌ ${result.failed || 0}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    global.Notificacoes = {
        inicializarNotificacoes,
        carregarHistorico
    };

})(typeof window !== 'undefined' ? window : global);
