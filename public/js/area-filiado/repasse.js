/**
 * Módulo Repasse (Página Inicial)
 * Carregado como script clássico (window.Repasse)
 */

(function (global) {
    if (global.Repasse) return;

    const MIN_YEAR = 2026;
    let yearCurrent = Math.max(new Date().getFullYear(), MIN_YEAR);
    let responsaveisCache = [];
    let repasseData = null;
    let perfilLogado = null;

    const LOTACOES_REPASSE = global.Canon?.LOTACOES_REPASSE || [];

    async function inicializarRepasse(perfil) {
        perfilLogado = (perfil || "").toUpperCase();
        const container = document.getElementById("sec-repasse");
        if (!container) return;

        container.innerHTML = `
            <div class="af-standard-header">
                <h2>💱 Repasse por Localidade</h2>
                <p class="section-subtitle">Gestão de créditos e reembolsos mensais para as delegacias.</p>
            </div>

            <div class="af-standard-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px;">
                    <div style="background: #f8f9fa; border-left: 5px solid var(--amarelo); padding: 15px; border-radius: 8px; flex: 1; min-width: 250px;">
                        <span style="font-size: 0.9rem; color: #666; display: block; margin-bottom: 5px;">Total Acumulado Geral (${yearCurrent})</span>
                        <span id="total-acumulado-geral" style="font-size: 1.5rem; font-weight: bold; color: var(--azul-fundo);">R$ 0,00</span>
                    </div>

                    <div class="af-standard-form" style="display:flex; align-items:center; gap:12px;">
                        <label style="margin-bottom: 0 !important; white-space: nowrap;">Selecionar Ano:</label>
                        <select id="repasse-year-select" style="width: 120px !important;">
                            ${(() => {
                                const endYear = Math.max(yearCurrent, new Date().getFullYear()) + 5;
                                let options = '';
                                for (let y = MIN_YEAR; y <= endYear; y++) {
                                    options += `<option value="${y}" ${y === yearCurrent ? "selected" : ""}>${y}</option>`;
                                }
                                return options;
                            })()}
                        </select>
                    </div>
                </div>

                <div id="repasse-meses-container">
                    <p style="text-align:center; padding:40px; color:#666;">Carregando dados...</p>
                </div>
            </div>
        `;

        const selectYear = document.getElementById("repasse-year-select");
        if (selectYear) {
            selectYear.onchange = (e) => {
                yearCurrent = parseInt(e.target.value);
                carregarDados();
            };
        }

        await carregarResponsaveis();
        await carregarDados();
    }

    async function carregarResponsaveis() {
        try {
            const r = await window.Api.apiFetch("/api/repasse/responsaveis");
            if (r.ok) {
                const d = await r.json();
                responsaveisCache = d.responsaveis || [];
            }
        } catch (e) { console.error("Erro responsaveis", e); }
    }

    async function carregarDados() {
        const container = document.getElementById("repasse-meses-container");
        if (!container) return;

        try {
            const r = await window.Api.apiFetch(`/api/repasse?year=${yearCurrent}`);
            if (r.ok) {
                repasseData = await r.json();
                renderizarMeses();
            } else {
              container.innerHTML = `<p style="color:#c0392b; text-align:center;">Erro ao carregar dados. Verifique suas permissões.</p>`;
            }
        } catch (e) {
            container.innerHTML = `<p style="color:#c0392b; text-align:center;">Erro de conexão.</p>`;
        }
    }

    function renderizarMeses() {
        const container = document.getElementById("repasse-meses-container");
        const totalGeralEl = document.getElementById("total-acumulado-geral");

        if (!container || !repasseData) return;

        totalGeralEl.textContent = formatCurrency(repasseData.totalAcumuladoGeral || 0);

        const nomesMeses = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];

        const mesesAbertos = Array.from(document.querySelectorAll(".month-content"))
            .map((el, idx) => el.style.display === "block" ? idx + 1 : null)
            .filter(Boolean);

        container.innerHTML = repasseData.meses.map(m => {
            const totalMes = m.totalRepasseMes || 0;
            const isAberto = mesesAbertos.includes(m.month) || (m.month === new Date().getMonth() + 1 && mesesAbertos.length === 0);

            return `
                <div style="margin-bottom: 15px; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                    <div style="background: #f1f3f5; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="const c = this.nextElementSibling; c.style.display = c.style.display === 'none' ? 'block' : 'none'">
                        <h3 style="margin: 0; font-size: 1.1rem; color: var(--azul-fundo);">${nomesMeses[m.month - 1]}</h3>
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <span style="font-size:0.85rem; color:#666;">Per Capita: ${formatCurrency(m.perCapita)}</span>
                            <span style="font-weight: bold; color: #27ae60;">${formatCurrency(totalMes)}</span>
                            <span style="color:var(--azul-fundo);">⌄</span>
                        </div>
                    </div>
                    <div id="content-month-${m.month}" style="display:${isAberto ? 'block' : 'none'}; padding: 25px; border-top: 1px solid #eee; background: #fff;">
                        <div class="af-standard-form" style="display: flex; gap: 20px; margin-bottom: 25px; align-items: flex-end; flex-wrap: wrap;">
                            <div style="flex: 1; max-width: 220px;">
                                <label>Per Capita do Mês</label>
                                <input type="number" step="0.01" value="${m.perCapita}" onchange="Repasse.atualizarPerCapita(${m.month}, this.value)">
                            </div>
                            <div style="flex: 1; text-align: right; min-width: 200px;">
                                <button class="btn btn-primary" onclick="Repasse.salvarMes(${m.month})" style="padding: 10px 25px;">💾 Salvar ${nomesMeses[m.month-1]}</button>
                            </div>
                        </div>

                        <div style="overflow-x:auto;">
                            <table class="af-standard-table">
                                <thead>
                                    <tr>
                                        <th>Localidade</th>
                                        <th>Responsável</th>
                                        <th style="text-align:center;">Ativos</th>
                                        <th style="text-align:center;">PRF Total</th>
                                        <th style="text-align:center;">%</th>
                                        <th style="text-align:right;">Crédito</th>
                                        <th style="text-align:right;">Reembolso</th>
                                        <th style="text-align:right;">Acumulado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${m.localidades.map(loc => renderRowLocalidade(m.month, loc)).join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    const LOTACAO_KEYWORDS = {
        "SEDE": "SEDE",
        "DEL 01 - Viana": "VIANA",
        "DEL 02 - Serra": "SERRA",
        "DEL 03 - Guarapari": "GUARAPARI",
        "DEL 04 - Linhares": "LINHARES"
    };

    function normalizeText(str) {
        return (str || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    function renderRowLocalidade(month, loc) {
        const percent = loc.percentual;
        const percentDisplay = percent === null ? "—" : percent.toFixed(0) + "%";
        const hasWarning = (loc.prfTotal <= 0);

        let colorPercent = "#666";
        if (percent !== null) {
            if (percent < 70) colorPercent = "#e74c3c";
            else if (percent < 80) colorPercent = "#f39c12";
            else colorPercent = "#27ae60";
        }

        // Paridade com o app: filtrar responsáveis por lotação
        const kw = LOTACAO_KEYWORDS[loc.lotacao];
        const filteredResps = responsaveisCache.filter(r => {
            if (!kw) return true;
            if (!r.lotacao) return false;
            return normalizeText(r.lotacao).includes(kw);
        });

        return `
            <tr>
                <td style="font-weight:bold; color:var(--azul-fundo);">${loc.lotacao}</td>
                <td class="af-standard-form">
                    <select onchange="Repasse.atualizarLocalidade(${month}, '${loc.lotacao}', { responsavelId: this.value })" style="padding: 5px !important; font-size: 0.85rem !important;">
                        <option value="">Selecione...</option>
                        ${filteredResps.map(r => `<option value="${r.id}" ${r.id == loc.responsavelId ? "selected" : ""}>${r.nome}</option>`).join("")}
                    </select>
                </td>
                <td style="text-align:center;">${loc.filiadosAtivos}</td>
                <td style="text-align:center;" class="af-standard-form">
                    <input type="number" value="${loc.prfTotal}" onchange="Repasse.atualizarLocalidade(${month}, '${loc.lotacao}', { prfTotal: this.value })" style="width:70px; text-align:center; padding: 5px !important; font-size: 0.85rem !important;">
                </td>
                <td style="text-align:center; color:${colorPercent}; font-weight:bold;">
                    ${hasWarning ? '<span title="PRF Total deve ser maior que zero">⚠️</span>' : percentDisplay}
                </td>
                <td style="text-align:right; font-weight:bold;">${formatCurrency(loc.creditoMes)}</td>
                <td style="text-align:right;" class="af-standard-form">
                    <input type="number" step="0.01" value="${loc.reembolsoMes}" onchange="Repasse.atualizarLocalidade(${month}, '${loc.lotacao}', { reembolsoMes: this.value })" style="width:100px; text-align:right; padding: 5px !important; font-size: 0.85rem !important;">
                </td>
                <td style="text-align:right; color:#e67e22; font-weight:bold;">${formatCurrency(loc.acumuladoAno)}</td>
            </tr>
        `;
    }

    function atualizarPerCapita(month, value) {
        const m = repasseData.meses.find(m => m.month === month);
        if (m) {
            m.perCapita = parseFloat(value) || 0;
            recalcular(month);
            renderizarMeses();
        }
    }

    function atualizarLocalidade(month, lotacao, data) {
        const m = repasseData.meses.find(m => m.month === month);
        if (m) {
            const canonLot = global.Canon?.normalizeLotacao(lotacao);
            const loc = m.localidades.find(l => l.lotacao === canonLot);
            if (loc) {
                if (data.responsavelId !== undefined) loc.responsavelId = data.responsavelId;
                if (data.prfTotal !== undefined) loc.prfTotal = parseInt(data.prfTotal) || 0;
                if (data.reembolsoMes !== undefined) loc.reembolsoMes = parseFloat(data.reembolsoMes) || 0;

                recalcular(month);
                renderizarMeses();
            }
        }
    }

    function recalcular(month) {
        const m = repasseData.meses.find(m => m.month === month);
        const perCapita = m.perCapita;

        m.localidades.forEach(loc => {
            if (loc.prfTotal > 0) {
                loc.percentual = (loc.filiadosAtivos / loc.prfTotal) * 100;
                const base = loc.filiadosAtivos * perCapita;

                let factor = 0;
                if (loc.percentual >= 90) factor = 1.0;
                else if (loc.percentual >= 80) factor = 0.7;
                else if (loc.percentual >= 70) factor = 0.4;

                loc.creditoMes = base * factor;
            } else {
                loc.percentual = null;
                loc.creditoMes = 0;
            }
        });

        m.totalRepasseMes = m.localidades.reduce((acc, l) => acc + l.creditoMes, 0);

        const acumulados = {};
        LOTACOES_REPASSE.forEach(lot => {
            let somaCred = 0;
            let somaReem = 0;
            repasseData.meses.forEach(mes => {
                const l = mes.localidades.find(ll => global.Canon?.normalizeLotacao(ll.lotacao) === lot);
                if (l) {
                    somaCred += l.creditoMes;
                    somaReem += l.reembolsoMes;
                }
            });
            acumulados[lot] = somaCred - somaReem;
        });

        repasseData.meses.forEach(mes => {
            mes.localidades.forEach(l => {
                l.acumuladoAno = acumulados[global.Canon?.normalizeLotacao(l.lotacao)];
            });
        });

        repasseData.totalAcumuladoGeral = Object.values(acumulados).reduce((acc, curr) => acc + curr, 0);
    }

    async function salvarMes(month) {
        const m = repasseData.meses.find(m => m.month === month);
        if (!m) return;

        const payload = {
            year: yearCurrent,
            month: month,
            perCapita: m.perCapita,
            localidades: m.localidades.map(l => ({
                lotacaoKey: l.lotacao,
                responsavelId: l.responsavelId || null,
                prfTotal: l.prfTotal,
                reembolsoMes: l.reembolsoMes
            }))
        };

        try {
            const r = await window.Api.apiFetch("/api/repasse", {
                method: "POST",
                body: payload
            });
            if (r.ok) {
                alert("Dados de " + getNomeMes(month) + " salvos com sucesso!");
                await carregarDados();
                document.getElementById("content-month-" + month).style.display = "block";
            } else {
                const err = await r.json();
                alert("Erro ao salvar: " + (err.message || "Tente novamente."));
            }
        } catch (e) {
            alert("Erro de conexão.");
        }
    }

    function getNomeMes(m) {
        return ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][m-1];
    }

    function formatCurrency(v) {
        return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    global.Repasse = {
        inicializarRepasse,
        atualizarPerCapita,
        atualizarLocalidade,
        salvarMes
    };

})(typeof window !== 'undefined' ? window : global);
