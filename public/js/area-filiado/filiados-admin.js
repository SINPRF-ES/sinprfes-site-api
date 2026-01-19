/**
 * Módulo Filiados Admin (Área do Filiado)
 * Carregado como script clássico (window.FiliadosAdmin)
 */

(function (global) {
    if (global.FiliadosAdmin) return;

    let cacheLista = [];
    const SITUACAO_OPCOES = ["ATIVO", "VETERANO", "PENSIONISTA"];

    const LOTACAO_OPCOES = [
      "SEDE",
      "DEL 01 - Viana",
      "DEL 02 - Serra",
      "DEL 03 - Guarapari",
      "DEL 04 - Linhares."
    ];

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
        const safeNome = (nome || "").toString();
        const src = avatarUrl ? avatarUrl : "/img/avatar-placeholder.png";
        return `<img class="avatar-mini" src="${src}" alt="Avatar ${safeNome}" onerror="this.src='/img/avatar-placeholder.png'">`;
    }

    async function inicializarFiliados(perfil) {
        const listaEl = document.getElementById("lista-filiados");
        if (!listaEl) {
            const secFiliados = document.getElementById("sec-filiados");
            if (secFiliados) {
                secFiliados.innerHTML = `
                    <div class="search-box-container">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <h2 style="margin:0;">👥 Gestão de Filiados</h2>
                            <button id="btn-novo-filiado" class="btn btn-primary" style="display:none;">+ Novo Filiado</button>
                        </div>
                        <input type="text" id="busca-filiados" placeholder="Buscar por nome ou CPF..." style="width:100%; padding:10px; border-radius:8px; border:none; color:#333;">
                    </div>
                    <div id="novo-filiado-container" style="display:none; margin-bottom:20px;"></div>
                    <div id="lista-filiados"></div>
                `;
            }
        }

        perfilAtual = (perfil || "").toUpperCase();
        const { apiFetch } = global.Utils || {};

        if (!handlersConfigurados) {
            const btnNovo = document.getElementById("btn-novo-filiado");
            const containerNovo = document.getElementById("novo-filiado-container");

            if (btnNovo) {
                if (["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual)) {
                    btnNovo.style.display = "inline-block";
                    btnNovo.onclick = () => abrirNovoFiliado(containerNovo);
                    renderizarFormularioNovoFiliado(containerNovo);
                }
            }

            const campoBusca = document.getElementById("busca-filiados");
            if (campoBusca) {
                campoBusca.addEventListener("input", (e) => filtrarLista(e.target.value));

                const filtros = document.createElement("div");
                filtros.className = "row-filtros";

                const ehGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);

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
                    <label>
                        Situação:
                        <select id="filtro-situacao-funcional">
                            <option value="TODOS" selected>Todos</option>
                            <option value="ATIVO">Ativo</option>
                            <option value="VETERANO">Veterano</option>
                            <option value="PENSIONISTA">Pensionista</option>
                        </select>
                    </label>
                `;
                campoBusca.insertAdjacentElement("afterend", filtros);

                if (ehGestao) {
                    document.getElementById("filtro-estado-cadastro").addEventListener("change", carregarLista);
                }
                document.getElementById("filtro-situacao-funcional").addEventListener("change", () => filtrarLista(campoBusca.value));
            }
            handlersConfigurados = true;
        }

        await carregarLista();
    }

    async function carregarLista() {
        const listaEl = document.getElementById("lista-filiados");
        if (!listaEl) return;

        const { apiFetch } = global.Utils || {};
        try {
            listaEl.innerHTML = `<p style="text-align:center; color:#fff;">Carregando...</p>`;
            const estado = (document.getElementById("filtro-estado-cadastro")?.value || "CADASTRO_ATIVO").toUpperCase();
            let url = "/api/filiados";
            if (estado !== "CADASTRO_ATIVO") url += "?incluirArquivados=1";

            const r = await apiFetch(url);
            if (r.ok) {
                const d = await r.json();
                cacheLista = d.filiados || d || [];
                filtrarLista(document.getElementById("busca-filiados")?.value || "");
            }
        } catch (e) {
            listaEl.innerHTML = `<p style="text-align:center; color:red;">Erro ao carregar.</p>`;
        }
    }

    function filtrarLista(termo) {
        const el = document.getElementById("lista-filiados");
        if (!el) return;

        const { normalizarTextoBusca, formatarCPF, formatarTelefoneTexto } = global.Utils || {};
        const t = (termo || "").toLowerCase();

        let res = cacheLista.filter(f => {
            const nome = (f.nome || "").toLowerCase();
            const cpf = (f.cpf || "").toLowerCase();
            return nome.includes(t) || cpf.includes(t);
        });

        const fSituacao = document.getElementById("filtro-situacao-funcional")?.value || "TODOS";
        if (fSituacao !== "TODOS") {
            res = res.filter(f => (f.situacao_funcional || f.situacao || "ATIVO").toUpperCase() === fSituacao);
        }

        const fEstado = document.getElementById("filtro-estado-cadastro")?.value || "CADASTRO_ATIVO";
        if (fEstado === "ARQUIVADOS") {
            res = res.filter(f => f.arquivado_em);
        } else if (fEstado === "CADASTRO_ATIVO") {
            res = res.filter(f => !f.arquivado_em);
        }

        if (!res.length) {
            el.innerHTML = `<div class="filiado-card" style="text-align:center;">Nenhum registro.</div>`;
            return;
        }

        el.innerHTML = res.map(f => {
            const situacao = (f.situacao_funcional || f.situacao || 'ATIVO').toUpperCase();
            const classeStatus = `status-${situacao.toLowerCase()}`;
            const tels = [f.telefone1, f.telefone2].filter(Boolean).map(t => formatarTelefoneTexto ? formatarTelefoneTexto(t) : t).join(" / ");

            return `
                <div class="filiado-card ${classeStatus}">
                    <div class="filiado-header">
                        <div class="filiado-left">
                            ${avatarHtml(f.avatar_url, f.nome)}
                            <div>
                                <div class="filiado-nome">${f.nome}</div>
                                <div class="filiado-meta">${f.cpf ? formatarCPF(f.cpf) + ' • ' : ''}${f.lotacao || 'SEDE'}</div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span class="filiado-badge">${situacao}</span>
                            <div style="margin-top:5px; font-size:0.85rem;">${tels || '-'}</div>
                            ${["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual) ?
                                `<button class="btn btn-outline btn-sm" onclick="FiliadosAdmin.abrirModalEdicao(${f.id})" style="margin-top:8px;">✏️ Editar</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function abrirModalEdicao(id) {
        const filiado = cacheLista.find(f => f.id == id);
        if (!filiado) return;

        const modal = document.getElementById("modal-editar-filiado");
        const corpo = document.getElementById("modal-corpo");
        if (!modal || !corpo) return;

        corpo.innerHTML = gerarHtmlForm(filiado);
        modal.style.display = "flex";

        configurarFormEdicao(id);
    }

    function gerarHtmlForm(f) {
        const { toDateInputValue } = global.Formatters || {};
        const ehAdmin = perfilAtual === "ADMIN";
        const isArquivado = !!f.arquivado_em;

        return `
            <div id="alertas-modal"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:#f8f9fa; padding:10px; border-radius:8px;">
                <span>Status: <strong>${isArquivado ? "ARQUIVADO" : "ATIVO"}</strong></span>
                <div>
                    ${isArquivado ?
                        `<button type="button" class="btn btn-outline btn-sm" onclick="FiliadosAdmin.confirmarDesarquivar(${f.id})">📤 Desarquivar</button>` :
                        `<button type="button" class="btn btn-outline btn-sm" onclick="FiliadosAdmin.confirmarArquivar(${f.id})">📥 Arquivar</button>`}
                </div>
            </div>

            <form id="form-edicao-modal">
                <div class="edit-grid">
                    <div class="edit-group">
                        <label>Nome</label>
                        <input name="nome" value="${f.nome || ""}" required>
                    </div>
                    <div class="edit-group">
                        <label>CPF</label>
                        <input name="cpf" value="${f.cpf || ""}" ${ehAdmin ? "" : "readonly"}>
                    </div>
                    <div class="edit-group">
                        <label>Data Nascimento</label>
                        <input type="date" name="data_nascimento" value="${toDateInputValue ? toDateInputValue(f.data_nascimento) : ""}">
                    </div>
                    <div class="edit-group">
                        <label>E-mail 1</label>
                        <input name="email1" value="${f.email1 || ""}">
                    </div>
                    <div class="edit-group">
                        <label>Telefone 1</label>
                        <input name="telefone1" class="campo-telefone" value="${f.telefone1 || ""}">
                    </div>
                    <div class="edit-group">
                        <label>Lotação</label>
                        <select name="lotacao">
                            ${LOTACAO_OPCOES.map(op => `<option value="${op}" ${f.lotacao === op ? "selected" : ""}>${op}</option>`).join("")}
                        </select>
                    </div>
                    <div class="edit-group">
                        <label>Situação Funcional</label>
                        <select name="situacao_funcional">
                            ${SITUACAO_OPCOES.map(op => `<option value="${op}" ${(f.situacao_funcional || f.situacao || "").toUpperCase() === op ? "selected" : ""}>${op}</option>`).join("")}
                        </select>
                    </div>
                    ${ehAdmin ? `
                        <div class="edit-group">
                            <label>Perfil de Acesso</label>
                            <select name="perfil_acesso">
                                <option value="FILIADO" ${f.perfil_acesso === "FILIADO" ? "selected" : ""}>FILIADO</option>
                                <option value="DIRETORIA" ${f.perfil_acesso === "DIRETORIA" ? "selected" : ""}>DIRETORIA</option>
                                <option value="ADMIN" ${f.perfil_acesso === "ADMIN" ? "selected" : ""}>ADMIN</option>
                            </select>
                        </div>
                    ` : ""}
                </div>

                <div class="edit-group span-2" style="margin-top:20px;">
                    <h4 style="border-bottom:1px solid #eee; padding-bottom:5px;">Dependentes</h4>
                    <div id="modal-dependentes-container"></div>
                </div>

                <div class="edit-group span-2" style="margin-top:20px;">
                    <h4 style="border-bottom:1px solid #eee; padding-bottom:5px;">Avatar (Foto)</h4>
                    <div class="avatar-actions">
                        <img id="modal-avatar-preview" class="avatar-preview" src="${f.avatar_url || '/img/avatar-placeholder.png'}" alt="Preview" onerror="this.src='/img/avatar-placeholder.png'">
                        <input type="file" id="modal-avatar-input" accept="image/*" style="flex:1;">
                        <button type="button" class="btn btn-outline btn-sm" onclick="FiliadosAdmin.uploadAvatar(${f.id})">Upload</button>
                        <button type="button" class="btn btn-danger-outline btn-sm" onclick="FiliadosAdmin.removerAvatar(${f.id})">Remover</button>
                    </div>
                </div>

                <div class="modal-footer" style="margin-top:20px; padding:0;">
                    <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-editar-filiado').style.display='none'">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Salvar Alterações</button>
                </div>
            </form>
        `;
    }

    function configurarFormEdicao(id) {
        const form = document.getElementById("form-edicao-modal");
        const { gerarCamposDependentes, aplicarMascaraTelefone, aplicarMascaraCPF, apiFetch } = global.Utils || {};

        const filiado = cacheLista.find(f => f.id == id);

        if (gerarCamposDependentes) {
            const container = document.getElementById("modal-dependentes-container");
            gerarCamposDependentes(container, "mod");

            // Preencher dependentes
            for (let i = 1; i <= 5; i++) {
                const nome = document.getElementById(`mod-dep${i}_nome`);
                const cpf = document.getElementById(`mod-dep${i}_cpf`);
                const data = document.getElementById(`mod-dep${i}_data_nascimento`);
                const select = document.getElementById(`mod-dep${i}_parentesco_select`);
                const outro = document.getElementById(`mod-dep${i}_parentesco_outro`);
                const hidden = document.getElementById(`mod-dep${i}_parentesco`);

                if (nome) nome.value = filiado[`dep${i}_nome`] || "";
                if (cpf) {
                    cpf.value = filiado[`dep${i}_cpf`] || "";
                    if (aplicarMascaraCPF) aplicarMascaraCPF(cpf);
                }
                if (data) data.value = filiado[`dep${i}_data_nascimento`] ? filiado[`dep${i}_data_nascimento`].split('T')[0] : "";

                const pVal = filiado[`dep${i}_parentesco`] || "";
                if (select && hidden) {
                    hidden.value = pVal;
                    const options = Array.from(select.options).map(o => o.value);
                    if (options.includes(pVal)) {
                        select.value = pVal;
                    } else if (pVal) {
                        select.value = "OUTRO";
                        if (outro) {
                            outro.value = pVal;
                            outro.style.display = "block";
                        }
                    }
                }
            }
        }

        form.querySelectorAll(".campo-telefone").forEach(inp => aplicarMascaraTelefone?.(inp));

        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const payload = {};
            fd.forEach((v, k) => { if (!k.includes("_select") && !k.includes("_outro")) payload[k] = v; });

            const onlyDigits = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").toString().replace(/\D/g, "");
            if (payload.telefone1) payload.telefone1 = onlyDigits(payload.telefone1);
            if (payload.cpf) payload.cpf = onlyDigits(payload.cpf);

            for (let i = 1; i <= 5; i++) {
                if (payload[`dep${i}_cpf`]) payload[`dep${i}_cpf`] = onlyDigits(payload[`dep${i}_cpf`]);
            }

            try {
                const r = await apiFetch(`/api/filiados/${id}`, { method: "PUT", body: payload });
                if (r.ok) {
                    alert("Sucesso!");
                    document.getElementById("modal-editar-filiado").style.display = "none";
                    await carregarLista();
                } else {
                    const err = await r.json();
                    alert(err.message || "Erro ao salvar.");
                }
            } catch (err) { alert("Erro de conexão."); }
        };
    }

    async function confirmarArquivar(id) {
        const motivo = prompt("Motivo do arquivamento:");
        if (!motivo) return;
        const { apiFetch } = global.Utils || {};
        const r = await apiFetch(`/api/filiados/${id}/arquivar`, { method: "POST", body: { motivo } });
        if (r.ok) {
            alert("Arquivado.");
            document.getElementById("modal-editar-filiado").style.display = "none";
            await carregarLista();
        }
    }

    async function confirmarDesarquivar(id) {
        const motivo = prompt("Motivo do desarquivamento (opcional):") || "Reativado via Web";
        const { apiFetch } = global.Utils || {};
        const r = await apiFetch(`/api/filiados/${id}/desarquivar`, { method: "POST", body: { motivo } });
        if (r.ok) {
            alert("Desarquivado.");
            document.getElementById("modal-editar-filiado").style.display = "none";
            await carregarLista();
        }
    }

    async function uploadAvatar(id) {
        const input = document.getElementById("modal-avatar-input");
        const file = input?.files?.[0];
        if (!file) { alert("Selecione um arquivo."); return; }

        const { apiFetch } = global.Utils || {};
        const fd = new FormData();
        fd.append("avatar", file);

        try {
            const r = await apiFetch(`/api/filiados/${id}/avatar`, { method: "POST", body: fd });
            if (r.ok) {
                const d = await r.json();
                document.getElementById("modal-avatar-preview").src = d.avatar_url;
                alert("Avatar atualizado.");
                await carregarLista();
            }
        } catch(e) { alert("Erro no upload."); }
    }

    async function removerAvatar(id) {
        if (!confirm("Remover foto?")) return;
        const { apiFetch } = global.Utils || {};
        try {
            const r = await apiFetch(`/api/filiados/${id}/avatar`, { method: "DELETE" });
            if (r.ok) {
                document.getElementById("modal-avatar-preview").src = "/img/avatar-placeholder.png";
                alert("Foto removida.");
                await carregarLista();
            }
        } catch(e) { alert("Erro ao remover."); }
    }

    function abrirNovoFiliado(container) {
        container.style.display = container.style.display === "none" ? "block" : "none";
    }

    function renderizarFormularioNovoFiliado(container) {
        if (!container) return;
        const { gerarCamposDependentes } = global.Utils || {};
        container.innerHTML = `
            <div class="filiado-card" style="border-left-color: var(--amarelo);">
                <h3>➕ Novo Filiado</h3>
                <form id="form-novo-filiado-admin">
                    <div class="edit-grid">
                        <div class="edit-group">
                            <label>Nome *</label>
                            <input name="nome" required>
                        </div>
                        <div class="edit-group">
                            <label>CPF *</label>
                            <input name="cpf" required placeholder="Apenas números">
                        </div>
                        <div class="edit-group">
                            <label>Email *</label>
                            <input type="email" name="email1" required>
                        </div>
                    </div>
                    <div id="novo-dependentes-container" style="margin-top:15px;"></div>
                    <div style="text-align:right; margin-top:15px;">
                        <button type="button" class="btn btn-outline" onclick="this.closest('.filiado-card').parentElement.style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Criar Cadastro</button>
                    </div>
                </form>
            </div>
        `;

        if (gerarCamposDependentes) {
            gerarCamposDependentes(container.querySelector("#novo-dependentes-container"), "new");
        }

        const form = container.querySelector("#form-novo-filiado-admin");
        form.onsubmit = async (e) => {
            e.preventDefault();
            const { apiFetch } = global.Utils || {};
            const fd = new FormData(form);
            const payload = {};
            fd.forEach((v, k) => { if (!k.includes("_select") && !k.includes("_outro")) payload[k] = v; });

            const onlyDigits = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").toString().replace(/\D/g, "");
            payload.cpf = onlyDigits(payload.cpf);

            try {
                const r = await apiFetch("/api/filiados", { method: "POST", body: payload });
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

    global.FiliadosAdmin = {
        inicializarFiliados,
        abrirModalEdicao,
        confirmarArquivar,
        confirmarDesarquivar,
        uploadAvatar,
        removerAvatar
    };

})(typeof window !== 'undefined' ? window : global);
