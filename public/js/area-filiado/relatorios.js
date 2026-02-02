/**
 * Módulo de Relatórios (Página Inicial)
 */
(function (global) {
    if (global.Relatorios) return;

    let historyCache = [];
    let showFullHistory = false;

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
        document.getElementById('relatorio-param-container').style.display = 'block';

        if (tipo === 'INDIVIDUAL') {
            label.textContent = 'Filiado:';
            filiadoWrapper.style.display = 'block';
        } else if (tipo === 'LOTACAO') {
            label.textContent = 'Selecionar Lotação:';
            lotacaoSelect.style.display = 'block';
        } else if (tipo === 'SITUACAO') {
            label.textContent = 'Selecionar Situação Funcional:';
            situacaoSelect.style.display = 'block';
        } else if (tipo === 'GLOBAL') {
            document.getElementById('relatorio-param-container').style.display = 'none';
        }
    }

    async function handleFiliadoSearch(query) {
        if (!query || query.length < 2) return;
        const select = document.getElementById('relatorio-filiado-select');
        select.innerHTML = '<option>Buscando...</option>';

        try {
            const filiados = await window.Utils.searchFiliados(query);
            if (filiados.length === 0) {
                select.innerHTML = '<option value="">Nenhum encontrado</option>';
            } else {
                select.innerHTML = filiados.map(f => `<option value="${f.id}">${f.nome} (CPF: ${f.cpf})</option>`).join('');
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
        } else if (tipo === 'GLOBAL') {
            // Sem filtro
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
            INDIVIDUAL: "👤 Dossiê Individual",
            LOTACAO: "📍 Por Lotação",
            SITUACAO: "📑 Por Situação",
            GLOBAL: "🌏 Global (Completo)"
        };

        const listToRender = showFullHistory ? historyCache : historyCache.slice(0, 5);

        let html = `
            <div class="history-list">
                ${listToRender.map(h => {
                    const data = new Date(h.created_at).toLocaleString('pt-BR');
                    const params = typeof h.params === 'string' ? JSON.parse(h.params) : h.params;

                    // Prioriza o nome resolvido (A1)
                    const labelParam = h.report_type === 'INDIVIDUAL' ? 'Filiado' : 'Parâmetro';
                    const valor = params.filiadoNome || params.value || params.filiadoId || "-";

                    return `
                        <div class="history-card">
                            <div class="history-header">
                                <strong style="color:var(--azul-card);">${tipoLabels[h.report_type] || h.report_type}</strong>
                                <span class="history-date">${data}</span>
                            </div>
                            <div style="font-size:0.85rem; color:#555; margin-top:8px;">
                                ${labelParam}: <span style="color:var(--azul-fundo); font-weight:600;">${valor}</span>
                            </div>
                            <div style="font-size:0.85rem; color:#777; margin-top:4px;">
                                Solicitante: ${h.requester_name}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        if (!showFullHistory && historyCache.length > 5) {
            html += `
                <div style="text-align: center; margin-top: 15px;">
                    <button id="btn-show-full-history" class="btn btn-outline btn-sm" style="color:var(--azul-fundo); border-color:var(--azul-fundo);">Exibir anteriores</button>
                </div>
            `;
        } else if (showFullHistory) {
            html += `
                <div style="text-align: center; margin-top: 15px;">
                    <button id="btn-hide-full-history" class="btn btn-outline btn-sm" style="color:var(--azul-fundo); border-color:var(--azul-fundo);">Ver apenas recentes</button>
                </div>
            `;
        }

        container.innerHTML = html;

        const btnShow = document.getElementById('btn-show-full-history');
        if (btnShow) btnShow.onclick = () => { showFullHistory = true; renderizarHistorico(container); };

        const btnHide = document.getElementById('btn-hide-full-history');
        if (btnHide) btnHide.onclick = () => { showFullHistory = false; renderizarHistorico(container); };
    }

    global.Relatorios = {
        inicializarRelatorios
    };

})(typeof window !== 'undefined' ? window : global);
