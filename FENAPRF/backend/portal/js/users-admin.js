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

        return `<img class="avatar-mini" src="${src}" alt="Avatar ${escapedNome}" onerror="this.src='/img/avatar-placeholder.png'">`;
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
                    <div class="search-box-container af-standard-header">
                        <div style="display:flex; justify-content:center; align-items:center; margin-bottom:15px;">
                            <h2 style="margin:0;">👥 Membros</h2>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
                            <button id="btn-novo-user" class="btn btn-primary" style="display:none; margin-bottom:10px;">+ Novo Membro</button>
                            <div id="users-count" style="font-weight: bold; margin-bottom: 5px;">Total: 0</div>
                            <input type="text" id="busca-users" placeholder="${placeholder}" style="width:100%; max-width: 450px; padding:10px; border-radius:8px; border:none; color:#333;">
                        </div>
                    </div>
                    <div id="novo-user-container" style="display:none; margin-bottom:20px;"></div>
                    <div id="lista-users"></div>
                `;
            }
        }

        const canManageProfiles = ehGestao;

        if (!handlersConfigurados) {
            const btnNovo = document.getElementById("btn-novo-user");
            const containerNovo = document.getElementById("novo-user-container");

            if (btnNovo) {
                if (ehGestao) {
                    btnNovo.style.display = "inline-block";
                    btnNovo.onclick = () => abrirNovoUser(containerNovo);
                    renderizarFormularioNovoUser(containerNovo);
                }
            }

            const campoBusca = document.getElementById("busca-users");
            if (campoBusca) {
                campoBusca.addEventListener("input", (e) => filtrarLista(e.target.value));

                const filtros = document.createElement("div");
                filtros.className = "row-filtros";

                const ehGestao = ["ADMIN", "DIRETORIA", "COLABORADOR"].includes(perfilAtual);

                filtros.innerHTML = `
                    ${ehGestao ? `
                    <label>
                        Estado:
                        <select id="filtro-estado-cadastro">
                            <option value="CADASTRO_ATIVO" selected>Ativos</option>
                            <option value="ARQUIVADOS">Arquivados</option>
                            <option value="TODOS">Todos</option>
                        </select>
                    </label>` : '<input type="hidden" id="filtro-estado-cadastro" value="CADASTRO_ATIVO">'}
                `;
                campoBusca.insertAdjacentElement("afterend", filtros);

                if (ehGestao) {
                    document.getElementById("filtro-estado-cadastro").addEventListener("change", carregarLista);
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
            const estado = (document.getElementById("filtro-estado-cadastro")?.value || "CADASTRO_ATIVO").toUpperCase();
            let url = "/api/users";
            if (estado !== "CADASTRO_ATIVO") url += "?incluirArquivados=1";

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

        const { filterUsers, formatarCPF, formatarTelefoneTexto, normalizeText, escapeHTML } = global.Utils || {};
        const safeEscape = (v) => escapeHTML ? escapeHTML(v) : (v || "");

        // Reutiliza a lógica unificada de busca (nome/CPF)
        let res = filterUsers ? filterUsers(cacheLista, termo, { perfil: perfilAtual }) : cacheLista;


        const fEstado = document.getElementById("filtro-estado-cadastro")?.value || "CADASTRO_ATIVO";
        if (fEstado === "ARQUIVADOS") {
            res = res.filter(f => f.arquivado_em);
        } else if (fEstado === "CADASTRO_ATIVO") {
            res = res.filter(f => !f.arquivado_em);
        }

        const countEl = document.getElementById("users-count");
        if (countEl) countEl.textContent = `Total: ${res.length}`;

        if (!res.length) {
            el.innerHTML = `<div class="user-card" style="text-align:center;">Nenhum registro.</div>`;
            return;
        }

        el.innerHTML = res.map(f => {
            const situacaoLower = 'ativo';
            const classeStatus = `status-ativo`;
            const nascimento = f.data_nascimento;
            const idade = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(nascimento) : '—';

            const tels = [f.telefone1, f.telefone2].filter(Boolean).map(t => formatarTelefoneTexto ? formatarTelefoneTexto(t) : t).join(" / ");

            return `
                <div class="user-card ${classeStatus}">
                    <div class="user-header">
                        <div class="user-left">
                            ${avatarHtml(f.avatar_url, f.nome)}
                            <div>
                                <div class="user-nome">${safeEscape(f.nome)}</div>
                                <div class="user-meta">${f.cpf ? safeEscape(formatarCPF(f.cpf)) + ' • ' : ''}${safeEscape(f.uf || '')}</div>
                                ${["CONSELHEIRO"].includes(perfilAtual) ? '' : `
                                <div class="user-meta" style="font-size:0.8rem;">🎂 ${nascimento ? global.Formatters.formatISOToBR(nascimento) : '—'} (${idade})</div>
                                `}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="margin-top:5px; font-size:0.85rem;">${safeEscape(tels) || '-'}</div>
            ${!["CONSELHEIRO"].includes(perfilAtual) ?
                                `<button class="btn btn-outline btn-sm" onclick="UsersAdmin.abrirModalEdicao(${f.id})" style="margin-top:8px;">✏️ Editar</button>` : ''}
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

        const userInfo = window.Utils && window.Utils.obterUserInfo ? window.Utils.obterUserInfo() : null;
        const isSelf = userInfo && String(f.id) === String(userInfo.id);
        const canChangeProfile = (ehAdmin || (["DIRETORIA", "COLABORADOR"].includes(perfilAtual) && f.perfil_acesso !== "ADMIN")) && !isSelf;

        const responsavel = safeEscape(f.arquivado_por_nome || (f.arquivado_por ? `ID ${f.arquivado_por}` : "—"));

        return `
            <div id="alertas-modal"></div>

            <!-- Barra de Status do User -->
            <div class="status-bar-modal">
                <span>Estado: <strong>${isArquivado ? "ARQUIVADO" : "ATIVO"}</strong></span>
                <div>
                    ${isArquivado ?
                        `<button type="button" class="btn btn-outline btn-sm" onclick="UsersAdmin.confirmarDesarquivar(${f.id})">📤 Desarquivar</button>` :
                        `<button type="button" class="btn btn-outline btn-sm" onclick="UsersAdmin.confirmarArquivar(${f.id})">📥 Arquivar</button>`}
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
                            <input name="cpf" value="${safeEscape(f.cpf)}" ${ehGestao ? "" : "readonly"}>
                        </div>
                        <div class="field-group"></div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Data Nascimento</label>
                            <input type="date" name="data_nascimento" id="edit-data-nascimento" value="${toDateInputValue ? toDateInputValue(f.data_nascimento) : ""}">
                        </div>
                        <div class="field-group">
                            <label>Idade (Calculada)</label>
                            <input type="text" id="edit-idade-display" value="${idade}" readonly style="background:#f8f9fa;">
                        </div>
                    </div>
                    ${canChangeProfile ? `
                        <div class="field-row">
                            <div class="field-group">
                                <label>Perfil de Acesso</label>
                                <select name="perfil_acesso">
                                    <option value="CONSELHEIRO" ${f.perfil_acesso === "CONSELHEIRO" ? "selected" : ""}>CONSELHEIRO</option>
                                    <option value="COLABORADOR" ${f.perfil_acesso === "COLABORADOR" ? "selected" : ""}>COLABORADOR</option>
                                    <option value="DIRETORIA" ${f.perfil_acesso === "DIRETORIA" ? "selected" : ""}>DIRETORIA</option>
                                    ${ehAdmin ? `<option value="ADMIN" ${f.perfil_acesso === "ADMIN" ? "selected" : ""}>ADMIN</option>` : ""}
                                </select>
                            </div>
                            <div class="field-group"></div>
                        </div>
                    ` : `<input type="hidden" name="perfil_acesso" value="${f.perfil_acesso}">`}
                </div>

                <div class="data-card bg-alt">
                    <h3>📞 Contato</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Email 1</label>
                            <input name="email1" value="${safeEscape(f.email1)}">
                        </div>
                        <div class="field-group">
                            <label>Telefone 1</label>
                            <input name="telefone1" class="campo-telefone" value="${safeEscape(f.telefone1)}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Email 2</label>
                            <input name="email2" value="${safeEscape(f.email2)}">
                        </div>
                        <div class="field-group">
                            <label>Telefone 2</label>
                            <input name="telefone2" class="campo-telefone" value="${safeEscape(f.telefone2)}">
                        </div>
                    </div>
                </div>

                <div class="data-card">
                    <h3>🏠 Endereço</h3>
                    <div class="address-grid-v2">
                        <!-- Linha 1: CEP + Logradouro -->
                        <div class="edit-group cep-group">
                            <label>CEP</label>
                            <div class="cep-input-wrapper">
                                <input name="cep" id="edit-cep" value="${safeEscape(f.cep)}" class="campo-cep">
                                <span class="cep-search-icon">🔍</span>
                            </div>
                        </div>
                        <div class="edit-group logradouro-group">
                            <label>Logradouro / Bairro</label>
                            <input name="logradouro_bairro" id="edit-logradouro" value="${safeEscape(f.logradouro_bairro)}" readonly style="background:#f8f9fa;">
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
                            <input name="uf" id="edit-uf" value="${safeEscape(f.uf)}" readonly style="background:#f8f9fa;">
                        </div>
                    </div>
                </div>

                <div class="data-card">
                    <h3>🖼️ Avatar (Foto)</h3>
                    <div class="subcard flex-center" style="gap: 20px; flex-wrap: wrap;">
                        <img id="modal-avatar-preview" class="avatar-preview" src="${f.avatar_url || '/img/avatar-placeholder.png'}" alt="Preview" onerror="this.src='/img/avatar-placeholder.png'" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid #ffc107;">
                        <div class="avatar-actions" style="flex:1; min-width:200px; display:flex; flex-direction:column; gap:10px;">
                            <input type="file" id="modal-avatar-input" accept="image/*">
                            <div style="display:flex; gap:10px;">
                                <button type="button" class="btn btn-primary btn-sm" onclick="UsersAdmin.uploadAvatar(${f.id})" style="flex:1;">Upload</button>
                                <button type="button" class="btn btn-danger-outline btn-sm" onclick="UsersAdmin.removerAvatar(${f.id})" style="flex:1;">Remover</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer-actions">
                    <button type="button" class="btn btn-outline btn-lg" onclick="document.getElementById('modal-editar-user').style.display='none'">Cancelar</button>
                    <button type="submit" class="btn btn-primary btn-lg">Salvar Alterações</button>
                </div>
            </form>
        `;
    }

    function configurarFormEdicao(id) {
        const form = document.getElementById("form-edicao-modal");
        const { aplicarMascaraTelefone, aplicarMascaraCPF } = global.Utils || {};

        if (aplicarMascaraCPF) {
            const cpfInput = form.querySelector('input[name="cpf"]');
            if (cpfInput) aplicarMascaraCPF(cpfInput);
        }

        form.querySelectorAll(".campo-telefone").forEach(inp => aplicarMascaraTelefone?.(inp));
        const cepInput = form.querySelector(".campo-cep");
        const btnBuscarCep = document.getElementById("btn-buscar-cep"); // Note: it's a span now with 🔍

        const executarBuscaCep = async () => {
            const cep = (cepInput.value || "").replace(/\D/g, "");
            if (cep.length === 8) {
                try {
                    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await res.json();
                    if (!data.erro) {
                        document.getElementById("edit-logradouro").value = `${data.logradouro}${data.bairro ? ' - ' + data.bairro : ''}`;
                        document.getElementById("edit-cidade").value = data.localidade;
                        document.getElementById("edit-uf").value = data.uf;
                    }
                } catch (e) { console.error("Erro CEP", e); }
            }
        };

        if (cepInput) {
            global.Utils?.aplicarMascaraCEP?.(cepInput);
            cepInput.addEventListener('blur', executarBuscaCep);
            // also trigger on search icon click
            const searchIcon = form.querySelector(".cep-search-icon");
            if (searchIcon) searchIcon.onclick = executarBuscaCep;
        }

        const dataNascInput = document.getElementById("edit-data-nascimento");
        if (dataNascInput) {
            dataNascInput.onchange = () => {
                const display = document.getElementById("edit-idade-display");
                if (display) display.value = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(dataNascInput.value) : '—';
            };
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
                    alert("Sucesso!");
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
                            <label>Nome *</label>
                            <input name="nome" required>
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
                        <div class="edit-group"></div>
                        <div class="edit-group">
                            <label>Email *</label>
                            <input type="email" name="email1" required>
                        </div>
                        <div class="edit-group">
                            <label>Telefone 1 *</label>
                            <input name="telefone1" class="campo-telefone" required placeholder="(00) 00000-0000">
                        </div>
                        <div class="edit-group">
                            <label>Data Nascimento</label>
                            <input name="data_nascimento" class="campo-data" placeholder="DD/MM/AAAA">
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
                                <input name="uf" id="new-uf" readonly style="background:#f0f0f0;">
                            </div>
                        </div>
                    </div>
                    <div style="text-align:right; margin-top:25px;">
                        <button type="button" class="btn btn-outline" onclick="this.closest('.user-card').parentElement.style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Criar Cadastro</button>
                    </div>
                </form>
            </div>
        `;

        const form = container.querySelector("#form-novo-user-admin");

        // Aplicar Máscaras
        if (aplicarMascaraCPF) aplicarMascaraCPF(form.querySelector('input[name="cpf"]'));
        if (aplicarMascaraTelefone) aplicarMascaraTelefone(form.querySelector('input[name="telefone1"]'));
        if (aplicarMascaraData) aplicarMascaraData(form.querySelector('input[name="data_nascimento"]'));

        const cepInp = form.querySelector("#new-cep");
        if (cepInp) {
            if (aplicarMascaraCEP) aplicarMascaraCEP(cepInp);
            cepInp.addEventListener('blur', async () => {
                const cep = (cepInp.value || "").replace(/\D/g, "");
                if (cep.length === 8) {
                    try {
                        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                        const data = await res.json();
                        if (!data.erro) {
                            document.getElementById("new-logradouro").value = `${data.logradouro}${data.bairro ? ' - ' + data.bairro : ''}`;
                            document.getElementById("new-cidade").value = data.localidade;
                            document.getElementById("new-uf").value = data.uf;
                        }
                    } catch (err) { console.error("Erro busca CEP", err); }
                }
            });
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const payload = {};
            fd.forEach((v, k) => { if (!k.includes("_select") && !k.includes("_outro")) payload[k] = v; });

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

            // Conversão Data de Nascimento para ISO
            if (payload.data_nascimento) {
                const iso = global.Formatters ? global.Formatters.parseBRToISO(payload.data_nascimento) : null;
                if (payload.data_nascimento.includes('/') && !iso) {
                    alert("Data de nascimento inválida. Use o formato DD/MM/AAAA.");
                    return;
                }
                if (iso) payload.data_nascimento = iso;
            }

            try {
                const r = await window.Api.apiFetch("/api/users", { method: "POST", body: payload });
                if (r.ok) {
                    alert("Criado com sucesso!");
                    container.style.display = "none";
                    await carregarLista();
                } else {
                    const err = await r.json();
                    alert(err.message || "Erro ao criar.");
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
