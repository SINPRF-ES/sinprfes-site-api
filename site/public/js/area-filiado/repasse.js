/**
 * Módulo Repasse reformulado (Apoio Operacional + Eventos)
 */
(function (global) {
    if (global.Repasse) return;

    const MIN_YEAR = 2026;
    const AUTO_POLL_INTERVAL_MS = 30000;

    function isoToBr(iso) {
        if (!iso) return '';
        const [y, m, d] = String(iso).split('T')[0].split('-');
        if (!y || !m || !d) return iso;
        return `${d}/${m}/${y}`;
    }

    function brToIso(br) {
        if (!br) return null;
        const [d, m, y] = br.split('/');
        if (!d || !m || !y) return null;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    let yearCurrent = Math.max(new Date().getFullYear(), MIN_YEAR);
    let repasseData = null;
    let eventosAbertos = [];
    let responsaveis = [];
    let allResponsaveisCache = null;
    let perfilLogado = 'FILIADO';
    let alocacoesExpanded = false;
    let searchTimer = null;
    let activeModalCloser = null;
    let repassePollingId = null;
    let isLoadingRepasse = false;
    let selectedLotacaoForLista = null;
    let movimentosListaAtual = [];
    let repasseVisibilityBound = false;
    let lastResumoSignature = '';
    let lastEventosSignature = '';
    let lastMovimentosSignature = '';
    let eventosGestao = [];
    let podeGerenciarRepasse = false;

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && typeof activeModalCloser === 'function') {
            activeModalCloser();
        }
    });

    function formatCurrency(v) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
    }

    function sanitizeToCentavos(input) {
        if (window.Formatters?.sanitizeToCentavos) return window.Formatters.sanitizeToCentavos(input);
        const digitsOnly = String(input || '').replace(/\D/g, '');
        const normalized = digitsOnly.replace(/^0+(?=\d)/, '');
        return normalized || '0';
    }

    function formatCentavosBRL(centavos) {
        if (window.Formatters?.formatCentavosBRL) return window.Formatters.formatCentavosBRL(centavos);
        const valorCentavos = Number(sanitizeToCentavos(centavos));
        const valorReais = valorCentavos / 100;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorReais);
    }

    function decimalToCentavos(valor) {
        const numero = Number(valor || 0);
        return Number.isFinite(numero) ? String(Math.round(numero * 100)) : '0';
    }

    function valorBackendToCentavos(movimento) {
        if (movimento.valor_centavos !== undefined && movimento.valor_centavos !== null) return sanitizeToCentavos(movimento.valor_centavos);
        if (movimento.valorCentavos !== undefined && movimento.valorCentavos !== null) return sanitizeToCentavos(movimento.valorCentavos);
        return decimalToCentavos(movimento.valor);
    }

    function bindModalOverlayClose(modal, handleClose) {
        modal.onclick = (event) => {
            if (event.target === modal) handleClose();
        };
    }

    function openModal(modal, handleClose) {
        activeModalCloser = handleClose;
        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    function closeModalById(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('active');
        modal.style.display = 'none';
        if (activeModalCloser) activeModalCloser = null;
    }

    function setCurrencyInputValue(inputId, centavos) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const sanitized = sanitizeToCentavos(centavos);
        input.dataset.centavos = sanitized;
        input.value = formatCentavosBRL(sanitized);
    }

    function handleCurrencyInputChange(input) {
        const centavos = sanitizeToCentavos(input?.value);
        if (!input) return;
        input.dataset.centavos = centavos;
        input.value = formatCentavosBRL(centavos);
    }

    function iniciarSyncRepasse() {
        if (repassePollingId) return;
        repassePollingId = setInterval(async () => {
            if (document.visibilityState !== 'visible' || isLoadingRepasse) return;
            await refreshNow({ showLoading: false });
            if (selectedLotacaoForLista && document.getElementById('modal-lista-debitos')?.classList.contains('active')) {
                await abrirModalListaDebitos(selectedLotacaoForLista, true);
            }
        }, AUTO_POLL_INTERVAL_MS);
    }

    function bindRepasseVisibilitySync() {
        if (repasseVisibilityBound) return;
        repasseVisibilityBound = true;
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState !== 'visible') return;
            await refreshNow({ showLoading: false });
            if (selectedLotacaoForLista && document.getElementById('modal-lista-debitos')?.classList.contains('active')) {
                await abrirModalListaDebitos(selectedLotacaoForLista, true);
            }
        });
    }

    function ehGestao() {
        return Boolean(podeGerenciarRepasse || ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes((perfilLogado || '').toUpperCase()));
    }

    function atualizarPermissaoGestao() {
        try {
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const perms = Array.isArray(userInfo?.permissions) ? userInfo.permissions : [];
            podeGerenciarRepasse = perms.includes('*') || perms.includes('REPASSE_GERENCIAR');
        } catch (_) {
            podeGerenciarRepasse = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes((perfilLogado || '').toUpperCase());
        }
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
            .ui-btn-sm{padding:4px 8px;font-size:0.75rem;}
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
        atualizarPermissaoGestao();
        const container = document.getElementById('sec-repasse');
        if (!container) return;

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
                        <button id="repasse-hard-refresh" class="ui-btn" style="margin-top:8px;width:100%;">Atualizar</button>
                    </div>
                </div>
                <div id="repasse-evento-form"></div>
                <div id="repasse-apoio"></div>
                <div id="repasse-nao-alocado"></div>
                <div id="repasse-alocacoes"></div>
                <div id="repasse-alocar"></div>
                <div id="repasse-eventos-gestao"></div>
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
            await refreshNow({ showLoading: true });
        });

        const hardRefreshBtn = document.getElementById('repasse-hard-refresh');
        if (hardRefreshBtn) {
            hardRefreshBtn.addEventListener('click', async () => {
                await refreshNow({ showLoading: true });
            });
        }

        if (ehGestao()) await carregarResponsaveis('');
        bindRepasseVisibilitySync();
        iniciarSyncRepasse();
        await refreshNow({ showLoading: true });
    }


    function assinaturaResumo(resumo) {
        if (!resumo) return '';
        return JSON.stringify({
            totalNaoAlocado: resumo.totalNaoAlocado,
            lotacoes: (resumo.apoioPorLotacao || []).map((r) => [r.lotacao, r.qtdAtivos, r.creditoApoioOperacional, r.debitosApoioOperacional, r.saldoApoioOperacional]),
            alocacoes: (resumo.alocacoes || []).map((a) => [a.eventoId, a.valorAlocado])
        });
    }

    function assinaturaEventos(eventos) {
        return JSON.stringify((eventos || []).map((e) => [e.id, e.titulo, e.status, e.valor_total_alocado]));
    }

    function assinaturaMovimentos(movimentos) {
        return JSON.stringify((movimentos || []).map((m) => [m.id, m.updated_at || m.created_at, m.valor_centavos ?? m.valorCentavos ?? m.valor, m.observacao]));
    }

    async function refreshNow({ showLoading = false } = {}) {
        await carregarDados({ showLoading });
    }


    async function carregarResponsaveis(q = '') {
        if (!allResponsaveisCache) {
            const resp = await window.Api.apiFetch(`/api/repasse/responsaveis`);
            if (!resp.ok) {
                responsaveis = [];
                return;
            }
            const data = await resp.json();
            allResponsaveisCache = data.responsaveis || [];
        }

        if (q && q.length >= 2) {
            responsaveis = window.Utils.filterFiliados(allResponsaveisCache, q, { perfil: perfilLogado });
        } else {
            responsaveis = allResponsaveisCache;
        }
    }

    async function carregarDados({ showLoading = false } = {}) {
        if (isLoadingRepasse) return;
        isLoadingRepasse = true;
        const [resumoResp, eventosResp] = await Promise.all([
            window.Api.apiFetch(`/api/repasse/resumo?ano=${yearCurrent}`),
            window.Api.apiFetch(`/api/repasse/eventos?ano=${yearCurrent}&status=ABERTO`)
        ]);

        if (ehGestao()) {
            const eventosGestaoResp = await window.Api.apiFetch(`/api/repasse/eventos?ano=${yearCurrent}&includeCancelados=1`);
            if (eventosGestaoResp.ok) {
                const dataEventos = await eventosGestaoResp.json();
                eventosGestao = dataEventos.eventos || [];
            } else {
                eventosGestao = [];
            }
        } else {
            eventosGestao = [];
        }

        if (!resumoResp.ok) {
            document.getElementById('repasse-apoio').innerHTML = '<p style="color:#b00;">Não foi possível carregar o resumo.</p>';
            isLoadingRepasse = false;
            return;
        }

        const proximoResumo = await resumoResp.json();

        if (eventosResp.ok) {
            const de = await eventosResp.json();
            eventosAbertos = de.eventos || [];
        } else {
            eventosAbertos = [];
        }

        const novaAssinaturaResumo = assinaturaResumo(proximoResumo);
        const novaAssinaturaEventos = assinaturaEventos(eventosAbertos);
        const resumoMudou = novaAssinaturaResumo !== lastResumoSignature;
        const eventosMudaram = novaAssinaturaEventos !== lastEventosSignature;

        if (!resumoMudou && !eventosMudaram && !showLoading) {
            isLoadingRepasse = false;
            return;
        }

        repasseData = proximoResumo;
        lastResumoSignature = novaAssinaturaResumo;
        lastEventosSignature = novaAssinaturaEventos;

        renderEventoForm();
        renderApoio();
        renderNaoAlocado();
        renderAlocacoes();
        renderAlocar();
        renderGestaoEventos();
        isLoadingRepasse = false;
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
        if (!ehGestao()) {
            document.getElementById('repasse-evento-form').innerHTML = '';
            return;
        }
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
                    <div><label>Data do evento</label><input id="evt-data-evento" type="text" placeholder="DD/MM/AAAA" style="width:100%;"></div>
                    <div><label>Data limite alocação</label><input id="evt-data-limite" type="text" placeholder="DD/MM/AAAA" style="width:100%;"></div>
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

        if (window.Utils?.aplicarMascaraData) {
            window.Utils.aplicarMascaraData(document.getElementById('evt-data-evento'));
            window.Utils.aplicarMascaraData(document.getElementById('evt-data-limite'));
        }
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
        if (!ehGestao()) { alert('Ação permitida apenas para gestão.'); return; }
        const payload = {
            titulo: document.getElementById('evt-titulo')?.value?.trim(),
            responsavel_filiado_id: Number(document.getElementById('evt-responsavel')?.value) || null,
            data_evento: brToIso(document.getElementById('evt-data-evento')?.value),
            data_limite_alocacao: brToIso(document.getElementById('evt-data-limite')?.value),
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
        await refreshNow({ showLoading: false });
    }

    function renderApoio() {
        const rows = (repasseData.apoioPorLotacao || []).map((r) => {
            const acoes = ehGestao()
                ? `<div style="display:flex;gap:4px;justify-content:center;">
                  <button class="ui-btn ui-btn-sm" onclick="Repasse.abrirModalDebito('${r.lotacao}')" title="Lançar débito">Lançar</button>
                  <button class="ui-btn ui-btn-sm" style="background:#607589" onclick="Repasse.abrirModalListaDebitos('${r.lotacao}')" title="Ver débitos">Ver</button>
                </div>`
                : '<span style="color:#607589;">Somente gestão</span>';
            return `
            <tr>
              <td class="center">${r.lotacao}</td>
              <td class="center">${r.qtdAtivos}</td>
              <td class="center" style="color:var(--ui-primary);font-weight:600;">${formatCurrency(r.creditoApoioOperacional)}</td>
              <td class="center" style="color:var(--ui-danger);font-weight:600;">${formatCurrency(r.debitosApoioOperacional)}</td>
              <td class="center" style="font-weight:700;">${formatCurrency(r.saldoApoioOperacional)}</td>
              <td class="center">${acoes}</td>
            </tr>
        `;
        }).join('');

        document.getElementById('repasse-apoio').innerHTML = `
            <div class="repasse-card">
              <h3>Apoio operacional por lotação</h3>
              <div class="repasse-table-wrap">
                <table class="repasse-table">
                  <thead><tr><th class="center">Lotação</th><th class="center">Ativos</th><th class="center">Crédito</th><th class="center">Débitos</th><th class="center">Saldo</th><th class="center">Ações</th></tr></thead>
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
        const cancelados = ehGestao() ? (repasseData.alocacoesCanceladas || []) : [];
        const content = !alocacoesExpanded
            ? ''
            : (grupos.map((g) => {
                const itens = (g.itens || []).map((i) => {
                    const filiadoId = Number(i.filiado_id || i.filiadoId || 0);
                    const botaoGestao = ehGestao() && filiadoId
                        ? ` <button class="ui-btn ui-btn-sm" style="background:#b42318;" onclick="Repasse.retirarAlocacaoGestao(${g.evento.id}, ${filiadoId}, '${String(i.nome || '').replace(/'/g, "\'")}')">Cancelar</button>`
                        : '';
                    return `<li>${i.nome} (${i.situacao}) — ${formatCurrency(i.valorAlocado)}${botaoGestao}</li>`;
                }).join('') || '<li>Sem alocações</li>';
                return `
                    <div class="repasse-evento-box">
                        <div class="repasse-evento-title">${g.evento.titulo}</div>
                        <div style="font-size:.9rem;color:#607589;">Evento: ${isoToBr(g.evento.data_evento)} • Limite: ${isoToBr(g.evento.data_limite_alocacao)}</div>
                        <div class="repasse-evento-total">Total alocado: ${formatCurrency(g.totalAlocado)}</div>
                        <ul style="margin:0;padding-left:16px;">${itens}</ul>
                    </div>
                `;
            }).join('') || '<p>Sem eventos no ano.</p>');

        const canceladosContent = !alocacoesExpanded || !ehGestao()
            ? ''
            : `
                <div style="margin-top:10px;">
                    <h4 style="margin:0 0 6px;color:#667085;">Cancelados (somente gestão)</h4>
                    ${cancelados.length ? cancelados.map((g) => {
                        const tooltip = `Motivo: ${g.evento.delete_reason || 'Não informado'} | Por: ${g.evento.deleted_by_nome || `ID ${g.evento.deleted_by_user_id || '-'}`} | Em: ${isoToBr(g.evento.deleted_at || '')}`;
                        return `<div class="repasse-evento-box" title="${tooltip.replace(/"/g, '&quot;')}"><div class="repasse-evento-title">${g.evento.titulo}</div><div style="font-size:.9rem;color:#607589;">Evento cancelado • passe o mouse para auditoria</div></div>`;
                    }).join('') : '<p style="color:#607589;">Sem eventos cancelados no ano.</p>'}
                </div>
            `;

        document.getElementById('repasse-alocacoes').innerHTML = `
            <div class="repasse-card">
                <h3>Alocações por evento</h3>
                <div class="repasse-toggle"><button class="ui-btn" onclick="Repasse.toggleAlocacoes()">${alocacoesExpanded ? 'Ocultar alocações' : 'Mostrar alocações'}</button></div>
                <div style="margin-top:8px;">${content}${canceladosContent}</div>
            </div>
        `;
    }

    function renderAlocar() {
        const today = new Date().toISOString().slice(0, 10);
        const options = eventosAbertos.map((e) => {
            const disabled = today > e.data_limite_alocacao;
            const suffix = disabled ? ' (prazo encerrado)' : '';
            return `<option value="${e.id}" ${disabled ? 'disabled' : ''}>${e.titulo} — evento ${isoToBr(e.data_evento)} / limite ${isoToBr(e.data_limite_alocacao)}${suffix}</option>`;
        }).join('');

        document.getElementById('repasse-alocar').innerHTML = `
            <div class="repasse-card">
                <h3>Alocar meu recurso</h3>
                ${eventosAbertos.length
                ? `<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    <select id="repasse-evento-select">${options}</select>
                    <button class="ui-btn" onclick="Repasse.alocarMeuRecurso()">Alocar</button>
                    <button class="ui-btn" style="background:#667085;" onclick="Repasse.retirarMinhaAlocacao()">Retirar minha alocação</button>
                  </div>`
                : '<p>Sem eventos abertos no momento.</p>'}
            </div>
        `;
    }

    function renderGestaoEventos() {
        const container = document.getElementById('repasse-eventos-gestao');
        if (!container) return;
        if (!ehGestao()) {
            container.innerHTML = '';
            return;
        }

        if (!eventosGestao.length) {
            container.innerHTML = `
                <div class="repasse-card">
                    <h3>Eventos do ano (gestão)</h3>
                    <p>Sem eventos cadastrados para ${yearCurrent}.</p>
                </div>
            `;
            return;
        }

        const ativos = eventosGestao.filter((e) => !e.deleted_at);
        const cancelados = eventosGestao.filter((e) => e.deleted_at);

        const rows = ativos.map((evento) => {
            const status = String(evento.status || '').toUpperCase();
            const botoesStatus = status === 'ABERTO'
                ? `<button class="ui-btn ui-btn-sm" style="background:#667085" onclick="Repasse.encerrarEvento(${evento.id})">Encerrar</button>`
                : `<button class="ui-btn ui-btn-sm" style="background:#027a48" onclick="Repasse.abrirEvento(${evento.id})">Abrir</button>`;

            return `
                <tr>
                    <td>${evento.titulo || '-'}</td>
                    <td class="center">${isoToBr(evento.data_evento)}</td>
                    <td class="center">${isoToBr(evento.data_limite_alocacao)}</td>
                    <td class="center">${status || '-'}</td>
                    <td>${evento.responsavel_nome || '-'}</td>
                    <td class="center">
                        <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                            <button class="ui-btn ui-btn-sm" onclick="Repasse.abrirModalEditarEvento(${evento.id})">Editar</button>
                            ${botoesStatus}
                            <button class="ui-btn ui-btn-sm" style="background:#b42318" onclick="Repasse.abrirModalExcluirEvento(${evento.id})">Cancelar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const rowsCancelados = cancelados.map((evento) => {
            const tooltip = `Motivo: ${evento.delete_reason || 'Não informado'} | Por: ${evento.deleted_by_nome || `ID ${evento.deleted_by_user_id || '-'}`} | Em: ${isoToBr(evento.deleted_at || '')}`;
            return `
              <tr title="${tooltip.replace(/"/g, '&quot;')}">
                <td>${evento.titulo || '-'}</td>
                <td class="center">${isoToBr(evento.data_evento)}</td>
                <td>${evento.deleted_by_nome || '-'}</td>
                <td class="center">${isoToBr(evento.deleted_at || '')}</td>
              </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div class="repasse-card">
                <h3>Eventos do ano (gestão)</h3>
                <div class="repasse-table-wrap">
                    <table class="repasse-table">
                        <thead>
                            <tr>
                                <th>Título</th>
                                <th class="center">Data</th>
                                <th class="center">Limite</th>
                                <th class="center">Status</th>
                                <th>Responsável</th>
                                <th class="center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="6" class="center">Sem eventos ativos.</td></tr>'}</tbody>
                    </table>
                </div>
                <div style="margin-top:12px;">
                  <h4 style="margin:0 0 6px;color:#667085;">Cancelados (somente gestão)</h4>
                  <div class="repasse-table-wrap">
                    <table class="repasse-table">
                      <thead><tr><th>Título</th><th class="center">Data</th><th>Cancelado por</th><th class="center">Cancelado em</th></tr></thead>
                      <tbody>${rowsCancelados || '<tr><td colspan="4" class="center">Sem eventos cancelados.</td></tr>'}</tbody>
                    </table>
                  </div>
                  <div style="font-size:.85rem;color:#607589;margin-top:6px;">Passe o mouse sobre a linha para ver o motivo do cancelamento.</div>
                </div>
            </div>
        `;
    }

    function abrirModalEditarEvento(id) {
        const evento = (eventosGestao || []).find((e) => Number(e.id) === Number(id));
        if (!evento) return;
        const modalId = 'modal-editar-evento';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'ui-modal-overlay';
            modal.style.display = 'none';
            document.body.appendChild(modal);
        }

        const options = responsaveis.map((r) => `<option value="${r.id}" ${Number(r.id) === Number(evento.responsavel_filiado_id) ? 'selected' : ''}>${responsavelLabel(r)}</option>`).join('');

        modal.innerHTML = `
            <div class="ui-modal" style="max-width:560px;">
                <div class="ui-modal-header">
                    <h3>Editar evento</h3>
                    <button class="ui-modal-close" onclick="Repasse.fecharModalEditarEvento()">×</button>
                </div>
                <div class="ui-modal-body">
                    <label>Título</label>
                    <input id="edit-evt-titulo" type="text" value="${evento.titulo || ''}" style="width:100%;margin-bottom:10px;">
                    <label>Data do evento</label>
                    <input id="edit-evt-data-evento" type="text" value="${isoToBr(evento.data_evento)}" style="width:100%;margin-bottom:10px;">
                    <label>Data limite de alocação</label>
                    <input id="edit-evt-data-limite" type="text" value="${isoToBr(evento.data_limite_alocacao)}" style="width:100%;margin-bottom:10px;">
                    <label>Responsável</label>
                    <select id="edit-evt-responsavel" style="width:100%;margin-bottom:10px;"><option value="">Selecione</option>${options}</select>
                    <label>Descrição</label>
                    <textarea id="edit-evt-descricao" rows="3" style="width:100%;">${evento.descricao || ''}</textarea>
                </div>
                <div class="ui-modal-footer">
                    <button class="ui-btn ui-btn-secondary" onclick="Repasse.fecharModalEditarEvento()">Cancelar</button>
                    <button class="ui-btn" onclick="Repasse.salvarEdicaoEvento(${evento.id})">Salvar alterações</button>
                </div>
            </div>
        `;

        bindModalOverlayClose(modal, fecharModalEditarEvento);
        openModal(modal, fecharModalEditarEvento);
        if (window.Utils?.aplicarMascaraData) {
            window.Utils.aplicarMascaraData(document.getElementById('edit-evt-data-evento'));
            window.Utils.aplicarMascaraData(document.getElementById('edit-evt-data-limite'));
        }
    }

    function fecharModalEditarEvento() {
        closeModalById('modal-editar-evento');
    }

    async function salvarEdicaoEvento(id) {
        if (!ehGestao()) { alert('Ação permitida apenas para gestão.'); return; }
        const titulo = document.getElementById('edit-evt-titulo')?.value?.trim();
        const dataEvento = brToIso(document.getElementById('edit-evt-data-evento')?.value?.trim());
        const dataLimite = brToIso(document.getElementById('edit-evt-data-limite')?.value?.trim());
        const responsavelIdRaw = document.getElementById('edit-evt-responsavel')?.value;
        const descricao = document.getElementById('edit-evt-descricao')?.value?.trim() || null;

        if (!titulo || !dataEvento || !dataLimite) {
            alert('Preencha título e datas válidas.');
            return;
        }

        const payload = {
            titulo,
            descricao,
            data_evento: dataEvento,
            data_limite_alocacao: dataLimite,
            responsavel_filiado_id: responsavelIdRaw ? Number(responsavelIdRaw) : null
        };

        const resp = await window.Api.apiFetch(`/api/repasse/eventos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (!resp.ok) {
            alert(data.message || 'Erro ao atualizar evento.');
            return;
        }

        fecharModalEditarEvento();
        await refreshNow({ showLoading: false });
    }

    async function abrirEvento(id) {
        if (!ehGestao()) { alert('Ação permitida apenas para gestão.'); return; }
        const resp = await window.Api.apiFetch(`/api/repasse/eventos/${id}/abrir`, { method: 'POST' });
        const data = await resp.json();
        if (!resp.ok) {
            alert(data.message || 'Erro ao abrir evento.');
            return;
        }
        await refreshNow({ showLoading: false });
    }

    async function encerrarEvento(id) {
        if (!ehGestao()) { alert('Ação permitida apenas para gestão.'); return; }
        const resp = await window.Api.apiFetch(`/api/repasse/eventos/${id}/encerrar`, { method: 'POST' });
        const data = await resp.json();
        if (!resp.ok) {
            alert(data.message || 'Erro ao encerrar evento.');
            return;
        }
        await refreshNow({ showLoading: false });
    }

    function abrirModalExcluirEvento(id) {
        const evento = (eventosGestao || []).find((e) => Number(e.id) === Number(id));
        if (!evento) return;

        const modalId = 'modal-excluir-evento';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'ui-modal-overlay';
            modal.style.display = 'none';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="ui-modal" style="max-width:460px;">
                <div class="ui-modal-header">
                    <h3>Cancelar evento</h3>
                    <button class="ui-modal-close" onclick="Repasse.fecharModalExcluirEvento()">×</button>
                </div>
                <div class="ui-modal-body">
                    <p>Evento: <strong>${evento.titulo}</strong></p>
                    <label>Informe a justificativa do cancelamento</label>
                    <textarea id="delete-evento-justificativa" rows="3" style="width:100%;" oninput="Repasse.validarJustificativaExclusaoEvento()"></textarea>
                </div>
                <div class="ui-modal-footer">
                    <button class="ui-btn ui-btn-secondary" onclick="Repasse.fecharModalExcluirEvento()">Voltar</button>
                    <button id="btn-confirm-excluir-evento" class="ui-btn" style="background:#b42318" disabled onclick="Repasse.confirmarExclusaoEvento(${evento.id})">Cancelar evento</button>
                </div>
            </div>
        `;

        bindModalOverlayClose(modal, fecharModalExcluirEvento);
        openModal(modal, fecharModalExcluirEvento);
    }

    function validarJustificativaExclusaoEvento() {
        const justificativa = document.getElementById('delete-evento-justificativa')?.value?.trim() || '';
        const btn = document.getElementById('btn-confirm-excluir-evento');
        if (btn) btn.disabled = justificativa.length < 5;
    }

    function fecharModalExcluirEvento() {
        closeModalById('modal-excluir-evento');
    }

    async function confirmarExclusaoEvento(id) {
        if (!ehGestao()) { alert('Ação permitida apenas para gestão.'); return; }
        const justificativa = document.getElementById('delete-evento-justificativa')?.value?.trim() || '';
        if (justificativa.length < 5) return;

        const resp = await window.Api.apiFetch(`/api/repasse/eventos/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ justificativa })
        });
        const data = await resp.json();
        if (!resp.ok) {
            alert(data.message || 'Erro ao cancelar evento.');
            return;
        }

        fecharModalExcluirEvento();
        await refreshNow({ showLoading: false });
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
        await refreshNow({ showLoading: false });
    }


    async function retirarMinhaAlocacao() {
        const select = document.getElementById('repasse-evento-select');
        if (!select || !select.value) return;
        const justificativa = (prompt('Informe a justificativa para retirar sua alocação (mínimo 5 caracteres):') || '').trim();
        if (justificativa.length < 5) {
            alert('Justificativa deve ter no mínimo 5 caracteres.');
            return;
        }

        const resp = await window.Api.apiFetch(`/api/repasse/eventos/${select.value}/desalocar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ justificativa })
        });
        const data = await resp.json();
        if (!resp.ok) {
            alert(data.message || 'Falha ao retirar alocação.');
            return;
        }
        alert('Alocação retirada com sucesso.');
        await refreshNow({ showLoading: false });
    }


    async function retirarAlocacaoGestao(eventoId, filiadoId, nome) {
        if (!ehGestao()) { alert('Ação permitida apenas para gestão.'); return; }
        const justificativa = (prompt(`Informe a justificativa para cancelar a alocação de ${nome || 'filiado'} (mínimo 5 caracteres):`) || '').trim();
        if (justificativa.length < 5) {
            alert('Justificativa deve ter no mínimo 5 caracteres.');
            return;
        }

        const resp = await window.Api.apiFetch(`/api/repasse/eventos/${eventoId}/desalocar-gestao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filiado_id: filiadoId, justificativa })
        });
        const data = await resp.json();
        if (!resp.ok) {
            alert(data.message || 'Falha ao cancelar alocação.');
            return;
        }
        alert('Alocação cancelada com sucesso.');
        await refreshNow({ showLoading: false });
    }

    function toggleAlocacoes() {
        alocacoesExpanded = !alocacoesExpanded;
        renderAlocacoes();
    }

    function abrirModalDebito(lotacao) {
        const modalId = 'modal-lancar-debito';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'ui-modal-overlay';
            modal.style.display = 'none';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="ui-modal" style="max-width:400px;">
                <div class="ui-modal-header">
                    <h3>Lançar Débito</h3>
                    <button class="ui-modal-close" onclick="Repasse.fecharModalDebito()">×</button>
                </div>
                <div class="ui-modal-body">
                    <p>Lotação: <strong>${lotacao}</strong></p>
                    <div style="margin-bottom:12px;">
                        <label>Valor (R$)</label>
                        <input type="text" id="debito-valor" inputmode="numeric" style="width:100%;" value="R$ 0,00" oninput="Repasse.handleCurrencyInputChange(this)">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label>Observação</label>
                        <textarea id="debito-obs" rows="3" style="width:100%;" placeholder="Ex: Aquisição de geladeira"></textarea>
                    </div>
                </div>
                <div class="ui-modal-footer">
                    <button class="ui-btn ui-btn-secondary" onclick="Repasse.fecharModalDebito()">Cancelar</button>
                    <button class="ui-btn" onclick="Repasse.salvarDebito('${lotacao}')">Salvar Débito</button>
                </div>
            </div>
        `;
        bindModalOverlayClose(modal, fecharModalDebito);
        setCurrencyInputValue('debito-valor', '0');
        openModal(modal, fecharModalDebito);
    }

    function fecharModalDebito() {
        closeModalById('modal-lancar-debito');
    }

    async function salvarDebito(lotacao) {
        if (!ehGestao()) { alert('Ação permitida apenas para gestão.'); return; }
        const valorCentavos = sanitizeToCentavos(document.getElementById('debito-valor')?.dataset?.centavos || document.getElementById('debito-valor')?.value);
        const valorCentavosNumero = Number(valorCentavos);
        const observacao = document.getElementById('debito-obs')?.value?.trim();

        if (!Number.isFinite(valorCentavosNumero) || valorCentavosNumero <= 0) {
            alert('Informe um valor válido maior que zero.');
            return;
        }
        if (!observacao || observacao.length < 3) {
            alert('Informe uma observação (mínimo 3 caracteres).');
            return;
        }

        const payload = {
            ano_ref: yearCurrent,
            lotacao_id: lotacao,
            valor_centavos: valorCentavosNumero,
            observacao
        };

        const resp = await window.Api.apiFetch('/api/repasse/movimentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const data = await resp.json();
            alert(data.message || 'Erro ao salvar débito.');
            return;
        }

        fecharModalDebito();
        await refreshNow({ showLoading: false });
        if (selectedLotacaoForLista && document.getElementById('modal-lista-debitos')?.classList.contains('active')) {
            await abrirModalListaDebitos(selectedLotacaoForLista, true);
        }
    }


    function renderListaDebitosModal(lotacao, keepOpen = false) {
        const modalId = 'modal-lista-debitos';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'ui-modal-overlay';
            modal.style.display = 'none';
            document.body.appendChild(modal);
        }

        const rows = movimentosListaAtual.map(m => `
            <tr>
                <td>${isoToBr(m.created_at)}</td>
                <td>${formatCentavosBRL(valorBackendToCentavos(m))}</td>
                <td style="font-size:0.85rem;">${window.Utils.escapeHTML(m.observacao)}</td>
                <td class="center">
                    <button class="ui-btn ui-btn-sm" onclick="Repasse.abrirModalEdicaoDebito(${m.id}, '${valorBackendToCentavos(m)}', '${window.Utils.escapeHTML(m.observacao).replace(/'/g, "\\'")}', '${lotacao}')">Editar</button>
                    <button class="ui-btn ui-btn-sm" style="background:#b42318" onclick="Repasse.abrirModalExcluirDebito(${m.id}, '${lotacao}')">Excluir</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="center">Nenhum débito lançado.</td></tr>';

        modal.innerHTML = `
            <div class="ui-modal" style="max-width:700px;">
                <div class="ui-modal-header">
                    <h3>Débitos: ${lotacao} (${yearCurrent})</h3>
                    <button class="ui-modal-close" onclick="Repasse.fecharModalListaDebitos()">×</button>
                </div>
                <div class="ui-modal-body">
                    <div class="repasse-table-wrap">
                        <table class="repasse-table">
                            <thead>
                                <tr><th>Data</th><th>Valor</th><th>Observação</th><th>Ações</th></tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="ui-modal-footer">
                    <button class="ui-btn ui-btn-secondary" onclick="Repasse.fecharModalListaDebitos()">Fechar</button>
                </div>
            </div>
        `;
        bindModalOverlayClose(modal, fecharModalListaDebitos);
        if (!keepOpen) openModal(modal, fecharModalListaDebitos);
    }

    async function abrirModalListaDebitos(lotacao, keepOpen = false) {
        selectedLotacaoForLista = lotacao;
        const resp = await window.Api.apiFetch(`/api/repasse/movimentos?ano=${yearCurrent}&lotacaoId=${encodeURIComponent(lotacao)}`);
        if (!resp.ok) {
            alert('Erro ao carregar lista de débitos.');
            return;
        }
        const data = await resp.json();
        const novaLista = data.movimentos || [];
        const novaAssinatura = assinaturaMovimentos(novaLista);
        if (!keepOpen || novaAssinatura !== lastMovimentosSignature) {
            movimentosListaAtual = novaLista;
            lastMovimentosSignature = novaAssinatura;
        }
        renderListaDebitosModal(lotacao, keepOpen);
    }

    function fecharModalListaDebitos() {
        closeModalById('modal-lista-debitos');
    }

    function abrirModalEdicaoDebito(id, valor, observacao, lotacao) {
        const modalId = 'modal-editar-debito';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'ui-modal-overlay';
            modal.style.display = 'none';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="ui-modal" style="max-width:400px;">
                <div class="ui-modal-header">
                    <h3>Editar Débito</h3>
                    <button class="ui-modal-close" onclick="Repasse.fecharModalEdicaoDebito()">×</button>
                </div>
                <div class="ui-modal-body">
                    <p>Lotação: <strong>${lotacao}</strong></p>
                    <div style="margin-bottom:12px;">
                        <label>Valor (R$)</label>
                        <input type="text" id="edit-debito-valor" inputmode="numeric" style="width:100%;" value="${formatCentavosBRL(valor)}" oninput="Repasse.handleCurrencyInputChange(this)">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label>Observação</label>
                        <textarea id="edit-debito-obs" rows="3" style="width:100%;">${window.Utils.escapeHTML(observacao)}</textarea>
                    </div>
                </div>
                <div class="ui-modal-footer">
                    <button class="ui-btn ui-btn-secondary" onclick="Repasse.fecharModalEdicaoDebito()">Cancelar</button>
                    <button class="ui-btn" onclick="Repasse.atualizarDebito(${id}, '${lotacao}')">Salvar Alterações</button>
                </div>
            </div>
        `;
        bindModalOverlayClose(modal, fecharModalEdicaoDebito);
        setCurrencyInputValue('edit-debito-valor', valor);
        openModal(modal, fecharModalEdicaoDebito);
    }

    function fecharModalEdicaoDebito() {
        closeModalById('modal-editar-debito');
    }

    async function atualizarDebito(id, lotacao) {
        if (!ehGestao()) { alert('Ação permitida apenas para gestão.'); return; }
        const valorCentavos = sanitizeToCentavos(document.getElementById('edit-debito-valor')?.dataset?.centavos || document.getElementById('edit-debito-valor')?.value);
        const valorCentavosNumero = Number(valorCentavos);
        const observacao = document.getElementById('edit-debito-obs')?.value?.trim();

        if (!Number.isFinite(valorCentavosNumero) || valorCentavosNumero <= 0) {
            alert('Informe um valor válido maior que zero.');
            return;
        }
        if (!observacao || observacao.length < 3) {
            alert('Informe uma observação (mínimo 3 caracteres).');
            return;
        }

        const payload = {
            valor_centavos: valorCentavosNumero,
            observacao
        };

        const resp = await window.Api.apiFetch(`/api/repasse/movimentos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const data = await resp.json();
            alert(data.message || 'Erro ao atualizar débito.');
            return;
        }

        fecharModalEdicaoDebito();
        fecharModalListaDebitos();
        await refreshNow({ showLoading: false });
        // Reabre a lista para mostrar a alteração
        await abrirModalListaDebitos(lotacao);
    }

    function abrirModalExcluirDebito(id, lotacao) {
        const modalId = 'modal-excluir-debito';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'ui-modal-overlay';
            modal.style.display = 'none';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="ui-modal" style="max-width:460px;">
                <div class="ui-modal-header">
                    <h3>Excluir lançamento</h3>
                    <button class="ui-modal-close" onclick="Repasse.fecharModalExcluirDebito()">×</button>
                </div>
                <div class="ui-modal-body">
                    <p>Tem certeza que deseja excluir este lançamento?</p>
                    <label>Informe o motivo da exclusão</label>
                    <textarea id="delete-debito-justificativa" rows="3" style="width:100%;" oninput="Repasse.validarJustificativaExclusao()"></textarea>
                </div>
                <div class="ui-modal-footer">
                    <button class="ui-btn ui-btn-secondary" onclick="Repasse.fecharModalExcluirDebito()">Cancelar</button>
                    <button id="btn-confirm-excluir-debito" class="ui-btn" style="background:#b42318" disabled onclick="Repasse.confirmarExclusaoDebito(${id}, '${lotacao}')">Confirmar Exclusão</button>
                </div>
            </div>
        `;

        bindModalOverlayClose(modal, fecharModalExcluirDebito);
        openModal(modal, fecharModalExcluirDebito);
    }

    function validarJustificativaExclusao() {
        const justificativa = document.getElementById('delete-debito-justificativa')?.value?.trim() || '';
        const btn = document.getElementById('btn-confirm-excluir-debito');
        if (btn) btn.disabled = justificativa.length < 5;
    }

    function fecharModalExcluirDebito() {
        closeModalById('modal-excluir-debito');
    }

    async function confirmarExclusaoDebito(id, lotacao) {
        if (!ehGestao()) { alert('Ação permitida apenas para gestão.'); return; }
        const justificativa = document.getElementById('delete-debito-justificativa')?.value?.trim() || '';
        if (justificativa.length < 5) return;

        const resp = await window.Api.apiFetch(`/api/repasse/movimentos/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ justificativa })
        });

        if (!resp.ok) {
            const data = await resp.json();
            alert(data.message || 'Erro ao excluir débito.');
            return;
        }

        fecharModalExcluirDebito();
        movimentosListaAtual = movimentosListaAtual.filter((m) => Number(m.id) !== Number(id));
        renderListaDebitosModal(lotacao, true);
        await refreshNow({ showLoading: false });
        await abrirModalListaDebitos(lotacao, true);
    }

    global.Repasse = {
        inicializarRepasse,
        criarEvento,
        buscarResponsaveis,
        alocarMeuRecurso,
        retirarMinhaAlocacao,
        retirarAlocacaoGestao,
        toggleAlocacoes,
        abrirModalDebito,
        fecharModalDebito,
        salvarDebito,
        abrirModalListaDebitos,
        fecharModalListaDebitos,
        abrirModalEdicaoDebito,
        fecharModalEdicaoDebito,
        atualizarDebito,
        handleCurrencyInputChange,
        abrirModalExcluirDebito,
        fecharModalExcluirDebito,
        validarJustificativaExclusao,
        confirmarExclusaoDebito,
        abrirModalEditarEvento,
        fecharModalEditarEvento,
        salvarEdicaoEvento,
        abrirEvento,
        encerrarEvento,
        abrirModalExcluirEvento,
        fecharModalExcluirEvento,
        validarJustificativaExclusaoEvento,
        confirmarExclusaoEvento
    };
})(window);
