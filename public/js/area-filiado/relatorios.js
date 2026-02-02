/**
 * Módulo de Relatórios (Página Inicial)
 */
(function (global) {
    if (global.Relatorios) return;

    let historyCache = [];

    function inicializarRelatorios(perfil) {
        console.log("Relatorios: Inicializando para perfil:", perfil);

        setupHandlers();
        carregarHistorico();
    }

    function setupHandlers() {
        const btnGerar = document.getElementById('btn-gerar-relatorio');
        const tipoSelect = document.getElementById('relatorio-tipo');
        const filiadoSearchInput = document.getElementById('relatorio-filiado-search');

        if (btnGerar) {
            btnGerar.onclick = handleGerar;
        }

        if (tipoSelect) {
            tipoSelect.onchange = handleTipoChange;
        }

        if (filiadoSearchInput) {
            let debounceTimer;
            filiadoSearchInput.oninput = () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => handleFiliadoSearch(filiadoSearchInput.value), 400);
            };
        }
    }

    function handleTipoChange() {
        const tipo = document.getElementById('relatorio-tipo').value;
        const label = document.getElementById('relatorio-param-label');

        const filiadoWrapper = document.getElementById('relatorio-filiado-wrapper');
        const lotacaoSelect = document.getElementById('relatorio-lotacao-select');
        const situacaoSelect = document.getElementById('relatorio-situacao-select');

        // Esconde tudo
        filiadoWrapper.style.display = 'none';
        lotacaoSelect.style.display = 'none';
        situacaoSelect.style.display = 'none';

        if (tipo === 'INDIVIDUAL') {
            label.textContent = 'Filiado:';
            filiadoWrapper.style.display = 'block';
        } else if (tipo === 'LOTACAO') {
            label.textContent = 'Selecionar Lotação:';
            lotacaoSelect.style.display = 'block';
        } else if (tipo === 'SITUACAO') {
            label.textContent = 'Selecionar Situação Funcional:';
            situacaoSelect.style.display = 'block';
        }
    }

    async function handleFiliadoSearch(query) {
        if (!query || query.length < 2) return;
        const select = document.getElementById('relatorio-filiado-select');
        select.innerHTML = '<option>Buscando...</option>';

        try {
            const r = await window.Api.apiFetch(`/api/filiados?q=${encodeURIComponent(query)}`);
            if (r.ok) {
                const data = await r.json();
                const filiados = data.filiados || [];
                if (filiados.length === 0) {
                    select.innerHTML = '<option value="">Nenhum encontrado</option>';
                } else {
                    select.innerHTML = filiados.map(f => `<option value="${f.id}">${f.nome} (CPF: ${f.cpf})</option>`).join('');
                }
            }
        } catch (e) {
            console.error("Erro na busca de filiados", e);
            select.innerHTML = '<option value="">Erro na busca</option>';
        }
    }

    async function handleGerar() {
        const tipo = document.getElementById('relatorio-tipo').value;
        let params = {};

        if (tipo === 'INDIVIDUAL') {
            const select = document.getElementById('relatorio-filiado-select');
            if (!select.value) {
                alert("Selecione um filiado.");
                return;
            }
            params.filiadoId = select.value;
        } else if (tipo === 'LOTACAO') {
            params.value = document.getElementById('relatorio-lotacao-select').value;
        } else if (tipo === 'SITUACAO') {
            params.value = document.getElementById('relatorio-situacao-select').value;
        }

        const btnGerar = document.getElementById('btn-gerar-relatorio');
        const originalText = btnGerar.innerHTML;

        try {
            btnGerar.disabled = true;
            btnGerar.innerHTML = "⌛ Gerando e Enviando...";

            const r = await window.Api.apiFetch('/api/reports/generate', {
                method: 'POST',
                body: { type: tipo, params }
            });

            const data = await r.json();

            if (r.ok) {
                alert(data.message || "Relatório gerado com sucesso! Verifique seu e-mail.");
                carregarHistorico();
            } else {
                alert(data.message || "Erro ao gerar relatório.");
            }
        } catch (e) {
            console.error("Relatorios.GerarErro", e);
            alert("Erro de conexão ao gerar relatório.");
        } finally {
            btnGerar.disabled = false;
            btnGerar.innerHTML = originalText;
        }
    }

    async function carregarHistorico() {
        const listEl = document.getElementById('relatorio-historico-list');
        if (!listEl) return;

        try {
            const r = await window.Api.apiFetch('/api/reports/history');
            if (r.ok) {
                const data = await r.json();
                historyCache = data || [];
                renderizarHistorico(listEl);
            } else {
                listEl.innerHTML = `<p style="color:red;">Erro ao carregar histórico.</p>`;
            }
        } catch (e) {
            console.error("Relatorios.HistoryErro", e);
            listEl.innerHTML = `<p style="color:red;">Erro de conexão ao carregar histórico.</p>`;
        }
    }

    function renderizarHistorico(container) {
        if (!historyCache.length) {
            container.innerHTML = `<p>Nenhuma solicitação realizada ainda.</p>`;
            return;
        }

        const tipoLabels = {
            INDIVIDUAL: "Dossiê Individual",
            LOTACAO: "Por Lotação",
            SITUACAO: "Por Situação"
        };

        container.innerHTML = historyCache.map(h => {
            const data = new Date(h.created_at).toLocaleString('pt-BR');
            const params = typeof h.params === 'string' ? JSON.parse(h.params) : h.params;
            const valor = params.value || params.filiadoId || "-";

            return `
                <div class="history-item" style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom: 4px;">
                        <strong>${tipoLabels[h.report_type] || h.report_type}</strong>
                        <span style="color:var(--texto-fraco); font-size:0.8rem;">${data}</span>
                    </div>
                    <div style="font-size:0.85rem; color:var(--cinza);">
                        Parâmetro: <span style="color:var(--amarelo);">${valor}</span> | Solicitante: ${h.requester_name}
                    </div>
                </div>
            `;
        }).join('');
    }

    global.Relatorios = {
        inicializarRelatorios
    };

})(typeof window !== 'undefined' ? window : global);
