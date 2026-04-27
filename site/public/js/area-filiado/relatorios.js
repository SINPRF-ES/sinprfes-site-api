/**
 * Módulo de Relatórios (Página Inicial)
 */
(function (global) {
    if (global.Relatorios) return;

    let historyCache = [];
    let showFullHistory = false;
    let perfilLogado = "FILIADO";
    const LOTACOES_RELATORIO = ["SEDE", "DEL 01 - Viana", "DEL 02 - Serra", "DEL 03 - Guarapari", "DEL 04 - Linhares"];

    function inicializarRelatorios(perfil) {
        perfilLogado = (perfil || "FILIADO").toUpperCase();
        setupHandlers();
        configurarEfetivoManual();
        carregarHistorico();
    }

    function ehPerfilGestao() {
        return ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilLogado);
    }

    function setupHandlers() {
        const btnGerar = document.getElementById('btn-gerar-relatorio');
        const btnPreview = document.getElementById('btn-preview-relatorio');
        const tipoSelect = document.getElementById('relatorio-tipo');
        const filiadoSearchInput = document.getElementById('relatorio-filiado-search');

        if (btnGerar) {
            btnGerar.onclick = handleGerar;
        }

        if (btnPreview) {
            btnPreview.onclick = handlePreview;
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


    function configurarEfetivoManual() {
        const card = document.getElementById('relatorio-efetivo-manual-card');
        const grid = document.getElementById('relatorio-efetivo-manual-grid');
        const btnSalvar = document.getElementById('btn-relatorio-efetivo-salvar');
        const btnRecarregar = document.getElementById('btn-relatorio-efetivo-recarregar');

        if (!card || !grid || !btnSalvar || !btnRecarregar) return;
        if (!ehPerfilGestao()) {
            card.style.display = 'none';
            return;
        }

        card.style.display = 'block';
        grid.innerHTML = LOTACOES_RELATORIO.map((lot) => `
            <div class="field-group">
                <label for="efetivo-manual-${lot.replace(/[^a-z0-9]/gi, "-").toLowerCase()}">${lot}</label>
                <input id="efetivo-manual-${lot.replace(/[^a-z0-9]/gi, "-").toLowerCase()}" data-lotacao="${lot}" type="number" min="0" step="1" placeholder="Ex: 100" style="padding:10px;border-radius:8px;" />
            </div>
        `).join('');

        btnSalvar.onclick = salvarEfetivoManual;
        btnRecarregar.onclick = carregarEfetivoManual;
        carregarEfetivoManual();
    }

    async function carregarEfetivoManual() {
        try {
            const r = await window.Api.apiFetch('/api/reports/efetivo-manual');
            if (!r.ok) return;
            const data = await r.json();
            const totais = data.totais || {};
            LOTACOES_RELATORIO.forEach((lot) => {
                const input = document.querySelector(`[data-lotacao="${lot}"]`);
                if (input) input.value = Number.isFinite(Number(totais[lot])) ? String(Number(totais[lot])) : '0';
            });
        } catch (e) {
            console.error('Relatorios.EfetivoManualLoadErro', e);
        }
    }

    async function salvarEfetivoManual() {
        const totais = {};
        for (const lot of LOTACOES_RELATORIO) {
            const input = document.querySelector(`[data-lotacao="${lot}"]`);
            const valor = Number(input?.value || 0);
            if (!Number.isFinite(valor) || valor < 0) {
                alert(`Valor inválido para ${lot}.`);
                return;
            }
            totais[lot] = Math.trunc(valor);
        }

        try {
            const r = await window.Api.apiFetch('/api/reports/efetivo-manual', {
                method: 'PUT',
                body: { totais }
            });
            const data = await r.json();
            if (!r.ok) {
                alert(data.message || data.error || 'Erro ao salvar efetivo manual.');
                return;
            }
            alert('Efetivo manual salvo com sucesso.');
        } catch (e) {
            console.error('Relatorios.EfetivoManualSaveErro', e);
            alert('Erro ao salvar efetivo manual.');
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

        const safeEscape = (v) => (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : "";

        try {
            const filiados = await window.Utils.searchFiliados(query);
            if (filiados.length === 0) {
                select.innerHTML = '<option value="">Nenhum encontrado</option>';
            } else {
                select.innerHTML = filiados.map(f => `<option value="${f.id}">${safeEscape(f.nome)} (CPF: ${safeEscape(f.cpf)})</option>`).join('');
            }
        } catch (e) {
            console.error("Erro na busca de filiados", e);
            select.innerHTML = '<option value="">Erro na busca</option>';
        }
    }

    function getFormValues() {
        const tipo = document.getElementById('relatorio-tipo').value;
        let params = {};

        if (tipo === 'INDIVIDUAL') {
            const select = document.getElementById('relatorio-filiado-select');
            if (!select.value) {
                alert("Selecione um filiado.");
                return null;
            }
            params.filiadoId = select.value;
        } else if (tipo === 'LOTACAO') {
            params.value = document.getElementById('relatorio-lotacao-select').value;
        } else if (tipo === 'SITUACAO') {
            params.value = document.getElementById('relatorio-situacao-select').value;
        } else if (tipo === 'GLOBAL') {
            // Sem filtro
        }
        return { tipo, params };
    }

    async function handleGerar() {
        const formData = getFormValues();
        if (!formData) return;

        const { tipo, params } = formData;
        const btnGerar = document.getElementById('btn-gerar-relatorio');
        if (!btnGerar) return;
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
            } else if (r.status === 403) {
                alert("Sem permissão para gerar relatórios.");
            } else {
                alert(data.message || data.error || "Erro ao gerar relatório.");
            }
        } catch (e) {
            if (e.message === "Sessão expirada") return;
            console.error("Relatorios.GerarErro", e);
            alert("Erro ao processar solicitação. Verifique sua conexão.");
        } finally {
            btnGerar.disabled = false;
            btnGerar.innerHTML = originalText;
        }
    }

    async function handlePreview() {
        const formData = getFormValues();
        if (!formData) return;

        const { tipo, params } = formData;
        const btnPreview = document.getElementById('btn-preview-relatorio');
        if (!btnPreview) return;
        const originalText = btnPreview.innerHTML;

        try {
            btnPreview.disabled = true;
            btnPreview.innerHTML = "⌛ Carregando Preview...";

            const r = await window.Api.apiFetch('/api/reports/preview', {
                method: 'POST',
                body: { type: tipo, params }
            });

            const data = await r.json();

            if (r.ok) {
                renderizarPreview(data);
            } else if (r.status === 403) {
                alert("Sem permissão para visualizar relatórios.");
            } else {
                alert(data.message || data.error || "Erro ao gerar preview.");
            }
        } catch (e) {
            if (e.message === "Sessão expirada") return;
            console.error("Relatorios.PreviewErro", e);
            alert("Erro ao carregar visualização.");
        } finally {
            btnPreview.disabled = false;
            btnPreview.innerHTML = originalText;
        }
    }

    function renderizarPreview(data) {
        const container = document.getElementById('relatorio-preview-container');
        if (!container) return;

        const safeEscape = (v) => (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : "";

        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });

        let html = `
            <div class="relatorio-preview-header">
                <div>
                    <h2 class="relatorio-preview-title">👁️ Visualização do Relatório</h2>
                    <div class="relatorio-preview-meta">
                        <div>Consulta gerada em: ${new Date(data.generatedAt).toLocaleString('pt-BR')}</div>
                        ${data.baseCompetencia ? `<div>Base do efetivo: ${data.baseCompetencia}</div>` : ''}
                    </div>
                </div>
                <button class="relatorio-preview-close-top" onclick="document.getElementById('relatorio-preview-container').style.display='none'">Fechar</button>
            </div>
            <div class="relatorio-preview-body">
                ${data.sections.map(section => {
                    if (section.kind === 'kv') {
                        return `
                            <div class="relatorio-preview-section">
                                <h4 class="relatorio-preview-section-title">${safeEscape(section.title)}</h4>
                                <div class="relatorio-preview-kv-grid">
                                    ${section.items.map(item => `
                                        <div class="relatorio-preview-kv-item">
                                            <span class="relatorio-preview-kv-label">${safeEscape(item.label)}</span>
                                            <span class="relatorio-preview-kv-value">${safeEscape(item.value)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    } else if (section.kind === 'table') {
                        return `
                            <div class="relatorio-preview-section">
                                <h4 class="relatorio-preview-section-title">${safeEscape(section.title)}</h4>
                                <div class="ui-table-wrapper">
                                    <table class="repasse-tabela ui-table relatorio-preview-table">
                                        <thead>
                                            <tr>
                                                ${section.columns.map(col => `<th>${safeEscape(col)}</th>`).join('')}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${section.rows.map(row => `
                                                <tr>
                                                    ${row.map(cell => `<td>${safeEscape(cell)}</td>`).join('')}
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `;
                    }
                    return '';
                }).join('')}

                <div class="relatorio-preview-actions">
                    <button class="btn btn-outline relatorio-preview-close-bottom" onclick="document.getElementById('relatorio-preview-container').style.display='none'">
                        Ocultar Visualização
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;

        let s = document.getElementById('style-preview-relatorios');
        if (!s) {
            s = document.createElement('style');
            s.id = 'style-preview-relatorios';
            document.head.appendChild(s);
        }
        s.textContent = `
                #relatorio-preview-container {
                    border: 1px solid #94a3b8 !important;
                    background: #f8fafc !important;
                    color: #0f172a !important;
                }
                .relatorio-preview-header {
                    background: #0b3a67 !important;
                    color: #f8fafc !important;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                }
                .relatorio-preview-title {
                    margin: 0;
                    color: #ffde59 !important;
                    font-size: 1.4rem;
                    font-weight: 800;
                }
                .relatorio-preview-meta {
                    font-size: 0.82rem;
                    margin-top: 8px;
                    opacity: 0.95;
                    color: #e2e8f0 !important;
                }
                .relatorio-preview-close-top {
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    color: #0b3a67;
                    border-radius: 6px;
                    padding: 6px 10px;
                    cursor: pointer;
                    font-weight: 600;
                }
                .relatorio-preview-body {
                    padding: 25px;
                    background: #f8fafc !important;
                    color: #0f172a !important;
                }
                .relatorio-preview-section {
                    margin-bottom: 30px;
                }
                .relatorio-preview-section-title {
                    border-bottom: 2px solid #ffd84d;
                    padding-bottom: 5px;
                    color: #0b3a67 !important;
                    margin-bottom: 15px;
                }
                .relatorio-preview-kv-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                    gap: 14px;
                }
                .relatorio-preview-kv-item {
                    padding: 12px;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    background: #ffffff !important;
                }
                .relatorio-preview-kv-label {
                    display: block;
                    font-size: 0.75rem;
                    color: #334155;
                    text-transform: uppercase;
                    font-weight: 700;
                }
                .relatorio-preview-kv-value {
                    font-size: 1rem;
                    color: #0f172a;
                    font-weight: 600;
                    margin-top: 4px;
                    display: inline-block;
                }
                .relatorio-preview-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.92rem;
                    border: 1px solid #d0d5dd;
                }
                .relatorio-preview-table thead tr {
                    background: #dbeafe !important;
                }
                .relatorio-preview-table th {
                    border: 1px solid #d0d5dd;
                    padding: 12px 10px;
                    text-align: left;
                    color: #0b3a67;
                    font-weight: 700;
                }
                .relatorio-preview-table td {
                    border: 1px solid #d0d5dd;
                    padding: 12px 10px;
                    color: #0f172a;
                }
                .relatorio-preview-actions {
                    text-align: center;
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                }
                .relatorio-preview-close-bottom {
                    color: #0b3a67 !important;
                    border-color: #0b3a67 !important;
                    font-weight: 600;
                }
                .repasse-tabela tbody tr:nth-child(even) { background: #fafafa; }
                .repasse-tabela tbody tr:hover { background: #f1f3f5; }
            `;
    }

    async function carregarHistorico() {
        const listEl = document.getElementById('relatorio-historico-list');
        if (!listEl) return;

        try {
            const r = await window.Api.apiFetch('/api/reports/history');
            if (r && r.ok) {
                const data = await r.json();
                historyCache = data || [];
                renderizarHistorico(listEl);
            } else if (r && r.status === 403) {
                listEl.innerHTML = `<p style="color:#666;">Histórico indisponível (Sem permissão).</p>`;
            } else if (r) {
                listEl.innerHTML = `<p style="color:red;">Erro ao carregar histórico (${r.status}).</p>`;
            }
        } catch (e) {
            if (e.message === "Sessão expirada") return;
            console.error("Relatorios.HistoryErro", e);
            listEl.innerHTML = `<p style="color:red;">Erro de conexão ao carregar histórico.</p>`;
        }
    }

    function renderizarHistorico(container) {
        if (!historyCache.length) {
            container.innerHTML = `<p>Nenhuma solicitação realizada ainda.</p>`;
            return;
        }

        const safeEscape = (v) => (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : "";

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
                    const valor = params.filiadoNome || params.paramDisplay || params.value || params.filiadoId || "-";

                    return `
                        <div class="history-card">
                            <div class="history-header">
                                <strong style="color:var(--azul-card);">${safeEscape(tipoLabels[h.report_type] || h.report_type)}</strong>
                                <span class="history-date">${data}</span>
                            </div>
                            <div style="font-size:0.85rem; color:#555; margin-top:8px;">
                                ${safeEscape(labelParam)}: <span style="color:var(--azul-fundo); font-weight:600;">${safeEscape(valor)}</span>
                            </div>
                            <div style="font-size:0.85rem; color:#777; margin-top:4px;">
                                Solicitante: ${safeEscape(h.requester_name)}
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
