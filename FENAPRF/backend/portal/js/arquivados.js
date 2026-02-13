/**
 * Módulo Arquivados (Página Inicial)
 * Espelhamento 1:1 com o App
 */

(function (global) {
    if (global.Arquivados) return;

    let usersCache = [];
    let historyCache = [];
    let activeTab = 'LIST'; // 'LIST' ou 'HISTORY'

    async function inicializarArquivados(perfil) {
        const secArq = document.getElementById('sec-arquivados');
        if (!secArq) return;

        // Reset UI
        secArq.innerHTML = `
            <div class="section-card">
                <div class="af-standard-header">
                    <h2>📁 Membros Arquivados</h2>
                    <p>Gestão de membros inativos e histórico de movimentações.</p>
                </div>

                <div class="tabs-container" style="display:flex; border-bottom:1px solid #eee; margin-bottom:20px;">
                    <button class="tab-btn active" data-tab="LIST" style="flex:1; padding:15px; border:none; background:none; cursor:pointer; font-weight:bold; border-bottom:3px solid var(--azul-header); color:var(--azul-header);">Membros Arquivados</button>
                    <button class="tab-btn" data-tab="HISTORY" style="flex:1; padding:15px; border:none; background:none; cursor:pointer; font-weight:bold; color:#666;">Histórico</button>
                </div>

                <div id="arquivados-content">
                    <p style="text-align:center; padding:40px;">Carregando...</p>
                </div>
            </div>
        `;

        const tabs = secArq.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                tabs.forEach(t => {
                    t.classList.toggle('active', t === btn);
                    t.style.borderBottom = (t === btn) ? '3px solid var(--azul-header)' : 'none';
                    t.style.color = (t === btn) ? 'var(--azul-header)' : '#666';
                });
                renderizarAba();
            });
        });

        renderizarAba();
    }

    async function renderizarAba() {
        const content = document.getElementById('arquivados-content');
        content.innerHTML = `<p style="text-align:center; padding:40px;">🔄 Carregando ${activeTab === 'LIST' ? 'lista' : 'histórico'}...</p>`;

        if (activeTab === 'LIST') {
            await carregarLista(content);
        } else {
            await carregarHistorico(content);
        }
    }

    async function carregarLista(container) {
        try {
            const r = await window.Api.apiFetch('/api/users?apenasArquivados=1');

            if (r.ok || r.status === 304) {
                if (r.status !== 304) {
                    const json = await r.json();
                    usersCache = json.users || json || [];
                }
            } else {
                throw new Error(`API Error: ${r.status}`);
            }

            // Ordenação Canônica FENAPRF
            if (global.Canon?.ordenarMembrosTodos) {
                usersCache = global.Canon.ordenarMembrosTodos(usersCache);
            }

            container.innerHTML = `
                <div class="search-box" style="margin-bottom:20px;">
                    <input type="text" id="input-busca-arquivados" placeholder="Buscar por nome ou CPF..." style="width:100%; padding:12px; border-radius:8px; border:1px solid #ddd;">
                </div>
                <div id="lista-arquivados-grid" class="users-grid"></div>
            `;

            const input = document.getElementById('input-busca-arquivados');
            input.addEventListener('input', () => filtrarLista(input.value));

            filtrarLista('');
        } catch (e) {
            container.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar arquivados.</p>`;
        }
    }

    function filtrarLista(term) {
        const grid = document.getElementById('lista-arquivados-grid');
        if (!grid) return;

        const normalizedTerm = global.Utils?.normalizeText(term) || term.toLowerCase();
        const filtered = usersCache.filter(u => {
            const nome = global.Utils?.normalizeText(u.name || u.nome || "");
            const cpf = (u.cpf || "").replace(/\D/g, "");
            return nome.includes(normalizedTerm) || cpf.includes(term.replace(/\D/g, ""));
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#999; padding:40px;">Nenhum membro encontrado.</p>`;
            return;
        }

        grid.innerHTML = filtered.map(u => {
            const cargoUf = global.UsersAdmin?.formatarCargoUf ? global.UsersAdmin.formatarCargoUf(u) : `${u.cargo || ''} - ${u.uf || ''}`;
            return `
                <div class="user-card-v3" style="border-left: 5px solid #c53030; cursor:pointer;" onclick="window.Arquivados.verDetalhes('${u.id}')">
                    <div class="user-avatar-wrapper">
                         <img src="/api/users/${u.id}/avatar" class="avatar-mini" onerror="this.src='/img/avatar-placeholder.png'">
                    </div>
                    <div class="user-info">
                        <h3 class="user-name">${u.name || u.nome}</h3>
                        <p class="user-meta">${cargoUf}</p>
                        <p class="user-meta" style="color:#c53030; font-weight:bold;">Arquivado</p>
                    </div>
                    <div class="user-action">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function carregarHistorico(container) {
        try {
            const r = await window.Api.apiFetch('/api/users/arquivados/historico');

            if (r.ok || r.status === 304) {
                if (r.status !== 304) {
                    historyCache = await r.json();
                }
            } else {
                throw new Error(`API Error: ${r.status}`);
            }

            container.innerHTML = `
                <div class="search-box" style="margin-bottom:20px;">
                    <input type="text" id="input-busca-historico" placeholder="Buscar no histórico (nome ou CPF)..." style="width:100%; padding:12px; border-radius:8px; border:1px solid #ddd;">
                </div>
                <div id="lista-historico-items" style="display:flex; flex-direction:column; gap:15px;"></div>
            `;

            const input = document.getElementById('input-busca-historico');
            input.addEventListener('input', () => filtrarHistorico(input.value));

            filtrarHistorico('');
        } catch (e) {
            container.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar histórico.</p>`;
        }
    }

    function filtrarHistorico(term) {
        const list = document.getElementById('lista-historico-items');
        if (!list) return;

        const normalizedTerm = global.Utils?.normalizeText(term) || term.toLowerCase();
        const filtered = historyCache.filter(h => {
            const nome = global.Utils?.normalizeText(h.user_nome || "");
            const cpf = (h.user_cpf || "").replace(/\D/g, "");
            return nome.includes(normalizedTerm) || cpf.includes(term.replace(/\D/g, ""));
        });

        if (filtered.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:#999; padding:40px;">Nenhuma movimentação encontrada.</p>`;
            return;
        }

        list.innerHTML = filtered.map(item => {
            const dataFmt = global.Formatters?.formatISOToBR(item.criado_em) || item.criado_em;
            const isArquivado = item.acao === 'ARQUIVADO';
            const badgeColor = isArquivado ? '#fff5f5' : '#f0fff4';
            const textColor = isArquivado ? '#c53030' : '#2f855a';

            return `
                <div class="history-card" style="padding:15px; background:#fff; border-radius:10px; border:1px solid #eee;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <div>
                            <strong style="color:var(--azul-header); font-size:1.1rem;">${item.user_nome}</strong>
                            <div style="font-size:0.85rem; color:#888;">CPF: ${global.Formatters?.formatCpf(item.user_cpf) || item.user_cpf}</div>
                        </div>
                        <span style="background:${badgeColor}; color:${textColor}; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold;">${item.acao}</span>
                    </div>
                    <div style="font-size:0.9rem; color:#555; border-top:1px solid #f9f9f9; pt:10px;">
                        <p><strong>Por:</strong> ${item.por_nome}</p>
                        <p><strong>Data:</strong> ${dataFmt}</p>
                        ${item.motivo ? `<p><strong>Motivo:</strong> ${item.motivo}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    async function verDetalhes(id) {
        const user = usersCache.find(u => u.id === id);
        if (!user) return;

        const cpf = global.Formatters?.formatCpf(user.cpf) || user.cpf;
        const cargoUf = global.UsersAdmin?.formatarCargoUf ? global.UsersAdmin.formatarCargoUf(user) : `${user.cargo || ''} - ${user.uf || ''}`;
        const dataArq = global.Formatters?.formatISOToBR(user.arquivado_em) || user.arquivado_em;

        const html = `
            <div style="display:flex; flex-direction:column; gap:20px;">
                <div class="user-card-v3" style="border-left:5px solid #c53030;">
                    <div class="user-avatar-wrapper">
                         <img src="/api/users/${user.id}/avatar" class="avatar-mini" onerror="this.src='/img/avatar-placeholder.png'">
                    </div>
                    <div class="user-info">
                        <h3 class="user-name">${user.name || user.nome}</h3>
                        <p class="user-meta">${cargoUf}</p>
                    </div>
                </div>

                <div style="background:#fff; padding:15px; border-radius:10px; border:1px solid #eee; display:flex; flex-direction:column; gap:8px;">
                    <p><strong>Email:</strong> ${user.email || user.email1 || '—'}</p>
                    <p><strong>Telefone:</strong> ${user.telefone1 ? (global.Formatters?.formatTelefone ? global.Formatters.formatTelefone(user.telefone1) : user.telefone1) : '—'}</p>
                    <p><strong>CPF:</strong> ${cpf}</p>
                </div>

                <div style="background:#fff5f5; padding:15px; border-radius:10px; border:1px solid #feb2b2;">
                    <h4 style="color:#c53030; margin-bottom:10px;">📜 Dados do Arquivamento</h4>
                    <p style="font-size:0.9rem;"><strong>Arquivado Por:</strong> ${user.arquivado_por_nome || '(usuário não encontrado)'}</p>
                    <p style="font-size:0.9rem;"><strong>Em:</strong> ${dataArq}</p>
                    <p style="font-size:0.9rem;"><strong>Motivo:</strong> ${user.arquivado_motivo || 'Não informado'}</p>
                </div>

                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="window.Arquivados.irParaEdicao('${user.id}')">
                        <i class="fas fa-pencil-alt"></i> Gerenciar Cadastro
                    </button>
                    <button class="btn btn-outline" style="flex:1;" onclick="global.Utils.fecharModalGenerico()">Fechar</button>
                </div>
            </div>
        `;

        global.Utils?.abrirModalGenerico("Detalhes do Membro Arquivado", html);
    }

    function irParaEdicao(id) {
        global.Utils?.fecharModalGenerico();
        if (global.UsersAdmin?.abrirModalEdicao) {
            global.UsersAdmin.abrirModalEdicao(id);
        }
    }

    global.Arquivados = {
        inicializarArquivados,
        verDetalhes,
        irParaEdicao
    };

})(typeof window !== 'undefined' ? window : global);
