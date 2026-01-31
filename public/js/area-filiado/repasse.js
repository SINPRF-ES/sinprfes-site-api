/**
 * Módulo Repasse (Área do Filiado)
 * Carregado como script clássico (window.Repasse)
 */

(function (global) {
    if (global.Repasse) return;

    let yearCurrent = new Date().getFullYear();
    let responsaveisCache = [];
    let repasseData = null;
    let perfilLogado = null;

    const LOTACOES = global.Canon?.LOTACOES || [];

    async function inicializarRepasse(perfil) {
        perfilLogado = (perfil || "").toUpperCase();
        const container = document.getElementById("sec-repasse");
        if (!container) return;

        if (!document.getElementById('style-repasse')) {
            const s = document.createElement('style');
            s.id = 'style-repasse';
            s.textContent = `
                .repasse-card { background: #ffffff; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; margin: 0 auto 25px auto; max-width: 1100px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                .repasse-header-main { background: #003366; color: #ffffff; padding: 25px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
                .repasse-header-main h2 { margin: 0; color: #f1c40f; font-size: 1.8rem; }
                .repasse-body { padding: 25px; background: #ffffff; color: #333; }
                .repasse-stats-box { background: #f8f9fa; border-left: 5px solid #f1c40f; padding: 15px; border-radius: 4px; margin-bottom: 25px; }
                .repasse-stats-label { font-size: 0.9rem; color: #666; display: block; margin-bottom: 5px; }
                .repasse-stats-value { font-size: 1.5rem; font-weight: bold; color: #003366; }

                .month-container { margin-bottom: 15px; border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
                .month-tab { background: #f1f3f5; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.2s; }
                .month-tab:hover { background: #e9ecef; }
                .month-tab h3 { margin: 0; font-size: 1.1rem; color: #003366; }
                .month-tab-info { display: flex; align-items: center; gap: 20px; }
                .month-tab-total { font-weight: bold; color: #27ae60; }

                .month-content { padding: 20px; display: none; border-top: 1px solid #eee; background: #fff; }
                .month-config-row { display: flex; gap: 20px; margin-bottom: 20px; align-items: flex-end; }

                .repasse-tabela { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9rem; background: #fff; }
                .repasse-tabela th, .repasse-tabela td { border: 1px solid #ddd; padding: 12px 10px; text-align: left; }
                .repasse-tabela th { background: #f1f3f5; color: #003366; position: sticky; top: 0; font-weight: bold; font-size: 0.85rem; text-transform: uppercase; }
                .repasse-tabela tr:nth-child(even) { background: #f8f9fa; }
                .repasse-tabela input, .repasse-tabela select { width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }

                .btn-repasse-save { background: #003366; color: #ffffff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
                .btn-repasse-save:hover { background: #004488; }
            `;
            document.head.appendChild(s);
        }

        container.innerHTML = `
            <div class="repasse-card">
                <div class="repasse-header-main">
                    <div>
                        <h2>💱 Repasse por Localidade</h2>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">Gestão de créditos e reembolsos mensais</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <label style="font-weight:bold;">Ano:</label>
                        <select id="repasse-year-select" style="padding:8px; border-radius:6px; background:#fff; color:#333; border:none;">
                            ${[yearCurrent, yearCurrent - 1, yearCurrent - 2].map(y => `<option value="${y}" ${y === yearCurrent ? "selected" : ""}>${y}</option>`).join("")}
                        </select>
                    </div>
                </div>
                <div class="repasse-body">
                    <div class="repasse-stats-box">
                        <span class="repasse-stats-label">Total Acumulado Geral (${yearCurrent})</span>
                        <span id="total-acumulado-geral" class="repasse-stats-value">R$ 0,00</span>
                    </div>

                    <div id="repasse-meses-container">
                        <p style="text-align:center; padding:40px; color:#666;">Carregando dados...</p>
                    </div>
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
                <div class="month-container">
                    <div class="month-tab" onclick="const c = this.nextElementSibling; c.style.display = c.style.display === 'none' ? 'block' : 'none'">
                        <h3>${nomesMeses[m.month - 1]}</h3>
                        <div class="month-tab-info">
                            <span style="font-size:0.85rem; color:#666;">Per Capita: ${formatCurrency(m.perCapita)}</span>
                            <span class="month-tab-total">${formatCurrency(totalMes)}</span>
                            <span style="color:#003366;">⌄</span>
                        </div>
                    </div>
                    <div class="month-content" id="content-month-${m.month}" style="display:${isAberto ? 'block' : 'none'};">
                        <div class="month-config-row">
                            <div style="flex: 1; max-width: 200px;">
                                <label style="display:block; font-weight:bold; font-size:0.8rem; margin-bottom:5px;">Per Capita do Mês</label>
                                <input type="number" step="0.01" value="${m.perCapita}" onchange="Repasse.atualizarPerCapita(${m.month}, this.value)" style="padding:8px; border:1px solid #ccc; border-radius:4px; width:100%;">
                            </div>
                            <div style="flex: 1; text-align: right;">
                                <button class="btn-repasse-save" onclick="Repasse.salvarMes(${m.month})">💾 Salvar Alterações de ${nomesMeses[m.month-1]}</button>
                            </div>
                        </div>

                        <div style="overflow-x:auto;">
                            <table class="repasse-tabela">
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

        return `
            <tr>
                <td style="font-weight:bold; color:#003366;">${loc.lotacao}</td>
                <td>
                    <select onchange="Repasse.atualizarLocalidade(${month}, '${loc.lotacao}', { responsavelId: this.value })">
                        <option value="">Selecione...</option>
                        ${responsaveisCache.map(r => `<option value="${r.id}" ${r.id == loc.responsavelId ? "selected" : ""}>${r.nome}</option>`).join("")}
                    </select>
                </td>
                <td style="text-align:center;">${loc.filiadosAtivos}</td>
                <td style="text-align:center;">
                    <input type="number" value="${loc.prfTotal}" onchange="Repasse.atualizarLocalidade(${month}, '${loc.lotacao}', { prfTotal: this.value })" style="width:70px; text-align:center;">
                </td>
                <td style="text-align:center; color:${colorPercent}; font-weight:bold;">
                    ${hasWarning ? '<span title="PRF Total deve ser maior que zero">⚠️</span>' : percentDisplay}
                </td>
                <td style="text-align:right; font-weight:bold;">${formatCurrency(loc.creditoMes)}</td>
                <td style="text-align:right;">
                    <input type="number" step="0.01" value="${loc.reembolsoMes}" onchange="Repasse.atualizarLocalidade(${month}, '${loc.lotacao}', { reembolsoMes: this.value })" style="width:100px; text-align:right;">
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
        LOTACOES.forEach(lot => {
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
