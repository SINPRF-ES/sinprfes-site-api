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

    const LOTACOES = (global.RepasseConstants && global.RepasseConstants.REPASSE_LOTACOES) || [];

    async function inicializarRepasse(perfil) {
        perfilLogado = (perfil || "").toUpperCase();
        const container = document.getElementById("sec-repasse");
        if (!container) return;

        container.innerHTML = `
            <div class="section-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                    <h2 style="margin:0;">💱 Repasse por Localidade</h2>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <label style="font-weight:bold; color:#fff;">Ano:</label>
                        <select id="repasse-year-select" style="padding:5px 10px; border-radius:6px; background:#fff; color:#333; border:none;">
                            ${[yearCurrent, yearCurrent - 1, yearCurrent - 2].map(y => `<option value="${y}" ${y === yearCurrent ? "selected" : ""}>${y}</option>`).join("")}
                        </select>
                    </div>
                </div>
                <p class="section-subtitle" style="color:#ccc; margin-bottom:20px;">Acompanhamento de repasses mensais baseado no índice de filiação (ATIVOS).</p>

                <div id="repasse-geral-stats" style="margin-bottom:20px; padding:15px; background:rgba(255,255,255,0.05); border-radius:12px; display:flex; flex-wrap:wrap; gap:20px; border:1px solid rgba(255,255,255,0.1);">
                    <div><span style="color:#aaa; font-size:0.9rem;">Total Acumulado Geral (${yearCurrent}):</span> <br><strong id="total-acumulado-geral" style="font-size:1.4rem; color:#ffc107;">R$ 0,00</strong></div>
                </div>

                <div id="repasse-meses-container" style="display: flex; flex-direction: column; gap: 15px;">
                    <p style="text-align:center; padding:40px; color:#fff;">Carregando dados...</p>
                </div>
            </div>
        `;

        const selectYear = document.getElementById("repasse-year-select");
        if (selectYear) {
            selectYear.onchange = (e) => {
                yearCurrent = parseInt(e.target.value);
                const statsTitle = document.querySelector("#repasse-geral-stats span");
                if (statsTitle) statsTitle.textContent = `Total Acumulado Geral (${yearCurrent}):`;
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
              container.innerHTML = `<p style="color:#ff6b6b; text-align:center;">Erro ao carregar dados. Verifique suas permissões.</p>`;
            }
        } catch (e) {
            container.innerHTML = `<p style="color:#ff6b6b; text-align:center;">Erro de conexão.</p>`;
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

        // Preservar qual mês estava aberto
        const mesesAbertos = Array.from(document.querySelectorAll(".month-details"))
            .map((el, idx) => el.style.display === "block" ? idx + 1 : null)
            .filter(Boolean);

        container.innerHTML = repasseData.meses.map(m => {
            const totalMes = m.totalRepasseMes || 0;
            const isAberto = mesesAbertos.includes(m.month);

            return `
                <div class="month-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden;">
                    <div class="month-header" style="padding:12px 20px; background:rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="const d = this.nextElementSibling; d.style.display = d.style.display === 'none' ? 'block' : 'none'">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <strong style="font-size:1.1rem; min-width:100px; color:#fff;">${nomesMeses[m.month - 1]}</strong>
                            <span style="font-size:0.9rem; color:#aaa;">Per Capita: ${formatCurrency(m.perCapita)}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:20px;">
                            <div style="text-align:right;">
                                <small style="display:block; font-size:0.7rem; color:#aaa; text-transform:uppercase;">Repasse Total</small>
                                <strong style="color:#ffc107;">${formatCurrency(totalMes)}</strong>
                            </div>
                            <span style="font-size:1.2rem; color:#fff;">⌄</span>
                        </div>
                    </div>
                    <div class="month-details" id="details-month-${m.month}" style="display:${isAberto ? 'block' : 'none'}; padding:20px; border-top:1px solid rgba(255,255,255,0.08);">
                        <div class="field-row" style="margin-bottom:20px; display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px;">
                            <div class="field-group">
                                <label style="color:#ccc; font-size:0.85rem; margin-bottom:5px; display:block;">Per Capita do Mês</label>
                                <input type="number" step="0.01" value="${m.perCapita}" onchange="Repasse.atualizarPerCapita(${m.month}, this.value)" style="padding:8px; border-radius:6px; background:#fff; color:#333; border:none; width:100%;">
                            </div>
                            <div></div>
                        </div>

                        <div class="table-responsive" style="overflow-x:auto;">
                            <table class="table-filiados" style="width:100%; border-collapse:collapse; color:#eee; min-width:800px;">
                                <thead>
                                    <tr style="border-bottom:2px solid rgba(255,255,255,0.1); font-size:0.8rem; color:#aaa; text-transform:uppercase;">
                                        <th style="padding:10px 5px; text-align:left;">Localidade</th>
                                        <th style="padding:10px 5px; text-align:left;">Responsável</th>
                                        <th style="padding:10px 5px; text-align:center;">Filiados Ativos</th>
                                        <th style="padding:10px 5px; text-align:center;">PRF Total</th>
                                        <th style="padding:10px 5px; text-align:center;">% Filiação</th>
                                        <th style="padding:10px 5px; text-align:right;">Crédito Mês</th>
                                        <th style="padding:10px 5px; text-align:right;">Reembolso</th>
                                        <th style="padding:10px 5px; text-align:right;">Acumulado Ano</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${m.localidades.map(loc => renderRowLocalidade(m.month, loc)).join("")}
                                </tbody>
                            </table>
                        </div>
                        <div style="margin-top:20px; text-align:right;">
                            <button class="btn btn-primary" onclick="Repasse.salvarMes(${m.month})">💾 Salvar Alterações de ${nomesMeses[m.month-1]}</button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderRowLocalidade(month, loc) {
        const percent = loc.percentual;
        const percentDisplay = percent === null ? "—" : percent.toFixed(2) + "%";
        const hasWarning = (loc.prfTotal <= 0);

        let colorPercent = "#aaa";
        if (percent !== null) {
            if (percent < 70) colorPercent = "#ff6b6b";
            else if (percent < 80) colorPercent = "#fcc419";
            else colorPercent = "#51cf66";
        }

        return `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.9rem;">
                <td style="padding:12px 5px;"><strong style="color:#fff;">${loc.lotacao}</strong></td>
                <td style="padding:12px 5px;">
                    <select onchange="Repasse.atualizarLocalidade(${month}, '${loc.lotacao}', { responsavelId: this.value })" style="width:100%; padding:5px; border-radius:4px; background:#fff; color:#333; border:none; font-size:0.85rem;">
                        <option value="">Selecione...</option>
                        ${responsaveisCache.map(r => `<option value="${r.id}" ${r.id == loc.responsavelId ? "selected" : ""}>${r.nome} (${formatarCpf(r.cpf)})</option>`).join("")}
                    </select>
                </td>
                <td style="padding:12px 5px; text-align:center; color:#fff;">${loc.filiadosAtivos}</td>
                <td style="padding:12px 5px; text-align:center;">
                    <input type="number" value="${loc.prfTotal}" onchange="Repasse.atualizarLocalidade(${month}, '${loc.lotacao}', { prfTotal: this.value })" style="width:70px; padding:5px; text-align:center; border-radius:4px; border:none;">
                </td>
                <td style="padding:12px 5px; text-align:center; color:${colorPercent}; font-weight:bold;">
                    ${hasWarning ? '<span title="PRF Total deve ser maior que zero">⚠️ —</span>' : percentDisplay}
                </td>
                <td style="padding:12px 5px; text-align:right; font-weight:bold; color:#fff;">${formatCurrency(loc.creditoMes)}</td>
                <td style="padding:12px 5px; text-align:right;">
                    <input type="number" step="0.01" value="${loc.reembolsoMes}" onchange="Repasse.atualizarLocalidade(${month}, '${loc.lotacao}', { reembolsoMes: this.value })" style="width:100px; padding:5px; text-align:right; border-radius:4px; border:none;">
                </td>
                <td style="padding:12px 5px; text-align:right; color:#ffc107; font-weight:bold;">${formatCurrency(loc.acumuladoAno)}</td>
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
            const loc = m.localidades.find(l => l.lotacao === lotacao);
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

        // Recalcular acumulados do ano para todas as localidades
        const acumulados = {};
        LOTACOES.forEach(lot => {
            let somaCred = 0;
            let somaReem = 0;
            repasseData.meses.forEach(mes => {
                const l = mes.localidades.find(ll => ll.lotacao === lot);
                somaCred += l.creditoMes;
                somaReem += l.reembolsoMes;
            });
            acumulados[lot] = somaCred - somaReem;
        });

        // Aplicar acumulados atualizados em todos os meses
        repasseData.meses.forEach(mes => {
            mes.localidades.forEach(l => {
                l.acumuladoAno = acumulados[l.lotacao];
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
                // O carregarDados vai re-renderizar, mas queremos manter o mês aberto
                document.getElementById("details-month-" + month).style.display = "block";
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

    function formatarCpf(cpf) {
        if (!cpf) return "";
        const only = String(cpf).replace(/\D/g, "");
        if (only.length !== 11) return cpf;
        return only.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }

    global.Repasse = {
        inicializarRepasse,
        atualizarPerCapita,
        atualizarLocalidade,
        salvarMes
    };

})(typeof window !== 'undefined' ? window : global);
