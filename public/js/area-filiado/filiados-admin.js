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
        perfilAtual = (perfil || "").toUpperCase();

        if (!listaEl) {
            const secFiliados = document.getElementById("sec-filiados");
            if (secFiliados) {
                const placeholder = perfilAtual === "FILIADO" ? "Buscar por nome..." : "Buscar por nome ou CPF...";
                secFiliados.innerHTML = `
                    <div class="search-box-container">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                            <h2 style="margin:0;">👥 Filiados</h2>
                            <button id="btn-novo-filiado" class="btn btn-primary" style="display:none;">+ Novo Filiado</button>
                        </div>
                        <input type="text" id="busca-filiados" placeholder="${placeholder}" style="width:100%; padding:10px; border-radius:8px; border:none; color:#333;">
                    </div>
                    <div id="novo-filiado-container" style="display:none; margin-bottom:20px;"></div>
                    <div id="lista-filiados"></div>
                `;
            }
        }

        const canManageProfiles = perfilAtual === "ADMIN" || perfilAtual === "DIRETORIA" || perfilAtual === "FUNCIONARIO";

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

        try {
            listaEl.innerHTML = `<p style="text-align:center; color:#fff;">Carregando...</p>`;
            const estado = (document.getElementById("filtro-estado-cadastro")?.value || "CADASTRO_ATIVO").toUpperCase();
            let url = "/api/filiados";
            if (estado !== "CADASTRO_ATIVO") url += "?incluirArquivados=1";

            const r = await window.Api.apiFetch(url);
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

        const { normalizeText, formatarCPF, formatarTelefoneTexto } = global.Utils || {};
        const tNorm = normalizeText ? normalizeText(termo) : (termo || "").toLowerCase();

        const onlyDigits = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").toString().replace(/\D/g, "");
        const tDigits = onlyDigits(termo);

        let res = cacheLista.filter(f => {
            const nomeNorm = normalizeText ? normalizeText(f.nome) : (f.nome || "").toLowerCase();
            const matchesNome = nomeNorm.includes(tNorm);

            let matchesCpf = false;
            if (perfilAtual !== "FILIADO") {
                const cpfDigits = onlyDigits(f.cpf);
                matchesCpf = tDigits && cpfDigits.includes(tDigits);
            }

            return matchesNome || matchesCpf;
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
            const situacao = (f.situacao || f.situacao_funcional || 'ATIVO').toUpperCase();
            const situacaoLower = situacao.toLowerCase();
            const classeStatus = `status-${situacaoLower}`;
            const nascimento = f.data_nascimento;
            const idade = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(nascimento) : '—';

            const tels = [f.telefone1, f.telefone2].filter(Boolean).map(t => formatarTelefoneTexto ? formatarTelefoneTexto(t) : t).join(" / ");

            return `
                <div class="filiado-card ${classeStatus}">
                    <div class="filiado-header">
                        <div class="filiado-left">
                            ${avatarHtml(f.avatar_url, f.nome)}
                            <div>
                                <div class="filiado-nome">${f.nome}</div>
                                <div class="filiado-meta">${f.cpf ? formatarCPF(f.cpf) + ' • ' : ''}${f.lotacao || 'SEDE'}</div>
                                ${perfilAtual === "FILIADO" ? '' : `
                                <div class="filiado-meta" style="font-size:0.8rem;">🎂 ${nascimento ? global.Formatters.formatISOToBR(nascimento) : '—'} (${idade})</div>
                                `}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span class="filiado-badge badge-${situacaoLower}">${situacao}</span>
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
        const nascimento = f.data_nascimento;
        const idade = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(nascimento) : '—';

        const canChangeProfile = ehAdmin || (["DIRETORIA", "FUNCIONARIO"].includes(perfilAtual) && f.perfil_acesso !== "ADMIN");

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
                        <input type="date" name="data_nascimento" id="edit-data-nascimento" value="${toDateInputValue ? toDateInputValue(f.data_nascimento) : ""}">
                    </div>
                    <div class="edit-group">
                        <label>Idade (Calculada)</label>
                        <input type="text" id="edit-idade-display" value="${idade}" readonly style="background:#f0f0f0;">
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
                        <select name="situacao">
                            ${SITUACAO_OPCOES.map(op => `<option value="${op}" ${(f.situacao || f.situacao_funcional || "").toUpperCase() === op ? "selected" : ""}>${op}</option>`).join("")}
                        </select>
                    </div>

                    <div class="edit-group">
                        <label>CEP</label>
                        <input name="cep" id="edit-cep" value="${f.cep || ""}" class="campo-cep">
                    </div>
                    <div class="edit-group span-2">
                        <label>Logradouro / Bairro</label>
                        <input name="logradouro_bairro" id="edit-logradouro" value="${f.logradouro_bairro || ""}" readonly style="background:#f0f0f0;">
                    </div>
                    <div class="edit-group">
                        <label>Número</label>
                        <input name="numero" value="${f.numero || ""}">
                    </div>
                    <div class="edit-group">
                        <label>Complemento</label>
                        <input name="complemento" value="${f.complemento || ""}">
                    </div>
                    <div class="edit-group">
                        <label>Cidade</label>
                        <input name="cidade" id="edit-cidade" value="${f.cidade || ""}" readonly style="background:#f0f0f0;">
                    </div>
                    <div class="edit-group">
                        <label>UF</label>
                        <input name="uf" id="edit-uf" value="${f.uf || ""}" readonly style="background:#f0f0f0;">
                    </div>

                    ${canChangeProfile ? `
                        <div class="edit-group">
                            <label>Perfil de Acesso</label>
                            <select name="perfil_acesso">
                                <option value="FILIADO" ${f.perfil_acesso === "FILIADO" ? "selected" : ""}>FILIADO</option>
                                <option value="FUNCIONARIO" ${f.perfil_acesso === "FUNCIONARIO" ? "selected" : ""}>FUNCIONÁRIO</option>
                                <option value="DIRETORIA" ${f.perfil_acesso === "DIRETORIA" ? "selected" : ""}>DIRETORIA</option>
                                ${ehAdmin ? `<option value="ADMIN" ${f.perfil_acesso === "ADMIN" ? "selected" : ""}>ADMIN</option>` : ""}
                            </select>
                        </div>
                    ` : `<input type="hidden" name="perfil_acesso" value="${f.perfil_acesso}">`}
                </div>

                <div class="edit-group span-2" style="margin-top:20px;">
                    <div class="dependentes-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom:1px solid #eee; padding-bottom:5px;">
                        <h4 style="margin:0;">Dependentes</h4>
                        <button type="button" id="btn-toggle-excluir-modal" class="btn btn-danger-outline btn-sm">Excluir</button>
                    </div>

                    <div id="painel-excluir-modal" style="display: none; background: #fff8f8; border: 1px solid #e57373; border-radius: 8px; padding: 15px; margin-top: 10px;">
                        <p style="margin-top:0; font-weight:bold;">Selecione os dependentes para remover:</p>
                        <div id="checkboxes-excluir-modal" style="display: flex; flex-direction: column; gap: 8px;"></div>
                        <div style="margin-top: 15px; text-align: right;">
                            <button type="button" id="btn-confirmar-exclusao-modal" class="btn btn-danger">Confirmar Exclusão</button>
                        </div>
                    </div>

                    <div id="modal-dependentes-container" style="margin-top:10px;"></div>
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
        const { gerarCamposDependentes, aplicarMascaraTelefone, aplicarMascaraCPF } = global.Utils || {};

        const filiado = cacheLista.find(f => f.id == id);

        if (gerarCamposDependentes) {
            const container = document.getElementById("modal-dependentes-container");
            gerarCamposDependentes(container, "mod");

            const dependentesAtuais = [];

            // Preencher dependentes
            for (let i = 1; i <= 5; i++) {
                if (filiado[`dep${i}_nome`]) {
                    dependentesAtuais.push({ nome: filiado[`dep${i}_nome`], index: i });
                }

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
                if (data) {
                    data.value = filiado[`dep${i}_data_nascimento`] ? filiado[`dep${i}_data_nascimento`].split('T')[0] : "";
                    const depIdade = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(data.value) : '—';
                    const idadeLabel = document.createElement('div');
                    idadeLabel.style.fontSize = '0.75rem';
                    idadeLabel.style.color = '#666';
                    idadeLabel.style.marginTop = '2px';
                    idadeLabel.className = 'dep-idade-calc';
                    idadeLabel.textContent = `Idade: ${depIdade}`;
                    data.insertAdjacentElement('afterend', idadeLabel);

                    data.onchange = () => {
                        idadeLabel.textContent = `Idade: ${global.AgeUtils ? global.AgeUtils.formatAgeDetailed(data.value) : '—'}`;
                    };
                }

                const pVal = filiado[`dep${i}_parentesco`] || "";
                if (select && hidden) {
                    hidden.value = pVal;
                    const options = Array.from(select.options).map(o => o.value);
                    // Se o valor estiver nas opções e NÃO for OUTRO, seleciona e esconde campo manual
                    if (pVal && pVal !== "OUTRO" && options.includes(pVal)) {
                        select.value = pVal;
                        if (outro) { outro.style.display = "none"; outro.value = ""; }
                    } else if (pVal) {
                        // Se for OUTRO ou valor customizado
                        select.value = "OUTRO";
                        if (outro) {
                            outro.value = (pVal === "OUTRO") ? "" : pVal;
                            outro.style.display = "block";
                        }
                    } else {
                        // Vazio
                        select.value = "";
                        if (outro) { outro.style.display = "none"; outro.value = ""; }
                    }
                }
            }

            // Lógica de Exclusão no Modal
            const btnToggleExcluir = document.getElementById("btn-toggle-excluir-modal");
            const painelExcluir = document.getElementById("painel-excluir-modal");
            const containerCheckboxes = document.getElementById("checkboxes-excluir-modal");
            const btnConfirmarExclusao = document.getElementById("btn-confirmar-exclusao-modal");

            if (dependentesAtuais.length === 0) {
                btnToggleExcluir.style.display = 'none';
            }

            btnToggleExcluir.onclick = () => {
                painelExcluir.style.display = painelExcluir.style.display === 'none' ? 'block' : 'none';
            };

            containerCheckboxes.innerHTML = '';
            dependentesAtuais.forEach(dep => {
                containerCheckboxes.innerHTML += `
                    <label style="display: flex; align-items: center; gap: 8px; font-weight:normal; cursor:pointer;">
                        <input type="checkbox" name="excluir_dep_index" value="${dep.index}" style="width: auto;">
                        Dependente ${dep.index}: ${dep.nome}
                    </label>
                `;
            });

            btnConfirmarExclusao.onclick = () => {
                const marcados = Array.from(containerCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
                if (!marcados.length) return alert("Selecione um dependente.");

                if (confirm(`Excluir ${marcados.length} dependente(s)?\n\nIsso limpará os campos e compactará a lista ao salvar.`)) {
                    marcados.forEach(idx => {
                        document.getElementById(`mod-dep${idx}_nome`).value = "";
                        document.getElementById(`mod-dep${idx}_cpf`).value = "";
                        document.getElementById(`mod-dep${idx}_data_nascimento`).value = "";
                        const select = document.getElementById(`mod-dep${idx}_parentesco_select`);
                        if (select) select.value = "";
                        const hidden = document.getElementById(`mod-dep${idx}_parentesco`);
                        if (hidden) hidden.value = "";
                        const outro = document.getElementById(`mod-dep${idx}_parentesco_outro`);
                        if (outro) { outro.value = ""; outro.style.display = "none"; }
                    });
                    painelExcluir.style.display = "none";
                    // Trigger submit to save and let backend compact
                    // Usamos requestSubmit se disponível para disparar a validação e o handler onsubmit
                    if (typeof form.requestSubmit === "function") {
                        form.requestSubmit();
                    } else {
                        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }
                }
            };
        }

        form.querySelectorAll(".campo-telefone").forEach(inp => aplicarMascaraTelefone?.(inp));
        const cepInput = form.querySelector(".campo-cep");
        if (cepInput) {
            global.Utils?.aplicarMascaraCEP?.(cepInput);
            cepInput.addEventListener('blur', async () => {
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
            });
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
            const payload = {};
            fd.forEach((v, k) => { if (!k.includes("_select") && !k.includes("_outro")) payload[k] = v; });

            const onlyDigits = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").toString().replace(/\D/g, "");
            if (payload.telefone1) payload.telefone1 = onlyDigits(payload.telefone1);
            if (payload.cpf) payload.cpf = onlyDigits(payload.cpf);

            for (let i = 1; i <= 5; i++) {
                if (payload[`dep${i}_cpf`]) payload[`dep${i}_cpf`] = onlyDigits(payload[`dep${i}_cpf`]);
            }

            try {
                const r = await window.Api.apiFetch(`/api/filiados/${id}`, { method: "PUT", body: payload });
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
        const r = await window.Api.apiFetch(`/api/filiados/${id}/arquivar`, { method: "POST", body: { motivo } });
        if (r.ok) {
            alert("Arquivado.");
            document.getElementById("modal-editar-filiado").style.display = "none";
            await carregarLista();
        }
    }

    async function confirmarDesarquivar(id) {
        const motivo = prompt("Motivo do desarquivamento (opcional):") || "Reativado via Web";
        const r = await window.Api.apiFetch(`/api/filiados/${id}/desarquivar`, { method: "POST", body: { motivo } });
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

        const fd = new FormData();
        fd.append("avatar", file);

        try {
            const r = await window.Api.apiFetch(`/api/filiados/${id}/avatar`, { method: "POST", body: fd });
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
        try {
            const r = await window.Api.apiFetch(`/api/filiados/${id}/avatar`, { method: "DELETE" });
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
                        <div class="edit-group">
                            <label>CEP</label>
                            <input name="cep" class="campo-cep" id="new-cep">
                        </div>
                        <div class="edit-group">
                            <label>Logradouro/Bairro</label>
                            <input name="logradouro_bairro" id="new-logradouro" readonly style="background:#f0f0f0;">
                        </div>
                        <div class="edit-group">
                            <label>Número</label>
                            <input name="numero">
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
        const cepInp = form.querySelector("#new-cep");
        if (cepInp) {
            global.Utils?.aplicarMascaraCEP?.(cepInp);
            cepInp.addEventListener('blur', async () => {
                const cep = (cepInp.value || "").replace(/\D/g, "");
                if (cep.length === 8) {
                    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    const data = await res.json();
                    if (!data.erro) {
                        document.getElementById("new-logradouro").value = `${data.logradouro} - ${data.bairro}`;
                        document.getElementById("new-cidade").value = data.localidade;
                        document.getElementById("new-uf").value = data.uf;
                    }
                }
            });
        }
        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const payload = {};
            fd.forEach((v, k) => { if (!k.includes("_select") && !k.includes("_outro")) payload[k] = v; });

            const onlyDigits = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").toString().replace(/\D/g, "");
            payload.cpf = onlyDigits(payload.cpf);

            try {
                const r = await window.Api.apiFetch("/api/filiados", { method: "POST", body: payload });
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

    function handleParentescoChange(selectEl, prefixo) {
        const value = selectEl.value;
        const index = selectEl.name.match(/\d+/)[0];
        const inputOutro = document.getElementById(`${prefixo}-dep${index}_parentesco_outro`);
        const inputHidden = document.getElementById(`${prefixo}-dep${index}_parentesco`);

        if (value === "OUTRO") {
            if (inputOutro) inputOutro.style.display = "block";
        } else {
            if (inputOutro) {
                inputOutro.style.display = "none";
                inputOutro.value = "";
            }
            if (inputHidden) inputHidden.value = value;
        }
    }

    // No local declarations of apiFetch here. Using window.Api.apiFetch everywhere.

    global.FiliadosAdmin = {
        inicializarFiliados,
        abrirModalEdicao,
        confirmarArquivar,
        confirmarDesarquivar,
        uploadAvatar,
        removerAvatar,
        handleParentescoChange
    };

})(typeof window !== 'undefined' ? window : global);
