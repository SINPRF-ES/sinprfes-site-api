/**
 * Módulo Users Admin (Página Inicial)
 * Carregado como script clássico (window.UsersAdmin)
 */

(function (global) {
    if (global.UsersAdmin) return;

    let cacheLista = [];
    const SITUACAO_OPCOES = [];


    let perfilAtual = null;
    let handlersConfigurados = false;

    function toDateInputValue(v) {
        if (global.Formatters) return global.Formatters.toDateInputValue(v);
        if (!v) return "";
        const s = String(v).trim();
        const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`;
        const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
        return "";
    }

    function getFlagUrl(uf, perfil) {
        const p = (perfil || "").toUpperCase();
        let sigla = (uf || "").trim().toLowerCase();
        if (["ADMIN", "DIRETORIA", "COLABORADOR"].includes(p)) sigla = "br";
        if (!sigla) return "";
        if (sigla === "br") return "https://flagcdn.com/w160/br.png";
        return `https://atlasescolar.ibge.gov.br/images/bandeiras/ufs/${sigla}.png`;
    }

    function avatarHtml(avatarUrl, nome) {
        const { escapeHTML } = global.Utils || {};
        const safeNome = (nome || "").toString();
        const apiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? "http://localhost:3000"
            : "https://fenaprf-sistema.onrender.com";

        const src = avatarUrl
            ? (avatarUrl.startsWith('http') ? avatarUrl : apiBase + avatarUrl)
            : "/img/avatar-placeholder.png";

        const escapedNome = escapeHTML ? escapeHTML(safeNome) : safeNome;

        return `<img class="avatar-mini" src="${src}" alt="Avatar ${escapedNome}">`;
    }

    function formatISOToBRDateTime(isoStr) {
        if (!isoStr) return "—";
        try {
            const date = new Date(isoStr);
            if (isNaN(date.getTime())) return "—";

            const dia = date.getDate().toString().padStart(2, '0');
            const mes = (date.getMonth() + 1).toString().padStart(2, '0');
            const ano = date.getFullYear();
            const hora = date.getHours().toString().padStart(2, '0');
            const min = date.getMinutes().toString().padStart(2, '0');

            return `${dia}/${mes}/${ano} ${hora}:${min}`;
        } catch (e) {
            return "—";
        }
    }

    async function inicializarUsers(perfil) {
        const listaEl = document.getElementById("lista-users");
        perfilAtual = (perfil || "").toUpperCase();
        const isReadOnlyProfile = ["CONSELHEIRO"].includes(perfilAtual);
        const ehGestao = ["ADMIN", "DIRETORIA", "COLABORADOR"].includes(perfilAtual);

        if (!listaEl) {
            const secUsers = document.getElementById("sec-users");
            if (secUsers) {
                const placeholder = isReadOnlyProfile ? "Buscar por nome..." : "Buscar por nome ou CPF...";
                secUsers.innerHTML = `
                    <div class="search-box-container af-standard-header header-gestao-membros">
                        <div class="header-membros-top">
                            <img src="/img/logo-fenaprf.png" class="logo-header-membros">
                            <h2>👥 Membros</h2>
                        </div>

                        <div class="header-membros-controls">
                            <div class="control-group search-group">
                                <label>🔍 Buscar Membro</label>
                                <input type="text" id="busca-users" placeholder="${placeholder}">
                            </div>

                            <div class="control-group actions-group">
                                <button id="btn-novo-user" class="btn btn-primary btn-lg" style="display:none;">+ Novo Membro</button>
                                <div id="users-count">Total: 0</div>
                            </div>

                            <div id="container-filtro-header" class="control-group filter-group-header">
                                <!-- Filtros inseridos via JS -->
                            </div>
                        </div>
                    </div>
                    <div id="novo-user-container" style="display:none; margin-bottom:20px;"></div>
                    <div id="lista-users"></div>
                `;
            }
        }

        const canManageProfiles = ehGestao;

        if (!handlersConfigurados) {
            const listEl = document.getElementById("lista-users");
            if (listEl) {
                listEl.addEventListener("click", (e) => {
                    const btn = e.target.closest(".btn-editar-user");
                    if (btn) {
                        const id = btn.dataset.id;
                        abrirModalEdicao(id);
                    }
                });
            }

            const btnNovo = document.getElementById("btn-novo-user");
            const containerNovo = document.getElementById("novo-user-container");

            if (btnNovo) {
                if (ehGestao) {
                    btnNovo.style.display = "inline-block";
                    btnNovo.addEventListener("click", () => abrirNovoUser(containerNovo));
                    renderizarFormularioNovoUser(containerNovo);
                }
            }

            const campoBusca = document.getElementById("busca-users");
            const containerFiltro = document.getElementById("container-filtro-header");

            if (campoBusca) {
                campoBusca.addEventListener("input", (e) => filtrarLista(e.target.value));

                const ehGestao = ["ADMIN", "DIRETORIA", "COLABORADOR"].includes(perfilAtual);

                if (containerFiltro) {
                    containerFiltro.innerHTML = `
                        ${ehGestao ? `
                        <label>📂 Visualização</label>
                        <div style="display:flex; gap:10px; width:100%;">
                            <select id="filtro-visualizacao-membros" class="select-lg-portal" style="flex:1;">
                                ${global.Canon.FILTROS_MEMBROS.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
                            </select>
                            <select id="filtro-uf-membros" class="select-lg-portal" style="display:none; width:100px;">
                                <option value="">Todas</option>
                                ${global.Canon.UFS.map(uf => `<option value="${uf}">${uf}</option>`).join('')}
                            </select>
                        </div>
                        ` : '<input type="hidden" id="filtro-visualizacao-membros" value="PADRAO">'}
                    `;
                }

                if (ehGestao) {
                    const selVis = document.getElementById("filtro-visualizacao-membros");
                    const selUf = document.getElementById("filtro-uf-membros");

                    selVis.addEventListener("change", () => {
                        if (selVis.value === "UF") {
                            selUf.style.display = "block";
                        } else {
                            selUf.style.display = "none";
                            selUf.value = "";
                        }
                        filtrarLista(campoBusca.value);
                    });
                    selUf.addEventListener("change", () => filtrarLista(campoBusca.value));
                }
            }
            handlersConfigurados = true;
        }

        await carregarLista();
    }

    async function carregarLista() {
        const listaEl = document.getElementById("lista-users");
        if (!listaEl) return;

        try {
            listaEl.innerHTML = `<p style="text-align:center; color:#fff;">Carregando...</p>`;
            // Sempre busca com incluirArquivados=1 para paridade com o app que filtra localmente por padrão
            let url = "/api/users?incluirArquivados=1";

            const r = await window.Api.apiFetch(url);
            if (r.ok) {
                const d = await r.json();
                cacheLista = d.users || d || [];
                filtrarLista(document.getElementById("busca-users")?.value || "");
            }
        } catch (e) {
            listaEl.innerHTML = `<p style="text-align:center; color:red;">Erro ao carregar.</p>`;
        }
    }

    function filtrarLista(termo) {
        const el = document.getElementById("lista-users");
        if (!el) return;

        const { filterUsers, formatarTelefoneTexto, normalizeText, escapeHTML } = global.Utils || {};
        const safeEscape = (v) => escapeHTML ? escapeHTML(v) : (v || "");

        // Reutiliza a lógica unificada de busca (nome/CPF)
        let res = filterUsers ? filterUsers(cacheLista, termo, { perfil: perfilAtual }) : cacheLista;

        const fVisualizacao = document.getElementById("filtro-visualizacao-membros")?.value || "PADRAO";
        const fUf = document.getElementById("filtro-uf-membros")?.value || "";

        res = res.filter(f => {
            if (!f) return false;

            // 0. Ocultar arquivados por padrão (exceto se houvesse um filtro específico, mas seguimos paridade app)
            if (f.arquivado_em) return false;

            const perfil = (f.perfil_acesso || "").toUpperCase();
            const cargo = (f.cargo || "").trim();
            const uf = (f.uf || "").toUpperCase();
            const isInternal = perfil === "ADMIN" || perfil === "COLABORADOR";

            switch (fVisualizacao) {
                case "PADRAO":
                    if (isInternal) return false;
                    break;
                case "DIRETORIA":
                    if (perfil !== "DIRETORIA") return false;
                    break;
                case "PRESIDENTES":
                    if (cargo !== "Presidente") return false;
                    break;
                case "VICES":
                    if (cargo !== "Vice-Presidente") return false;
                    break;
                case "DR":
                    if (cargo !== "Delegado Representante") return false;
                    break;
                case "DS":
                    if (cargo !== "Delegado Substituto") return false;
                    break;
                case "UF":
                    if (fUf && uf !== fUf) return false;
                    if (perfil !== "CONSELHEIRO") return false;
                    break;
                case "ADMIN_COLAB":
                    if (!isInternal) return false;
                    break;
            }
            return true;
        });

        const countEl = document.getElementById("users-count");
        if (countEl) countEl.textContent = `Total: ${res.length}`;

        if (!res.length) {
            el.innerHTML = `<div class="user-card" style="text-align:center;">Nenhum registro.</div>`;
            return;
        }

        el.innerHTML = res.map(f => {
            const classeStatus = `status-ativo`;
            const nascimento = f.data_nascimento;
            const idade = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(nascimento) : '—';
            const flagUrl = getFlagUrl(f.uf, f.perfil_acesso);
            const isNacional = ["ADMIN", "DIRETORIA", "COLABORADOR"].includes((f.perfil_acesso || "").toUpperCase());
            const displayUf = isNacional ? "BR" : (f.uf || "—");

            const tels = [f.telefone1, f.telefone2].filter(Boolean).map(t => formatarTelefoneTexto ? formatarTelefoneTexto(t) : t).join(" / ");

            return `
                <div class="user-card-v2 ${classeStatus}">
                    <div class="card-v2-main">
                        <div class="card-v2-avatar-col">
                            ${avatarHtml(f.avatar_url, f.nome)}
                        </div>

                        <div class="card-v2-info-col">
                            <div class="card-v2-nome">${safeEscape(f.nome)}</div>
                            <div class="card-v2-meta">
                                <span>🆔 ${f.cpf ? safeEscape(window.Formatters.formatCpf(f.cpf)) : '—'}</span>
                                ${["CONSELHEIRO"].includes(perfilAtual) ? '' : `
                                <span>🎂 ${nascimento ? global.Formatters.formatISOToBR(nascimento) : '—'} (${idade})</span>
                                `}
                            </div>
                            ${f.cargo ? `<div class="card-v2-cargo">💼 ${safeEscape(f.cargo)}</div>` : ''}
                        </div>

                        <div class="card-v2-mandato-col">
                            ${f.cargo_mandato_inicio || f.cargo_mandato_fim ? `
                                <div class="mandato-label">🗓️ Mandato</div>
                                <div class="mandato-periodo">${global.Formatters.formatISOToBR(f.cargo_mandato_inicio) || '—'} a ${global.Formatters.formatISOToBR(f.cargo_mandato_fim) || '—'}</div>
                                <div class="mandato-stats">
                                    <div class="stat-item decorrido">⏱️ ${global.AgeUtils?.formatAgeDetailed(f.cargo_mandato_inicio) || '—'}</div>
                                    <div class="stat-item restante">⏳ ${global.AgeUtils?.formatRemainingTime(f.cargo_mandato_fim) || '—'}</div>
                                </div>
                            ` : '<div style="color:#ccc; font-style:italic;">Sem dados de mandato</div>'}
                        </div>

                        <div class="card-v2-uf-col">
                            <div class="uf-badge">
                                <span class="uf-sigla">${displayUf}</span>
                                ${flagUrl ? `<img src="${flagUrl}" class="uf-flag-img">` : '🏳️'}
                            </div>
                        </div>

                        <div class="card-v2-actions-col">
                            <div class="card-v2-contato">${safeEscape(tels) || '-'}</div>
                            <div class="card-v2-email">${safeEscape(f.email || f.email1) || '-'}</div>
                            ${!["CONSELHEIRO"].includes(perfilAtual) ?
                                `<button class="btn btn-primary btn-sm btn-editar-user" data-id="${f.id}">✏️ Editar</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function abrirModalEdicao(id) {
        const user = cacheLista.find(f => f.id == id);
        if (!user) return;

        const modal = document.getElementById("modal-editar-user");
        const corpo = document.getElementById("modal-corpo");
        if (!modal || !corpo) return;

        corpo.innerHTML = gerarHtmlForm(user);
        modal.style.display = "flex";

        const p1 = document.getElementById("edit-perfil-acesso");
        const c1 = document.getElementById("edit-cargo");
        const v1 = document.getElementById("val-edit-cargo")?.value;
        if (p1 && c1) atualizarOpcoesCargo(c1, p1.value, v1);

        const p2 = document.getElementById("edit-perfil-acesso2");
        const c2 = document.getElementById("edit-cargo2");
        const v2 = document.getElementById("val-edit-cargo2")?.value;
        if (p2 && c2) atualizarOpcoesCargo(c2, p2.value, v2);

        configurarFormEdicao(id);
    }

    function gerarHtmlForm(f) {
        const { toDateInputValue } = global.Formatters || {};
        const { escapeHTML } = global.Utils || {};
        const safeEscape = (v) => escapeHTML ? escapeHTML(v) : (v || "");

        const ehAdmin = perfilAtual === "ADMIN";
        const ehGestao = ["ADMIN", "DIRETORIA", "COLABORADOR"].includes(perfilAtual);
        const isArquivado = !!f.arquivado_em;
        const nascimento = f.data_nascimento;
        const idade = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(nascimento) : '—';

        const logradouro_bairro = f.logradouro ? `${f.logradouro}${f.bairro ? ', ' + f.bairro : ''}` : (f.logradouro_bairro || '');

        const userInfo = window.Utils && window.Utils.obterUserInfo ? window.Utils.obterUserInfo() : null;
        const isSelf = userInfo && String(f.id) === String(userInfo.id);
        const canChangeProfile = (ehAdmin || (["DIRETORIA", "COLABORADOR"].includes(perfilAtual) && f.perfil_acesso !== "ADMIN")) && !isSelf;

        const responsavel = safeEscape(f.arquivado_por_nome || (f.arquivado_por ? `ID ${f.arquivado_por}` : "—"));

        const perfil = (f.perfil_acesso || "").toUpperCase();
        const isConselheiro = perfil === "CONSELHEIRO";
        const isDiretoria = perfil === "DIRETORIA";
        const showMandato = isConselheiro || isDiretoria;

        return `
            <div id="alertas-modal"></div>

            <!-- Barra de Status do User -->
            <div class="status-bar-modal">
                <span>Estado: <strong>${isArquivado ? "ARQUIVADO" : "ATIVO"}</strong></span>
                <div>
                    ${isArquivado ?
                        `<button type="button" class="btn btn-outline btn-sm btn-desarquivar-user" data-id="${f.id}">📤 Desarquivar</button>` :
                        `<button type="button" class="btn btn-outline btn-sm btn-arquivar-user" data-id="${f.id}">📥 Arquivar</button>`}
                </div>
            </div>

            ${isArquivado ? `
                <div class="archive-details">
                    <div class="archive-details-title">📋 Detalhes do arquivamento</div>
                    <div class="archive-details-grid">
                        <div class="archive-item"><strong>Arquivado por:</strong> <span>${responsavel}</span></div>
                        <div class="archive-item"><strong>Arquivado em:</strong> <span>${formatISOToBRDateTime(f.arquivado_em)}</span></div>
                        <div class="archive-item full-width"><strong>Motivo:</strong> <span>${safeEscape(f.arquivado_motivo || "—")}</span></div>
                    </div>
                </div>
            ` : ''}

            <form id="form-edicao-modal">
                <div class="data-card">
                    <h3>👤 Informações Pessoais</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Nome</label>
                            <input name="nome" value="${safeEscape(f.nome)}" required>
                        </div>
                        <div class="field-group">
                            <label>Sexo</label>
                            <select name="sexo" ${ehGestao ? "" : "disabled"}>
                                <option value="" ${!f.sexo ? "selected" : ""}>-</option>
                                <option value="M" ${f.sexo === "M" ? "selected" : ""}>♂️ Masculino</option>
                                <option value="F" ${f.sexo === "F" ? "selected" : ""}>♀️ Feminino</option>
                            </select>
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>CPF</label>
                            <input name="cpf" value="${safeEscape(window.Formatters.formatCpf(f.cpf))}" ${ehGestao ? "" : "readonly"}>
                        </div>
                        <div class="field-group"></div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Data Nascimento</label>
                            <input type="text" name="data_nascimento" id="edit-data-nascimento" class="campo-data" value="${global.Formatters?.formatISOToBR(f.data_nascimento) || ""}" placeholder="DD/MM/AAAA">
                        </div>
                        <div class="field-group">
                            <label>Idade (Calculada)</label>
                            <input type="text" id="edit-idade-display" value="${idade}" readonly style="background:#f8f9fa;">
                        </div>
                    </div>
                </div>

                <div class="data-card bg-alt">
                    <h3>⛓️ Vínculo e Mandato</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Perfil de Acesso</label>
                            ${canChangeProfile ? `
                                <select name="perfil_acesso" id="edit-perfil-acesso">
                                    <option value="CONSELHEIRO" ${f.perfil_acesso === "CONSELHEIRO" ? "selected" : ""}>CONSELHEIRO</option>
                                    <option value="COLABORADOR" ${f.perfil_acesso === "COLABORADOR" ? "selected" : ""}>COLABORADOR</option>
                                    <option value="DIRETORIA" ${f.perfil_acesso === "DIRETORIA" ? "selected" : ""}>DIRETORIA</option>
                                    ${ehAdmin ? `<option value="ADMIN" ${f.perfil_acesso === "ADMIN" ? "selected" : ""}>ADMIN</option>` : ""}
                                </select>
                            ` : `
                                <input type="text" value="${perfil}" readonly style="background:#f8f9fa;">
                                <input type="hidden" name="perfil_acesso" id="edit-perfil-acesso" value="${f.perfil_acesso}">
                            `}
                        </div>
                        <div class="field-group" id="group-edit-cargo" style="display: ${isConselheiro || isDiretoria ? 'flex' : 'none'};">
                            <label>Cargo</label>
                            <select name="cargo" id="edit-cargo">
                                <option value="">Sem cargo</option>
                                <!-- Preenchido via JS -->
                            </select>
                            <input type="hidden" id="val-edit-cargo" value="${safeEscape(f.cargo)}">
                        </div>
                    </div>

                    <div class="field-row" id="row-edit-uf-mandato" style="display: ${showMandato ? 'grid' : 'none'};">
                        <div class="field-group" id="group-edit-uf">
                            <label>UF de Atuação</label>
                            <select name="uf" id="edit-uf-atuacao">
                                <option value="BR">Brasil (Nacional)</option>
                                ${global.Canon.UFS.map(uf => `<option value="${uf}" ${f.uf === uf ? 'selected' : ''}>${uf}</option>`).join('')}
                            </select>
                        </div>
                        <div class="field-group">
                            <label>Mandato (Início / Fim)</label>
                            <div style="display:flex; gap:5px;">
                                <input type="text" name="cargo_mandato_inicio" class="campo-data" value="${global.Formatters?.formatISOToBR(f.cargo_mandato_inicio) || ""}" placeholder="Início" style="flex:1;">
                                <input type="text" name="cargo_mandato_fim" class="campo-data" value="${global.Formatters?.formatISOToBR(f.cargo_mandato_fim) || ""}" placeholder="Fim" style="flex:1;">
                            </div>
                        </div>
                    </div>

                    <!-- Segundo Vínculo -->
                    <div id="section-segundo-vinculo" style="margin-top:20px; padding-top:20px; border-top:1px solid #eee; display: ${isConselheiro || isDiretoria ? 'block' : 'none'};">
                        <h4 style="margin-bottom:15px; color: var(--azul-fundo);">⛓️ Segundo Vínculo (Opcional)</h4>
                        <div class="field-row">
                            <div class="field-group">
                                <label>Perfil de Acesso (2º)</label>
                                <select name="perfil_acesso2" id="edit-perfil-acesso2">
                                    <option value="">Nenhum</option>
                                    <option value="CONSELHEIRO" ${f.perfil_acesso2 === "CONSELHEIRO" ? "selected" : ""}>CONSELHEIRO</option>
                                    <option value="DIRETORIA" ${f.perfil_acesso2 === "DIRETORIA" ? "selected" : ""}>DIRETORIA</option>
                                </select>
                            </div>
                            <div class="field-group" id="group-edit-cargo2" style="display: ${f.perfil_acesso2 ? 'flex' : 'none'};">
                                <label>Cargo (2º)</label>
                                <select name="cargo2" id="edit-cargo2">
                                    <option value="">Sem cargo</option>
                                    <!-- Preenchido via JS -->
                                </select>
                                <input type="hidden" id="val-edit-cargo2" value="${safeEscape(f.cargo2)}">
                            </div>
                        </div>
                        <div class="field-row" id="row-edit-uf2" style="display: ${f.perfil_acesso2 ? 'grid' : 'none'};">
                            <div class="field-group">
                                <label>UF (2º)</label>
                                <select name="uf2" id="edit-uf2">
                                    <option value="BR">Brasil (Nacional)</option>
                                    ${global.Canon.UFS.map(uf => `<option value="${uf}" ${f.uf2 === uf ? 'selected' : ''}>${uf}</option>`).join('')}
                                </select>
                            </div>
                            <div class="field-group"></div>
                        </div>
                    </div>
                </div>

                <div class="data-card bg-alt">
                    <h3>📞 Contato</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Telefone 1</label>
                            <input name="telefone1" class="campo-telefone" value="${safeEscape(global.Utils.formatarTelefoneTexto(f.telefone1))}" placeholder="(00) 00000-0000">
                        </div>
                        <div class="field-group">
                            <label>Telefone 2</label>
                            <input name="telefone2" class="campo-telefone" value="${safeEscape(global.Utils.formatarTelefoneTexto(f.telefone2))}" placeholder="Opcional">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Email</label>
                            <input name="email" value="${safeEscape(f.email || f.email1)}" placeholder="seu@email.com">
                        </div>
                        <div class="field-group"></div>
                    </div>
                </div>

                <div class="data-card">
                    <h3>🏠 Endereço</h3>
                    <div class="address-grid-v2">
                        <!-- Linha 1: CEP + Logradouro -->
                        <div class="edit-group cep-group">
                            <label>CEP</label>
                            <div class="cep-input-wrapper">
                                <input name="cep" id="edit-cep" value="${safeEscape(global.Utils.formatarCEP(f.cep))}" class="campo-cep">
                                <span class="cep-search-icon">🔍</span>
                            </div>
                        </div>
                        <div class="edit-group logradouro-group">
                            <label>Logradouro / Bairro</label>
                            <input name="logradouro_bairro" id="edit-logradouro" value="${safeEscape(logradouro_bairro)}"
                                   data-logradouro="${safeEscape(f.logradouro)}" data-bairro="${safeEscape(f.bairro)}"
                                   readonly style="background:#f8f9fa;">
                        </div>

                        <!-- Linha 2: Número + Complemento -->
                        <div class="edit-group">
                            <label>Número</label>
                            <input name="numero" value="${safeEscape(f.numero)}">
                        </div>
                        <div class="edit-group">
                            <label>Complemento</label>
                            <input name="complemento" value="${safeEscape(f.complemento)}">
                        </div>

                        <!-- Linha 3: Cidade + UF -->
                        <div class="edit-group">
                            <label>Cidade</label>
                            <input name="cidade" id="edit-cidade" value="${safeEscape(f.cidade)}" readonly style="background:#f8f9fa;">
                        </div>
                        <div class="edit-group">
                            <label>UF</label>
                            <input name="uf_endereco" id="edit-uf" value="${safeEscape(f.uf_endereco)}" readonly style="background:#f8f9fa;">
                        </div>
                    </div>
                </div>

                <div class="data-card">
                    <h3>🖼️ Avatar (Foto)</h3>
                    <div class="subcard flex-center" style="gap: 20px; flex-wrap: wrap;">
                        <img id="modal-avatar-preview" class="avatar-preview" src="${f.avatar_url || '/img/avatar-placeholder.png'}" alt="Preview" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid #ffc107;">
                        <div class="avatar-actions" style="flex:1; min-width:200px; display:flex; flex-direction:column; gap:10px;">
                            <input type="file" id="modal-avatar-input" accept="image/*">
                            <div style="display:flex; gap:10px;">
                                <button type="button" class="btn btn-primary btn-sm" id="btn-upload-avatar-modal" data-id="${f.id}" style="flex:1;">Upload</button>
                                <button type="button" class="btn btn-danger-outline btn-sm" id="btn-remover-avatar-modal" data-id="${f.id}" style="flex:1;">Remover</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer-actions">
                    <button type="button" class="btn btn-outline btn-lg" data-close="modal-editar-user">Cancelar</button>
                    <button type="submit" class="btn btn-primary btn-lg">Salvar Alterações</button>
                </div>
            </form>
        `;
    }

    function atualizarOpcoesCargo(selectEl, perfil, valorAtual = "") {
        if (!selectEl) return;
        const cargos = (perfil === "CONSELHEIRO") ? global.Canon.CARGOS_CONSELHO :
                      (perfil === "DIRETORIA") ? global.Canon.CARGOS_DIRETORIA : [];

        selectEl.innerHTML = '<option value="">Sem cargo</option>' +
            cargos.map(c => `<option value="${c}" ${c === valorAtual ? 'selected' : ''}>${c}</option>`).join('');
    }

    function configurarFormEdicao(id) {
        const form = document.getElementById("form-edicao-modal");

        // Dynamic UI logic
        const p1 = document.getElementById("edit-perfil-acesso");
        const p2 = document.getElementById("edit-perfil-acesso2");
        const gCargo1 = document.getElementById("group-edit-cargo");
        const gCargo2 = document.getElementById("group-edit-cargo2");
        const rUF1 = document.getElementById("row-edit-uf-mandato");
        const rUF2 = document.getElementById("row-edit-uf2");
        const sSec2 = document.getElementById("section-segundo-vinculo");

        const onChangeP1 = () => {
            const val = p1.value;
            const isCouncil = val === "CONSELHEIRO" || val === "DIRETORIA";
            gCargo1.style.display = isCouncil ? "flex" : "none";
            rUF1.style.display = isCouncil ? "grid" : "none";
            sSec2.style.display = isCouncil ? "block" : "none";
            atualizarOpcoesCargo(document.getElementById("edit-cargo"), val);

            const gUf = document.getElementById("group-edit-uf");
            if (val === "DIRETORIA" || val === "ADMIN" || val === "COLABORADOR") {
                document.getElementById("edit-uf-atuacao").value = "BR";
                if (gUf && val !== "CONSELHEIRO") gUf.style.visibility = "hidden";
            } else {
                if (gUf) gUf.style.visibility = "visible";
            }
        };

        const onChangeP2 = () => {
            const val = p2.value;
            gCargo2.style.display = val ? "flex" : "none";
            rUF2.style.display = val ? "grid" : "none";
            atualizarOpcoesCargo(document.getElementById("edit-cargo2"), val);
        };

        if (p1) p1.addEventListener("change", onChangeP1);
        if (p2) p2.addEventListener("change", onChangeP2);

        // Handlers de Ação (CSP-friendly)
        const btnArq = document.querySelector(".btn-arquivar-user");
        if (btnArq) btnArq.addEventListener("click", () => confirmarArquivar(btnArq.dataset.id));

        const btnDesarq = document.querySelector(".btn-desarquivar-user");
        if (btnDesarq) btnDesarq.addEventListener("click", () => confirmarDesarquivar(btnDesarq.dataset.id));

        const btnUpload = document.getElementById("btn-upload-avatar-modal");
        if (btnUpload) btnUpload.addEventListener("click", () => uploadAvatar(btnUpload.dataset.id));

        const btnRemover = document.getElementById("btn-remover-avatar-modal");
        if (btnRemover) btnRemover.addEventListener("click", () => removerAvatar(btnRemover.dataset.id));

        const btnClose = form.querySelector("[data-close]");
        if (btnClose) {
            btnClose.addEventListener("click", () => {
                document.getElementById(btnClose.dataset.close).style.display = "none";
            });
        }

        const { aplicarMascaraTelefone, aplicarMascaraCPF } = global.Utils || {};

        if (aplicarMascaraCPF) {
            const cpfInput = form.querySelector('input[name="cpf"]');
            if (cpfInput) aplicarMascaraCPF(cpfInput);
        }

        form.querySelectorAll(".campo-telefone").forEach(inp => aplicarMascaraTelefone?.(inp));
        form.querySelectorAll(".campo-data").forEach(inp => global.Utils?.aplicarMascaraData?.(inp));
        const cepInput = form.querySelector(".campo-cep");
        const btnBuscarCep = document.getElementById("btn-buscar-cep"); // Note: it's a span now with 🔍

        const executarBuscaCep = async () => {
            const cep = (cepInput.value || "").replace(/\D/g, "");
            if (cep.length === 8) {
                try {
                    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await res.json();
                    if (data.erro) {
                        alert("CEP não encontrado.");
                        return;
                    }
                    const inputEnd = document.getElementById("edit-logradouro");
                    inputEnd.value = `${data.logradouro}${data.bairro ? ', ' + data.bairro : ''}`;
                    inputEnd.dataset.logradouro = data.logradouro || "";
                    inputEnd.dataset.bairro = data.bairro || "";

                    document.getElementById("edit-cidade").value = data.localidade;
                    document.getElementById("edit-uf").value = data.uf;
                } catch (e) {
                    console.error("Erro CEP", e);
                    alert("Erro ao buscar CEP. Verifique sua conexão.");
                }
            }
        };

        if (cepInput) {
            global.Utils?.aplicarMascaraCEP?.(cepInput);
            cepInput.addEventListener('blur', executarBuscaCep);
            // also trigger on search icon click
            const searchIcon = form.querySelector(".cep-search-icon");
            if (searchIcon) searchIcon.addEventListener("click", executarBuscaCep);
        }

        const dataNascInput = document.getElementById("edit-data-nascimento");
        if (dataNascInput) {
            dataNascInput.addEventListener("change", () => {
                const display = document.getElementById("edit-idade-display");
                if (display) display.value = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(dataNascInput.value) : '—';
            });
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const rawPayload = {};
            fd.forEach((v, k) => {
                if (!k.includes("_select") && !k.includes("_outro")) {
                    rawPayload[k] = v;
                }
            });

            // FENAPRF: Ensure logradouro and bairro are separate
            const inputEnd = document.getElementById("edit-logradouro");
            rawPayload.logradouro = inputEnd.dataset.logradouro || "";
            rawPayload.bairro = inputEnd.dataset.bairro || "";

            // If dataset is missing but value exists (legacy), we try to use the value as logradouro
            if (!rawPayload.logradouro && inputEnd.value) {
                rawPayload.logradouro = inputEnd.value;
            }

            const onlyDigits = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").toString().replace(/\D/g, "");
            const ehGestao = ["ADMIN", "DIRETORIA", "COLABORADOR"].includes(perfilAtual);

            // Sanitização e Limpeza Obrigatória (B2)
            const payload = {};
            Object.keys(rawPayload).forEach(key => {
                let val = rawPayload[key];

                // 1. Trim strings
                if (typeof val === 'string') val = val.trim();

                // 2. Remover vazios, null, undefined ou placeholders
                if (val === "" || val === null || val === undefined || val === "Selecione...") {
                    return;
                }

                // 3. Remover campos readonly se não for gestor pleno
                if (!ehGestao && (key === 'sexo' || key === 'cpf')) {
                    return;
                }

                // 4. Normalização de Nomes (Canônico)
                if (key === 'nome' || key.includes('_nome')) {
                    if (global.Canon?.normalizeNome) val = global.Canon.normalizeNome(val);
                }

                // 5. Normalização de Documentos/Telefones
                if (key === 'cpf' || key.includes('_cpf') || key === 'telefone1' || key === 'telefone2' || key === 'cep') {
                    val = onlyDigits(val);
                }

                payload[key] = val;
            });

            // Validação final de campos críticos se presentes
            if (payload.cpf && payload.cpf.length !== 11) {
                alert("O CPF deve ter exatamente 11 dígitos.");
                return;
            }

            try {
                const url = `/api/users/${id}`;
                const r = await window.Api.apiFetch(url, { method: "PUT", body: payload });
                const data = await r.json();

                if (r.ok) {
                    if (data.warnings && data.warnings.length > 0) {
                        const warnMsgs = data.warnings.map(w => w.message).join("\n");
                        alert("Salvo com avisos:\n" + warnMsgs);
                    } else {
                        alert("Sucesso!");
                    }
                    document.getElementById("modal-editar-user").style.display = "none";
                    await carregarLista();
                } else {
                    const msg = data.message || "Erro ao salvar.";
                    const errorId = data.errorId ? `\n(ID do Erro: ${data.errorId})` : "";
                    alert(msg + errorId);
                }
            } catch (err) { alert("Erro de conexão ao servidor."); }
        };
    }

    async function confirmarArquivar(id) {
        const motivo = prompt("Motivo do arquivamento:");
        if (!motivo) return;
        const r = await window.Api.apiFetch(`/api/users/${id}/arquivar`, { method: "POST", body: { motivo } });
        if (r.ok) {
            alert("Arquivado.");
            document.getElementById("modal-editar-user").style.display = "none";
            await carregarLista();
        }
    }

    async function confirmarDesarquivar(id) {
        const motivo = prompt("Motivo do desarquivamento (opcional):") || "Reativado via Web";
        const r = await window.Api.apiFetch(`/api/users/${id}/desarquivar`, { method: "POST", body: { motivo } });
        if (r.ok) {
            alert("Desarquivado.");
            document.getElementById("modal-editar-user").style.display = "none";
            await carregarLista();
        }
    }

    async function uploadAvatar(id) {
        const input = document.getElementById("modal-avatar-input");
        const file = input?.files?.[0];
        if (!file) { alert("Selecione um arquivo."); return; }

        const fd = new FormData();
        fd.append("avatar", file);

        try {
            const r = await window.Api.apiFetch(`/api/users/${id}/avatar`, { method: "POST", body: fd });
            if (r.ok) {
                const d = await r.json();
                const apiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
                    ? "http://localhost:3000"
                    : "https://fenaprf-sistema.onrender.com";

                const finalUrl = d.avatar_url.startsWith('http') ? d.avatar_url : apiBase + d.avatar_url;
                document.getElementById("modal-avatar-preview").src = finalUrl;
                alert("Avatar atualizado.");
                await carregarLista();
            }
        } catch(e) { alert("Erro no upload."); }
    }

    async function removerAvatar(id) {
        if (!confirm("Remover foto?")) return;
        try {
            const r = await window.Api.apiFetch(`/api/users/${id}/avatar`, { method: "DELETE" });
            if (r.ok) {
                document.getElementById("modal-avatar-preview").src = "/img/avatar-placeholder.png";
                alert("Foto removida.");
                await carregarLista();
            }
        } catch(e) { alert("Erro ao remover."); }
    }

    function abrirNovoUser(container) {
        if (container.style.display === "none") {
            renderizarFormularioNovoUser(container);
            container.style.display = "block";
        } else {
            container.style.display = "none";
        }
    }

    function renderizarFormularioNovoUser(container) {
        if (!container) return;
        const { aplicarMascaraTelefone, aplicarMascaraCPF, aplicarMascaraCEP, aplicarMascaraData } = global.Utils || {};

        container.innerHTML = `
            <div class="user-card" style="border-left-color: var(--amarelo);">
                <h3>👤 Novo Membro</h3>
                <form id="form-novo-user-admin">
                    <div class="edit-grid">
                        <div class="edit-group">
                            <label>Nome Completo *</label>
                            <input name="nome" required placeholder="Nome completo">
                        </div>
                        <div class="edit-group">
                            <label>Sexo</label>
                            <select name="sexo">
                                <option value="" selected>-</option>
                                <option value="M">♂️ Masculino</option>
                                <option value="F">♀️ Feminino</option>
                            </select>
                        </div>
                        <div class="edit-group">
                            <label>CPF *</label>
                            <input name="cpf" required placeholder="000.000.000-00">
                        </div>
                        <div class="edit-group">
                            <label>Data Nascimento</label>
                            <input type="text" name="data_nascimento" id="new-data-nascimento" class="campo-data" placeholder="DD/MM/AAAA">
                        </div>
                        <div class="edit-group">
                            <label>Idade (Calculada)</label>
                            <input type="text" id="new-idade-display" value="—" readonly style="background:#f8f9fa;">
                        </div>
                        <div class="edit-group">
                            <label>Telefone 1 *</label>
                            <input name="telefone1" class="campo-telefone" required placeholder="(00) 00000-0000">
                        </div>
                        <div class="edit-group">
                            <label>Telefone 2</label>
                            <input name="telefone2" class="campo-telefone" placeholder="Opcional">
                        </div>
                        <div class="edit-group">
                            <label>Email *</label>
                            <input type="email" name="email" required placeholder="seu@email.com">
                        </div>

                        <div class="edit-group">
                            <label>Perfil de Acesso</label>
                            <select name="perfil_acesso" id="new-perfil-acesso">
                                <option value="CONSELHEIRO" selected>CONSELHEIRO</option>
                                <option value="COLABORADOR">COLABORADOR</option>
                                <option value="DIRETORIA">DIRETORIA</option>
                                ${perfilAtual === 'ADMIN' ? `<option value="ADMIN">ADMIN</option>` : ""}
                            </select>
                        </div>
                        <div class="edit-group" id="group-new-cargo">
                            <label>Cargo</label>
                            <select name="cargo" id="new-cargo">
                                <option value="">Sem cargo</option>
                                <!-- Preenchido via JS -->
                            </select>
                        </div>
                        <div class="edit-group" id="group-new-uf">
                            <label>UF de Atuação</label>
                            <select name="uf" id="new-uf-atuacao">
                                <option value="BR">Brasil (Nacional)</option>
                                ${global.Canon.UFS.map(uf => `<option value="${uf}">${uf}</option>`).join('')}
                            </select>
                        </div>

                        <div class="address-grid span-2">
                            <div class="edit-group cep-group">
                                <label>CEP</label>
                                <div class="cep-input-wrapper">
                                    <input name="cep" id="new-cep" class="campo-cep" placeholder="00000-000">
                                    <span class="cep-search-icon">🔍</span>
                                </div>
                            </div>
                            <div class="edit-group logradouro-group">
                                <label>Logradouro / Bairro</label>
                                <input name="logradouro_bairro" id="new-logradouro" readonly style="background:#f0f0f0;">
                            </div>
                            <div class="edit-group">
                                <label>Número</label>
                                <input name="numero">
                            </div>
                            <div class="edit-group">
                                <label>Complemento</label>
                                <input name="complemento">
                            </div>
                            <div class="edit-group">
                                <label>Cidade</label>
                                <input name="cidade" id="new-cidade" readonly style="background:#f0f0f0;">
                            </div>
                            <div class="edit-group">
                                <label>UF</label>
                                <input name="uf_endereco" id="new-uf" readonly style="background:#f0f0f0;">
                            </div>
                        </div>
                    </div>
                    <div style="text-align:right; margin-top:25px;">
                        <button type="button" class="btn btn-outline" id="btn-cancelar-novo-user">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Criar Cadastro</button>
                    </div>
                </form>
            </div>
        `;

        const form = container.querySelector("#form-novo-user-admin");

        const btnCancel = form.querySelector("#btn-cancelar-novo-user");
        if (btnCancel) {
            btnCancel.addEventListener("click", () => {
                container.style.display = "none";
            });
        }

        const np = document.getElementById("new-perfil-acesso");
        const nc = document.getElementById("new-cargo");
        const gnc = document.getElementById("group-new-cargo");
        const gnu = document.getElementById("group-new-uf");

        const onChangeNp = () => {
            const val = np.value;
            const isCouncil = val === "CONSELHEIRO" || val === "DIRETORIA";
            gnc.style.display = isCouncil ? "flex" : "none";
            gnu.style.display = isCouncil ? "flex" : "none";
            atualizarOpcoesCargo(nc, val);

            if (val === "DIRETORIA" || val === "ADMIN" || val === "COLABORADOR") {
                document.getElementById("new-uf-atuacao").value = "BR";
                if (gnu && val !== "CONSELHEIRO") gnu.style.visibility = "hidden";
            } else {
                if (gnu) gnu.style.visibility = "visible";
            }
        };
        if (np) {
            np.addEventListener("change", onChangeNp);
            onChangeNp();
        }

        // Aplicar Máscaras
        if (aplicarMascaraCPF) aplicarMascaraCPF(form.querySelector('input[name="cpf"]'));
        if (aplicarMascaraTelefone) aplicarMascaraTelefone(form.querySelector('input[name="telefone1"]'));
        form.querySelectorAll(".campo-data").forEach(inp => global.Utils?.aplicarMascaraData?.(inp));

        const cepInp = form.querySelector("#new-cep");
        const executarBuscaCepNovo = async () => {
            const cep = (cepInp.value || "").replace(/\D/g, "");
            if (cep.length === 8) {
                try {
                    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await res.json();
                    if (data.erro) {
                        alert("CEP não encontrado.");
                        return;
                    }
                    const inputEnd = document.getElementById("new-logradouro");
                    inputEnd.value = `${data.logradouro}${data.bairro ? ', ' + data.bairro : ''}`;
                    inputEnd.dataset.logradouro = data.logradouro || "";
                    inputEnd.dataset.bairro = data.bairro || "";

                    document.getElementById("new-cidade").value = data.localidade;
                    document.getElementById("new-uf").value = data.uf;
                } catch (err) {
                    console.error("Erro busca CEP", err);
                    alert("Erro ao buscar CEP.");
                }
            }
        };

        if (cepInp) {
            if (aplicarMascaraCEP) aplicarMascaraCEP(cepInp);
            cepInp.addEventListener('blur', executarBuscaCepNovo);
            const searchIcon = form.querySelector(".cep-search-icon");
            if (searchIcon) searchIcon.addEventListener("click", executarBuscaCepNovo);
        }

        const dataNascNew = form.querySelector("#new-data-nascimento");
        if (dataNascNew) {
            dataNascNew.addEventListener("change", () => {
                const display = document.getElementById("new-idade-display");
                if (display) display.value = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(dataNascNew.value) : '—';
            });
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const payload = {};
            fd.forEach((v, k) => { if (!k.includes("_select") && !k.includes("_outro")) payload[k] = v; });

            // FENAPRF: Ensure logradouro and bairro are separate
            const inputEnd = document.getElementById("new-logradouro");
            payload.logradouro = inputEnd.dataset.logradouro || "";
            payload.bairro = inputEnd.dataset.bairro || "";

            // Normalização de Nomes (Canônico)
            if (payload.nome && global.Canon?.normalizeNome) {
                payload.nome = global.Canon.normalizeNome(payload.nome);
            }

            const onlyDigits = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").toString().replace(/\D/g, "");

            // Validação e Sanitização CPF
            const cpfLimp = onlyDigits(payload.cpf);
            if (cpfLimp.length !== 11) {
                alert("O CPF deve ter exatamente 11 dígitos.");
                return;
            }
            payload.cpf = cpfLimp;

            // Sanitização Telefone
            if (payload.telefone1) payload.telefone1 = onlyDigits(payload.telefone1);

            // Conversão Data de Nascimento para ISO (if it still comes in BR format for some reason)
            if (payload.data_nascimento && payload.data_nascimento.includes('/')) {
                const iso = global.Formatters ? global.Formatters.parseBRToISO(payload.data_nascimento) : null;
                if (!iso) {
                    alert("Data de nascimento inválida. Use o formato DD/MM/AAAA.");
                    return;
                }
                payload.data_nascimento = iso;
            }

            try {
                const r = await window.Api.apiFetch("/api/users", { method: "POST", body: payload });
                const data = await r.json();
                if (r.ok) {
                    if (data.warnings && data.warnings.length > 0) {
                        const warnMsgs = data.warnings.map(w => w.message).join("\n");
                        alert("Criado com avisos:\n" + warnMsgs);
                    } else {
                        alert("Criado com sucesso!");
                    }
                    container.style.display = "none";
                    await carregarLista();
                } else {
                    alert(data.message || "Erro ao criar.");
                }
            } catch (err) { alert("Erro de conexão."); }
        };
    }

    // No local declarations of apiFetch here. Using window.Api.apiFetch everywhere.

    global.UsersAdmin = {
        inicializarUsers,
        abrirModalEdicao,
        confirmarArquivar,
        confirmarDesarquivar,
        uploadAvatar,
        removerAvatar
    };

})(typeof window !== 'undefined' ? window : global);
