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
    let alocacoesExpanded = false;
    let searchTimer = null;

    function formatCurrency(v) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
    }

    function ehGestao() {
        return ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes((perfilLogado || '').toUpperCase());
    }

    function injectStyles() {
        if (document.getElementById('repasse-modern-style')) return;
        const style = document.createElement('style');
        style.id = 'repasse-modern-style';
        style.textContent = `
            .repasse-shell{max-width:1200px;margin:0 auto;padding:18px;background:#eef2f6;border-radius:14px;}
            .repasse-header{text-align:center;margin-bottom:14px;}
            .repasse-title{margin:0;color:#0b3a67;font-size:2rem;}
            .repasse-subtitle{margin:.3rem 0 0;color:#607589;}
            .repasse-card{background:#fff;border:1px solid #d9e2ec;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.04);padding:14px;margin-top:14px;}
            .repasse-card h3{margin:0 0 8px;color:#0b3a67;text-align:center;}
            .repasse-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;align-items:end;}
            .repasse-alert{border-left:4px solid #0b8f6a;background:#f3fbf8;}
            .repasse-alert-value{font-size:1.7rem;font-weight:700;color:#0b3a67;}
            .repasse-table-wrap{overflow-x:auto;}
            .repasse-table{width:100%;border-collapse:collapse;min-width:760px;}
            .repasse-table th,.repasse-table td{border:1px solid #dbe3ec;padding:9px;}
            .repasse-table th{background:#e8eef5;color:#0b3a67;text-transform:uppercase;font-size:.75rem;}
            .repasse-table tbody tr:nth-child(even){background:#f8fbff;}
            .repasse-table tbody tr:hover{background:#edf4fb;}
            .repasse-table .num{text-align:right;}
            .repasse-table .center{text-align:center;}
            .badge-sem-lotacao{display:inline-block;background:#fff0c7;color:#7f5700;border:1px solid #e5c979;padding:2px 6px;border-radius:999px;font-size:.75rem;font-weight:700;margin-left:6px;}
            .repasse-evento-box{border:1px solid #dbe3ec;background:#fff;border-radius:10px;padding:10px;margin-top:8px;}
            .repasse-evento-title{font-weight:700;color:#0b3a67;}
            .repasse-evento-total{font-weight:700;color:#0b8f6a;margin:.3rem 0;}
            .repasse-toggle{display:flex;justify-content:center;}
            @media (max-width: 768px){.repasse-shell{padding:10px}}
        `;
        document.head.appendChild(style);
    }

    async function inicializarRepasse(perfil) {
        perfilLogado = (perfil || 'FILIADO').toUpperCase();
        const container = document.getElementById('sec-repasse');
        if (!container) return;

        if (!ehGestao()) {
            container.innerHTML = '<p style="padding:16px; color:#b00;">Acesso restrito à gestão.</p>';
            return;
        }

        injectStyles();

        container.innerHTML = `
            <section class="repasse-shell">
                <header class="repasse-header">
                    <h2 class="repasse-title">Repasse</h2>
                    <div class="repasse-subtitle" id="repasse-subtitle">Ano ${yearCurrent} • Apoio operacional e alocações</div>
                </header>
                <div class="repasse-card">
                    <div style="max-width:240px;margin:0 auto;">
                        <label for="repasse-year-select">Ano</label>
                        <select id="repasse-year-select" style="width:100%"></select>
                    </div>
                </div>
                <div id="repasse-evento-form"></div>
                <div id="repasse-apoio"></div>
                <div id="repasse-nao-alocado"></div>
                <div id="repasse-alocacoes"></div>
                <div id="repasse-alocar"></div>
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
            const subtitle = document.getElementById('repasse-subtitle');
            if (subtitle) subtitle.textContent = `Ano ${yearCurrent} • Apoio operacional e alocações`;
            await carregarDados();
        });

        await carregarResponsaveis('');
        await carregarDados();
    }

    async function carregarResponsaveis(q = '') {
        const query = `?q=${encodeURIComponent(q || '')}`;
        const resp = await window.Api.apiFetch(`/api/repasse/responsaveis${query}`);
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

        repasseData = await resumoResp.json();

        if (eventosResp.ok) {
            const de = await eventosResp.json();
            eventosAbertos = de.eventos || [];
        } else {
            eventosAbertos = [];
        }

        renderEventoForm();
        renderApoio();
        renderNaoAlocado();
        renderAlocacoes();
        renderAlocar();
    }

    function formatSituacaoLabel(situacao) {
        const val = String(situacao || '').toUpperCase();
        if (val === 'VETERANO') return 'Veterano';
        if (val === 'ATIVO') return 'Ativo';
        return situacao || 'Não informado';
    }

    function responsavelLabel(r) {
        return `${r.nome} (${formatSituacaoLabel(r.situacao)})${r.lotacao ? ` — ${r.lotacao}` : ''}`;
    }

    function renderEventoForm() {
        const options = responsaveis.map((r) => `<option value="${r.id}">${responsavelLabel(r)}</option>`).join('');
        document.getElementById('repasse-evento-form').innerHTML = `
            <div class="repasse-card">
                <h3>Cadastrar evento (gestão)</h3>
                <div class="repasse-grid">
                    <div style="grid-column:1 / -1;">
                        <label>Título</label>
                        <input id="evt-titulo" type="text" placeholder="Ex: Festa de Linhares" style="width:100%;">
                    </div>
                    <div>
                        <label>Responsável (ativos e veteranos)</label>
                        <input id="evt-resp-busca" type="text" placeholder="Digite para buscar..." oninput="Repasse.buscarResponsaveis(this.value)" style="width:100%; margin-bottom:4px;">
                        <select id="evt-responsavel" style="width:100%;">
                            <option value="">Selecione</option>
                            ${options}
                        </select>
                        <div id="evt-resp-empty" style="font-size:.85rem;color:#6b7c8c;margin-top:4px;${responsaveis.length ? 'display:none;' : ''}">Nenhum filiado encontrado.</div>
                    </div>
                    <div><label>Data do evento</label><input id="evt-data-evento" type="date" style="width:100%;"></div>
                    <div><label>Data limite alocação</label><input id="evt-data-limite" type="date" style="width:100%;"></div>
                    <div>
                        <label>Status inicial</label>
                        <select id="evt-status" style="width:100%;">
                            <option value="RASCUNHO">RASCUNHO</option>
                            <option value="ABERTO">ABERTO</option>
                        </select>
                    </div>
                    <div style="grid-column:1 / -1;"><label>Descrição</label><textarea id="evt-descricao" rows="2" style="width:100%;"></textarea></div>
                    <div><button class="ui-btn" onclick="Repasse.criarEvento()">Cadastrar evento</button></div>
                </div>
            </div>
        `;
    }

    async function buscarResponsaveis(termo) {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            await carregarResponsaveis(termo || '');
            const select = document.getElementById('evt-responsavel');
            if (!select) return;
            const atual = select.value;
            select.innerHTML = `<option value="">Selecione</option>${responsaveis.map((r) => `<option value="${r.id}">${responsavelLabel(r)}</option>`).join('')}`;
            if (responsaveis.some((f) => String(f.id) === String(atual))) select.value = atual;
            const empty = document.getElementById('evt-resp-empty');
            if (empty) empty.style.display = responsaveis.length ? 'none' : 'block';
        }, 250);
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

    function renderApoio() {
        const rows = (repasseData.apoioPorLotacao || []).map((r) => {
            const sem = r.lotacao === 'SEM LOTAÇÃO';
            return `
            <tr>
              <td>${r.lotacao}${sem ? '<span class="badge-sem-lotacao">SEM LOTAÇÃO</span>' : ''}</td>
              <td class="center">${r.qtdAtivos}</td>
              <td class="num">${formatCurrency(r.creditoApoioOperacional)}</td>
              <td class="num">${formatCurrency(r.debitosApoioOperacional)}</td>
              <td class="num" style="font-weight:700;">${formatCurrency(r.saldoApoioOperacional)}</td>
            </tr>
        `;
        }).join('');

        document.getElementById('repasse-apoio').innerHTML = `
            <div class="repasse-card">
              <h3>Apoio operacional por lotação</h3>
              <div class="repasse-table-wrap">
                <table class="repasse-table">
                  <thead><tr><th>Lotação</th><th>Ativos</th><th>Crédito</th><th>Débitos</th><th>Saldo</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
            </div>
        `;
    }

    function renderNaoAlocado() {
        document.getElementById('repasse-nao-alocado').innerHTML = `
            <div class="repasse-card repasse-alert">
                <div style="font-size:0.9rem; color:#4f5e6d;">Recurso não alocado</div>
                <div class="repasse-alert-value">${formatCurrency(repasseData.recursoNaoAlocadoTotal)}</div>
            </div>
        `;
    }

    function renderAlocacoes() {
        const grupos = repasseData.alocacoesPorEvento || [];
        const content = !alocacoesExpanded
            ? ''
            : (grupos.map((g) => {
                const itens = (g.itens || []).map((i) => `<li>${i.nome} (${i.situacao}) — ${formatCurrency(i.valorAlocado)}</li>`).join('') || '<li>Sem alocações</li>';
                return `
                    <div class="repasse-evento-box">
                        <div class="repasse-evento-title">${g.evento.titulo}</div>
                        <div style="font-size:.9rem;color:#607589;">Evento: ${String(g.evento.data_evento).slice(0, 10)} • Limite: ${String(g.evento.data_limite_alocacao).slice(0, 10)}</div>
                        <div class="repasse-evento-total">Total alocado: ${formatCurrency(g.totalAlocado)}</div>
                        <ul style="margin:0;padding-left:16px;">${itens}</ul>
                    </div>
                `;
            }).join('') || '<p>Sem eventos no ano.</p>');

        document.getElementById('repasse-alocacoes').innerHTML = `
            <div class="repasse-card">
                <h3>Alocações por evento</h3>
                <div class="repasse-toggle"><button class="ui-btn" onclick="Repasse.toggleAlocacoes()">${alocacoesExpanded ? 'Ocultar alocações' : 'Mostrar alocações'}</button></div>
                <div style="margin-top:8px;">${content}</div>
            </div>
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
            <div class="repasse-card">
                <h3>Alocar meu recurso</h3>
                ${eventosAbertos.length
                ? `<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    <select id="repasse-evento-select">${options}</select>
                    <button class="ui-btn" onclick="Repasse.alocarMeuRecurso()">Alocar</button>
                  </div>`
                : '<p>Sem eventos abertos no momento.</p>'}
            </div>
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

    function toggleAlocacoes() {
        alocacoesExpanded = !alocacoesExpanded;
        renderAlocacoes();
    }

    global.Repasse = {
        inicializarRepasse,
        criarEvento,
        buscarResponsaveis,
        alocarMeuRecurso,
        toggleAlocacoes
    };
})(window);
