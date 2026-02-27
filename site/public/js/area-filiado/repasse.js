/**
 * Módulo Repasse reformulado (Apoio Operacional + Eventos)
 */
(function (global) {
    if (global.Repasse) return;

    const MIN_YEAR = 2026;
    let yearCurrent = Math.max(new Date().getFullYear(), MIN_YEAR);
    let repasseData = null;
    let eventosAbertos = [];

    function formatCurrency(v) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
    }

    async function inicializarRepasse() {
        const container = document.getElementById('sec-repasse');
        if (!container) return;

        container.innerHTML = `
            <section class="card" style="padding:16px; max-width:1100px; margin:0 auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                    <h2 style="margin:0;">💱 Repasse</h2>
                    <div>
                        <label for="repasse-year-select">Ano:</label>
                        <select id="repasse-year-select"></select>
                    </div>
                </div>
                <div id="repasse-config" style="margin-top:16px;"></div>
                <div id="repasse-apoio" style="margin-top:16px;"></div>
                <div id="repasse-nao-alocado" style="margin-top:16px;"></div>
                <div id="repasse-alocacoes" style="margin-top:16px;"></div>
                <div id="repasse-alocar" style="margin-top:16px;"></div>
            </section>
        `;

        const yearSelect = document.getElementById('repasse-year-select');
        const endYear = new Date().getFullYear() + 5;
        for (let y = MIN_YEAR; y <= endYear; y++) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = String(y);
            if (y === yearCurrent) opt.selected = true;
            yearSelect.appendChild(opt);
        }
        yearSelect.addEventListener('change', async (e) => {
            yearCurrent = Number(e.target.value);
            await carregarDados();
        });

        await carregarDados();
    }

    async function carregarDados() {
        const [resumoResp, eventosResp] = await Promise.all([
            window.Api.apiFetch(`/api/repasse/resumo?ano=${yearCurrent}`),
            window.Api.apiFetch(`/api/repasse/eventos?ano=${yearCurrent}&status=ABERTO`)
        ]);

        if (!resumoResp.ok) {
            document.getElementById('repasse-apoio').innerHTML = '<p style="color:#b00;">Não foi possível carregar o resumo.</p>';
            return;
        }

        const resumo = await resumoResp.json();
        repasseData = resumo;

        if (eventosResp.ok) {
            const de = await eventosResp.json();
            eventosAbertos = de.eventos || [];
        } else {
            eventosAbertos = [];
        }

        renderConfig();
        renderApoio();
        renderNaoAlocado();
        renderAlocacoes();
        renderAlocar();
    }

    function renderConfig() {
        if (!repasseData) return;
        const c = repasseData.config || {};
        document.getElementById('repasse-config').innerHTML = `
            <div class="card" style="padding:12px; background:#f8f9fa;">
                <strong>Configuração anual</strong>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:8px; margin-top:8px;">
                    <div>Per capita global: <b>${formatCurrency(c.perCapitaGlobalAnual)}</b></div>
                    <div>Apoio operacional: <b>${formatCurrency(c.perCapitaApoioOperacionalAnual)}</b></div>
                    <div>Evento ativo (derivado): <b>${formatCurrency(c.perCapitaEventoAtivoAnual)}</b></div>
                    <div>Evento veterano: <b>${formatCurrency(c.perCapitaEventoVeteranoAnual)}</b></div>
                </div>
            </div>
        `;
    }

    function renderApoio() {
        const rows = (repasseData.apoioPorLotacao || []).map((r) => `
            <tr>
              <td>${r.lotacao}</td>
              <td style="text-align:center;">${r.qtdAtivos}</td>
              <td style="text-align:right;">${formatCurrency(r.creditoApoioOperacional)}</td>
              <td style="text-align:right;">${formatCurrency(r.debitosApoioOperacional)}</td>
              <td style="text-align:right; font-weight:700;">${formatCurrency(r.saldoApoioOperacional)}</td>
            </tr>
        `).join('');

        document.getElementById('repasse-apoio').innerHTML = `
            <h3>Apoio operacional por lotação real</h3>
            <div class="ui-table-wrapper">
              <table class="ui-table" style="width:100%;">
                <thead><tr><th>Lotação</th><th>Ativos</th><th>Crédito</th><th>Débitos</th><th>Saldo</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
        `;
    }

    function renderNaoAlocado() {
        document.getElementById('repasse-nao-alocado').innerHTML = `
            <div class="card" style="padding:12px; border-left:4px solid #0a7;">
                <div style="font-size:0.9rem; color:#666;">Recurso não alocado (eventos)</div>
                <div style="font-size:1.5rem; font-weight:700;">${formatCurrency(repasseData.recursoNaoAlocadoTotal)}</div>
            </div>
        `;
    }

    function renderAlocacoes() {
        const grupos = repasseData.alocacoesPorEvento || [];
        const details = grupos.map((g) => {
            const itens = (g.itens || []).map((i) => `<li>${i.nome} (${i.situacao}) — ${formatCurrency(i.valorAlocado)}</li>`).join('') || '<li>Sem alocações</li>';
            return `
                <details>
                    <summary><b>${g.evento.titulo}</b> — Total ${formatCurrency(g.totalAlocado)} (${g.contagemAtivos} ativos / ${g.contagemVeteranos} veteranos)</summary>
                    <ul>${itens}</ul>
                </details>
            `;
        }).join('') || '<p>Sem eventos no ano.</p>';

        document.getElementById('repasse-alocacoes').innerHTML = `
            <details>
                <summary style="cursor:pointer;"><b>Ver alocações</b></summary>
                <div style="margin-top:8px;">${details}</div>
            </details>
        `;
    }

    function renderAlocar() {
        const today = new Date().toISOString().slice(0, 10);
        const options = eventosAbertos.map((e) => {
            const disabled = today > e.data_limite_alocacao;
            const suffix = disabled ? ' (prazo encerrado)' : '';
            return `<option value="${e.id}" ${disabled ? 'disabled' : ''}>${e.titulo} — evento ${e.data_evento} / limite ${e.data_limite_alocacao}${suffix}</option>`;
        }).join('');

        document.getElementById('repasse-alocar').innerHTML = `
            <h3>Alocar meu recurso</h3>
            ${eventosAbertos.length
                ? `<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    <select id="repasse-evento-select">${options}</select>
                    <button class="ui-btn" onclick="Repasse.alocarMeuRecurso()">Alocar</button>
                  </div>`
                : '<p>Sem eventos abertos no momento.</p>'}
        `;
    }

    async function alocarMeuRecurso() {
        const select = document.getElementById('repasse-evento-select');
        if (!select || !select.value) return;
        const resp = await window.Api.apiFetch(`/api/repasse/eventos/${select.value}/alocar`, { method: 'POST' });
        const data = await resp.json();
        if (!resp.ok) {
            alert(data.message || 'Falha ao alocar recurso.');
            return;
        }
        alert('Recurso alocado com sucesso.');
        await carregarDados();
    }

    global.Repasse = {
        inicializarRepasse,
        alocarMeuRecurso
    };
})(window);
