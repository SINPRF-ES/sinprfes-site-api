/**
 * Módulo Repasse reformulado (Apoio Operacional + Eventos)
 */
(function (global) {
    if (global.Repasse) return;

    const MIN_YEAR = 2026;
    let yearCurrent = Math.max(new Date().getFullYear(), MIN_YEAR);
    let repasseData = null;
    let eventosAbertos = [];
    let responsaveis = [];
    let perfilLogado = 'FILIADO';

    function formatCurrency(v) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
    }

    function normalizeText(str) {
        return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    }

    function ehGestao() {
        return ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes((perfilLogado || '').toUpperCase());
    }

    async function inicializarRepasse(perfil) {
        perfilLogado = (perfil || 'FILIADO').toUpperCase();
        const container = document.getElementById('sec-repasse');
        if (!container) return;

        if (!ehGestao()) {
            container.innerHTML = '<p style="padding:16px; color:#b00;">Acesso restrito à gestão.</p>';
            return;
        }

        container.innerHTML = `
            <section class="card" style="padding:16px; max-width:1100px; margin:0 auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                    <h2 style="margin:0;">💱 Repasse</h2>
                    <div>
                        <label for="repasse-year-select">Ano:</label>
                        <select id="repasse-year-select"></select>
                    </div>
                </div>

                <div id="repasse-config-form" style="margin-top:16px;"></div>
                <div id="repasse-evento-form" style="margin-top:16px;"></div>

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

        await carregarResponsaveis();
        await carregarDados();
    }

    async function carregarResponsaveis() {
        const resp = await window.Api.apiFetch('/api/repasse/responsaveis');
        if (!resp.ok) {
            responsaveis = [];
            return;
        }
        const data = await resp.json();
        responsaveis = data.responsaveis || [];
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

        renderConfigForm();
        renderEventoForm();
        renderConfig();
        renderApoio();
        renderNaoAlocado();
        renderAlocacoes();
        renderAlocar();
    }

    function renderConfigForm() {
        const c = repasseData?.config || {};
        document.getElementById('repasse-config-form').innerHTML = `
            <div class="card" style="padding:12px; background:#fffbe6; border:1px solid #ead89a;">
                <h3 style="margin-top:0;">Configuração anual (gestão)</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:8px; align-items:end;">
                    <div>
                        <label>Per capta global anual</label>
                        <input id="cfg-global" type="number" min="0" step="0.01" value="${Number(c.perCapitaGlobalAnual || 0)}" style="width:100%;">
                    </div>
                    <div>
                        <label>Per capta apoio operacional anual</label>
                        <input id="cfg-apoio" type="number" min="0" step="0.01" value="${Number(c.perCapitaApoioOperacionalAnual || 0)}" style="width:100%;">
                    </div>
                    <div>
                        <button class="ui-btn" onclick="Repasse.salvarConfigAnual()">Salvar configuração</button>
                    </div>
                </div>
            </div>
        `;
    }

    function renderEventoForm() {
        const options = responsaveis.map((r) => `<option value="${r.id}">${r.nome} (${r.lotacao || 'SEM LOTAÇÃO'})</option>`).join('');
        document.getElementById('repasse-evento-form').innerHTML = `
            <div class="card" style="padding:12px; background:#f8f9fa; border:1px solid #ddd;">
                <h3 style="margin-top:0;">Cadastrar evento (gestão)</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:8px; align-items:end;">
                    <div style="grid-column:1 / -1;">
                        <label>Título</label>
                        <input id="evt-titulo" type="text" placeholder="Ex: Festa de Linhares" style="width:100%;">
                    </div>
                    <div>
                        <label>Responsável (busca por nome/lotação)</label>
                        <input id="evt-resp-busca" type="text" placeholder="Digite para filtrar..." oninput="Repasse.filtrarResponsaveis(this.value)" style="width:100%; margin-bottom:4px;">
                        <select id="evt-responsavel" style="width:100%;">
                            <option value="">Selecione</option>
                            ${options}
                        </select>
                    </div>
                    <div>
                        <label>Data do evento</label>
                        <input id="evt-data-evento" type="date" style="width:100%;">
                    </div>
                    <div>
                        <label>Data limite alocação</label>
                        <input id="evt-data-limite" type="date" style="width:100%;">
                    </div>
                    <div>
                        <label>Status inicial</label>
                        <select id="evt-status" style="width:100%;">
                            <option value="RASCUNHO">RASCUNHO</option>
                            <option value="ABERTO">ABERTO</option>
                        </select>
                    </div>
                    <div style="grid-column:1 / -1;">
                        <label>Descrição (opcional)</label>
                        <textarea id="evt-descricao" rows="2" style="width:100%;"></textarea>
                    </div>
                    <div>
                        <button class="ui-btn" onclick="Repasse.criarEvento()">Cadastrar evento</button>
                    </div>
                </div>
            </div>
        `;
    }

    function filtrarResponsaveis(termo) {
        const select = document.getElementById('evt-responsavel');
        if (!select) return;
        const needle = normalizeText(termo);
        const filtrados = !needle
            ? responsaveis
            : responsaveis.filter((r) => normalizeText(r.nome).includes(needle) || normalizeText(r.lotacao).includes(needle));

        const atual = select.value;
        select.innerHTML = `<option value="">Selecione</option>${filtrados.map((r) => `<option value="${r.id}">${r.nome} (${r.lotacao || 'SEM LOTAÇÃO'})</option>`).join('')}`;
        if (filtrados.some((f) => String(f.id) === String(atual))) select.value = atual;
    }

    async function salvarConfigAnual() {
        const perCapitaGlobalAnual = Number(document.getElementById('cfg-global')?.value || 0);
        const perCapitaApoioOperacionalAnual = Number(document.getElementById('cfg-apoio')?.value || 0);

        const resp = await window.Api.apiFetch(`/api/repasse/config?ano=${yearCurrent}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ perCapitaGlobalAnual, perCapitaApoioOperacionalAnual })
        });

        const data = await resp.json();
        if (!resp.ok) {
            alert(data.message || 'Erro ao salvar configuração.');
            return;
        }
        alert('Configuração salva com sucesso.');
        await carregarDados();
    }

    async function criarEvento() {
        const payload = {
            titulo: document.getElementById('evt-titulo')?.value?.trim(),
            responsavel_filiado_id: Number(document.getElementById('evt-responsavel')?.value) || null,
            data_evento: document.getElementById('evt-data-evento')?.value,
            data_limite_alocacao: document.getElementById('evt-data-limite')?.value,
            status: document.getElementById('evt-status')?.value,
            descricao: document.getElementById('evt-descricao')?.value?.trim() || null
        };

        if (!payload.titulo || !payload.data_evento || !payload.data_limite_alocacao) {
            alert('Preencha título, data do evento e data limite.');
            return;
        }

        const resp = await window.Api.apiFetch('/api/repasse/eventos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (!resp.ok) {
            alert(data.message || 'Erro ao cadastrar evento.');
            return;
        }
        alert('Evento cadastrado com sucesso.');
        await carregarDados();
    }

    function renderConfig() {
        if (!repasseData) return;
        const c = repasseData.config || {};
        document.getElementById('repasse-config').innerHTML = `
            <div class="card" style="padding:12px; background:#f8f9fa;">
                <strong>Configuração anual</strong>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:8px; margin-top:8px;">
                    <div>Per capta global: <b>${formatCurrency(c.perCapitaGlobalAnual)}</b></div>
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
        salvarConfigAnual,
        criarEvento,
        filtrarResponsaveis,
        alocarMeuRecurso
    };
})(window);
