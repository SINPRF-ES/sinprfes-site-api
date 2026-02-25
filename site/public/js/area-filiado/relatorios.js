/**
 * Módulo de Relatórios (Página Inicial)
 */
(function (global) {
    if (global.Relatorios) return;

    let historyCache = [];
    let showFullHistory = false;

    function inicializarRelatorios(perfil) {
        setupHandlers();
        carregarHistorico();
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
            <div style="background: var(--azul-fundo); color: #fff; padding: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h2 style="margin:0; color:var(--amarelo); font-size: 1.4rem;">👁️ Visualização do Relatório</h2>
                    <div style="font-size:0.8rem; margin-top:8px; opacity:0.8;">
                        <div>Consulta gerada em: ${new Date(data.generatedAt).toLocaleString('pt-BR')}</div>
                        ${data.baseCompetencia ? `<div>Base do efetivo: ${data.baseCompetencia}</div>` : ''}
                    </div>
                </div>
                <button onclick="document.getElementById('relatorio-preview-container').style.display='none'" style="background:none; border:1px solid rgba(255,255,255,0.3); color:#fff; border-radius: 4px; padding: 4px 10px; cursor:pointer;">Fechar</button>
            </div>
            <div style="padding: 25px; background: #fff; color: #333;">
                ${data.sections.map(section => {
                    if (section.kind === 'kv') {
                        return `
                            <div style="margin-bottom:30px;">
                                <h4 style="border-bottom:2px solid var(--amarelo); padding-bottom:5px; color:var(--azul-fundo); margin-bottom: 15px;">${safeEscape(section.title)}</h4>
                                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:20px;">
                                    ${section.items.map(item => `
                                        <div>
                                            <span style="display:block; font-size:0.75rem; color:#777; text-transform: uppercase; font-weight: bold;">${safeEscape(item.label)}</span>
                                            <span style="font-size: 1rem; color: #333;">${safeEscape(item.value)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    } else if (section.kind === 'table') {
                        return `
                            <div style="margin-bottom:30px;">
                                <h4 style="border-bottom:2px solid var(--amarelo); padding-bottom:5px; color:var(--azul-fundo); margin-bottom: 15px;">${safeEscape(section.title)}</h4>
                                <div class="ui-table-wrapper">
                                    <table class="repasse-tabela ui-table" style="width:100%; border-collapse:collapse; font-size:0.9rem; border: 1px solid #ddd;">
                                        <thead>
                                            <tr style="background:#f8f9fa;">
                                                ${section.columns.map(col => `<th style="border:1px solid #ddd; padding:12px 10px; text-align:left; color: var(--azul-fundo);">${safeEscape(col)}</th>`).join('')}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${section.rows.map(row => `
                                                <tr>
                                                    ${row.map(cell => `<td style="border:1px solid #ddd; padding:12px 10px;">${safeEscape(cell)}</td>`).join('')}
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

                <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                    <button class="btn btn-outline" style="color: var(--azul-fundo); border-color: var(--azul-fundo);" onclick="document.getElementById('relatorio-preview-container').style.display='none'">
                        Ocultar Visualização
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;

        if (!document.getElementById('style-preview-relatorios')) {
            const s = document.createElement('style');
            s.id = 'style-preview-relatorios';
            s.textContent = `
                .repasse-tabela tbody tr:nth-child(even) { background: #fafafa; }
                .repasse-tabela tbody tr:hover { background: #f1f3f5; }
            `;
            document.head.appendChild(s);
        }
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
