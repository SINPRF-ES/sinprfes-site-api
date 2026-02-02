/**
 * Módulo Filiados Admin (Página Inicial)
 * Carregado como script clássico (window.FiliadosAdmin)
 */

(function (global) {
    if (global.FiliadosAdmin) return;

    let cacheLista = [];
    const SITUACAO_OPCOES = ["ATIVO", "VETERANO", "PENSIONISTA"];

    const LOTACAO_OPCOES = global.Canon?.LOTACOES || [
      "SEDE",
      "DEL 01 - Viana",
      "DEL 02 - Serra",
      "DEL 03 - Guarapari",
      "DEL 04 - Linhares",
      "NENHUMA"
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
        const apiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? "http://localhost:3000"
            : "https://api.sinprfes.org.br";

        const src = avatarUrl
            ? (avatarUrl.startsWith('http') ? avatarUrl : apiBase + avatarUrl)
            : "/img/avatar-placeholder.png";

        return `<img class="avatar-mini" src="${src}" alt="Avatar ${safeNome}" onerror="this.src='/img/avatar-placeholder.png'">`;
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

    async function inicializarFiliados(perfil) {
        perfilAtual = (perfil || "").toUpperCase();
        const secFiliados = document.getElementById("sec-filiados");
        if (!secFiliados) return;

        const ehGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);
        const placeholder = !ehGestao ? "Buscar por nome..." : "Buscar por nome ou CPF...";

        secFiliados.innerHTML = `
            <div class="af-standard-header">
                <h2>👥 Filiados</h2>
                <p class="section-subtitle">Gerencie o cadastro de membros e dependentes do sindicato.</p>
            </div>

            <div class="af-standard-card af-standard-form">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px;">
                    <div id="filiados-count" style="font-weight: 800; font-size: 1.4rem; color: var(--azul-fundo);">Total: 0</div>
                    ${ehGestao ? `<button id="btn-novo-filiado" class="btn btn-primary">+ Novo Filiado</button>` : ''}
                </div>

                <div class="field-group">
                    <label>🔍 Pesquisar</label>
                    <input type="text" id="busca-filiados" placeholder="${placeholder}">
                </div>

                <div class="field-row" style="margin-top: 20px;">
                    ${ehGestao ? `
                    <div class="field-group">
                        <label>Estado do Cadastro</label>
                        <select id="filtro-estado-cadastro">
                            <option value="CADASTRO_ATIVO" selected>Ativos</option>
                            <option value="ARQUIVADOS">Arquivados</option>
                            <option value="TODOS">Todos</option>
                        </select>
                    </div>` : '<input type="hidden" id="filtro-estado-cadastro" value="CADASTRO_ATIVO">'}

                    <div class="field-group">
                        <label>Situação / Lotação</label>
                        <select id="filtro-situacao-funcional">
                            <option value="TODOS" selected>Todos</option>
                            <option value="ATIVO">Ativo (Geral)</option>
                            <option value="VETERANO">Veterano</option>
                            <option value="PENSIONISTA">Pensionista</option>
                            <optgroup label="Ativos por Lotação">
                                <option value="SEDE">SEDE</option>
                                <option value="DEL 01 - Viana">DEL 01 - Viana</option>
                                <option value="DEL 02 - Serra">DEL 02 - Serra</option>
                                <option value="DEL 03 - Guarapari">DEL 03 - Guarapari</option>
                                <option value="DEL 04 - Linhares">DEL 04 - Linhares</option>
                                <option value="NENHUMA">NENHUMA</option>
                            </optgroup>
                        </select>
                    </div>
                </div>
            </div>

            <div id="novo-filiado-container" style="display:none; margin-bottom:30px;"></div>
            <div id="lista-filiados">
                <p style="text-align:center; padding: 40px; color:#666;">Carregando...</p>
            </div>
        `;

        if (ehGestao) {
            const btnNovo = document.getElementById("btn-novo-filiado");
            const containerNovo = document.getElementById("novo-filiado-container");
            btnNovo.onclick = () => abrirNovoFiliado(containerNovo);

            document.getElementById("filtro-estado-cadastro").addEventListener("change", carregarLista);
        }

        const campoBusca = document.getElementById("busca-filiados");
        campoBusca.addEventListener("input", (e) => filtrarLista(e.target.value));
        document.getElementById("filtro-situacao-funcional").addEventListener("change", () => filtrarLista(campoBusca.value));

        await carregarLista();
    }

    async function carregarLista() {
        const listaEl = document.getElementById("lista-filiados");
        if (!listaEl) return;

        try {
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
            listaEl.innerHTML = `<div class="af-standard-card" style="text-align:center; color:#e74c3c;">Erro ao carregar filiados.</div>`;
        }
    }

    function filtrarLista(termo) {
        const el = document.getElementById("lista-filiados");
        if (!el) return;

        const { filterFiliados, formatarCPF, formatarTelefoneTexto, normalizeText } = global.Utils || {};
        let res = filterFiliados ? filterFiliados(cacheLista, termo, { perfil: perfilAtual }) : cacheLista;

        const fSituacao = document.getElementById("filtro-situacao-funcional")?.value || "TODOS";
        if (fSituacao !== "TODOS") {
            const lotacoesLabels = ["SEDE", "DEL 01 - Viana", "DEL 02 - Serra", "DEL 03 - Guarapari", "DEL 04 - Linhares", "NENHUMA"];
            if (lotacoesLabels.includes(fSituacao)) {
                const keywords = {
                    "SEDE": "SEDE",
                    "DEL 01 - Viana": "VIANA",
                    "DEL 02 - Serra": "SERRA",
                    "DEL 03 - Guarapari": "GUARAPARI",
                    "DEL 04 - Linhares": "LINHARES",
                    "NENHUMA": "NENHUMA"
                };
                const keyword = keywords[fSituacao];
                res = res.filter(f => {
                    const s = (f.situacao_funcional || f.situacao || "ATIVO").toUpperCase();
                    let l = (f.lotacao || "SEDE").toUpperCase();
                    if (normalizeText) l = normalizeText(l).toUpperCase();
                    return s === "ATIVO" && l.includes(keyword);
                });
            } else {
                res = res.filter(f => (f.situacao_funcional || f.situacao || "ATIVO").toUpperCase() === fSituacao);
            }
        }

        const fEstado = document.getElementById("filtro-estado-cadastro")?.value || "CADASTRO_ATIVO";
        if (fEstado === "ARQUIVADOS") {
            res = res.filter(f => f.arquivado_em);
        } else if (fEstado === "CADASTRO_ATIVO") {
            res = res.filter(f => !f.arquivado_em);
        }

        const countEl = document.getElementById("filiados-count");
        if (countEl) countEl.textContent = `Total: ${res.length}`;

        if (!res.length) {
            el.innerHTML = `<div class="af-standard-card" style="text-align:center; color:#666;">Nenhum registro encontrado.</div>`;
            return;
        }

        const ehGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);

        el.innerHTML = res.map(f => {
            const situacao = (f.situacao || f.situacao_funcional || 'ATIVO').toUpperCase();
            const situacaoLower = situacao.toLowerCase();
            const nascimento = f.data_nascimento;
            const idade = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(nascimento) : '—';
            const tels = [f.telefone1, f.telefone2].filter(Boolean).map(t => formatarTelefoneTexto ? formatarTelefoneTexto(t) : t).join(" / ");

            return `
                <div class="af-standard-card" style="padding: 20px !important; margin-bottom: 15px !important;">
                    <div class="filiado-header">
                        <div class="filiado-left">
                            ${avatarHtml(f.avatar_url, f.nome)}
                            <div>
                                <div class="filiado-nome">${f.nome}</div>
                                <div class="filiado-meta">${f.cpf ? formatarCPF(f.cpf) + ' • ' : ''}${f.lotacao || 'SEDE'}</div>
                                ${!ehGestao ? '' : `
                                <div class="filiado-meta" style="font-size:0.8rem;">🎂 ${nascimento ? global.Formatters.formatISOToBR(nascimento) : '—'} (${idade})</div>
                                `}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span class="filiado-badge badge-${situacaoLower}">${situacao}</span>
                            <div style="margin-top:5px; font-size:0.85rem; color:#666;">${tels || '-'}</div>
                            ${ehGestao ? `<button class="btn btn-outline btn-sm" onclick="FiliadosAdmin.abrirModalEdicao(${f.id})" style="margin-top:10px;">✏️ Editar</button>` : ''}
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
        const ehGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);
        const isArquivado = !!f.arquivado_em;
        const nascimento = f.data_nascimento;
        const idade = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(nascimento) : '—';

        const userInfo = window.Utils && window.Utils.obterUserInfo ? window.Utils.obterUserInfo() : null;
        const isSelf = userInfo && String(f.id) === String(userInfo.id);
        const canChangeProfile = (ehAdmin || (["DIRETORIA", "FUNCIONARIO"].includes(perfilAtual) && f.perfil_acesso !== "ADMIN")) && !isSelf;

        const responsavel = f.arquivado_por_nome || (f.arquivado_por ? `ID ${f.arquivado_por}` : "—");

        return `
            <div id="alertas-modal"></div>

            <div class="status-bar-modal">
                <span>Estado: <strong>${isArquivado ? "ARQUIVADO" : "ATIVO"}</strong></span>
                <div>
                    ${isArquivado ?
                        `<button type="button" class="btn btn-outline btn-sm" onclick="FiliadosAdmin.confirmarDesarquivar(${f.id})">📤 Desarquivar</button>` :
                        `<button type="button" class="btn btn-outline btn-sm" onclick="FiliadosAdmin.confirmarArquivar(${f.id})">📥 Arquivar</button>`}
                </div>
            </div>

            ${isArquivado ? `
                <div class="archive-details">
                    <div class="archive-details-title">📋 Detalhes do arquivamento</div>
                    <div class="archive-details-grid">
                        <div class="archive-item"><strong>Arquivado por:</strong> <span>${responsavel}</span></div>
                        <div class="archive-item"><strong>Arquivado em:</strong> <span>${formatISOToBRDateTime(f.arquivado_em)}</span></div>
                        <div class="archive-item full-width"><strong>Motivo:</strong> <span>${f.arquivado_motivo || "—"}</span></div>
                    </div>
                </div>
            ` : ''}

            <form id="form-edicao-modal" class="af-standard-form">
                <div class="af-standard-card">
                    <h3>👤 Informações Pessoais</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Nome</label>
                            <input name="nome" value="${f.nome || ""}" required>
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
                            <input name="cpf" value="${f.cpf || ""}" ${ehGestao ? "" : "readonly"}>
                        </div>
                        <div class="field-group">
                            <label>Matrícula (SIAPE)</label>
                            <input name="siape" value="${f.siape || ""}" placeholder="6 ou 7 dígitos" maxlength="7" ${ehGestao ? "" : "readonly"}>
                        </div>
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
                    <div class="field-row">
                        <div class="field-group">
                            <label>Situação Funcional</label>
                            <select name="situacao">
                                ${SITUACAO_OPCOES.map(op => `<option value="${op}" ${(f.situacao || f.situacao_funcional || "").toUpperCase() === op ? "selected" : ""}>${op}</option>`).join("")}
                            </select>
                        </div>
                        <div class="field-group">
                            <label>Lotação</label>
                            <select name="lotacao">
                                <option value="">Selecione...</option>
                                ${LOTACAO_OPCOES.map(op => `<option value="${op}" ${f.lotacao === op ? "selected" : ""}>${op}</option>`).join("")}
                            </select>
                        </div>
                    </div>
                    ${canChangeProfile ? `
                        <div class="field-row">
                            <div class="field-group">
                                <label>Perfil de Acesso</label>
                                <select name="perfil_acesso">
                                    <option value="FILIADO" ${f.perfil_acesso === "FILIADO" ? "selected" : ""}>FILIADO</option>
                                    <option value="COMUNICADOR" ${f.perfil_acesso === "COMUNICADOR" ? "selected" : ""}>COMUNICADOR</option>
                                    <option value="ORGANIZADOR" ${f.perfil_acesso === "ORGANIZADOR" ? "selected" : ""}>ORGANIZADOR</option>
                                    <option value="FUNCIONARIO" ${f.perfil_acesso === "FUNCIONARIO" ? "selected" : ""}>FUNCIONÁRIO</option>
                                    <option value="DIRETORIA" ${f.perfil_acesso === "DIRETORIA" ? "selected" : ""}>DIRETORIA</option>
                                    ${ehAdmin ? `<option value="ADMIN" ${f.perfil_acesso === "ADMIN" ? "selected" : ""}>ADMIN</option>` : ""}
                                </select>
                            </div>
                            <div class="field-group"></div>
                        </div>
                    ` : `<input type="hidden" name="perfil_acesso" value="${f.perfil_acesso}">`}
                </div>

                <div class="af-standard-card" style="background: #f8fafc !important;">
                    <h3>📞 Contato</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Email 1</label>
                            <input name="email1" value="${f.email1 || ""}">
                        </div>
                        <div class="field-group">
                            <label>Telefone 1</label>
                            <input name="telefone1" class="campo-telefone" value="${f.telefone1 || ""}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Email 2</label>
                            <input name="email2" value="${f.email2 || ""}">
                        </div>
                        <div class="field-group">
                            <label>Telefone 2</label>
                            <input name="telefone2" class="campo-telefone" value="${f.telefone2 || ""}">
                        </div>
                    </div>
                </div>

                <div class="af-standard-card">
                    <h3>🏠 Endereço</h3>
                    <div class="address-grid-v2">
                        <div class="field-group">
                            <label>CEP</label>
                            <div class="cep-input-wrapper">
                                <input name="cep" id="edit-cep" value="${f.cep || ""}" class="campo-cep">
                                <span class="cep-search-icon">🔍</span>
                            </div>
                        </div>
                        <div class="field-group">
                            <label>Logradouro / Bairro</label>
                            <input name="logradouro_bairro" id="edit-logradouro" value="${f.logradouro_bairro || ""}" readonly style="background:#f8f9fa;">
                        </div>
                        <div class="field-group">
                            <label>Número</label>
                            <input name="numero" value="${f.numero || ""}">
                        </div>
                        <div class="field-group">
                            <label>Complemento</label>
                            <input name="complemento" value="${f.complemento || ""}">
                        </div>
                        <div class="field-group">
                            <label>Cidade</label>
                            <input name="cidade" id="edit-cidade" value="${f.cidade || ""}" readonly style="background:#f8f9fa;">
                        </div>
                        <div class="field-group">
                            <label>UF</label>
                            <input name="uf" id="edit-uf" value="${f.uf || ""}" readonly style="background:#f8f9fa;">
                        </div>
                    </div>
                </div>

                <div class="af-standard-card" style="background: #f8fafc !important;">
                    <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 25px; position: relative;">
                        <h3 style="margin: 0; border:none;">👨‍👩‍👧‍👦 Dependentes (até 5)</h3>
                        <button type="button" id="btn-toggle-excluir-modal" class="btn btn-outline btn-sm" style="position: absolute; right: 0;">🗑️ Gerenciar</button>
                    </div>

                    <div id="painel-excluir-modal" style="display: none; background: #fff; border: 1px solid #e74c3c; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
                        <p style="margin-top:0; font-weight:bold; color:#e74c3c;">Selecione os dependentes para remover:</p>
                        <div id="checkboxes-excluir-modal" style="display: flex; flex-direction: column; gap: 10px;"></div>
                        <div style="margin-top: 20px; text-align: right;">
                            <button type="button" id="btn-confirmar-exclusao-modal" class="btn btn-danger" style="background:#e74c3c; color:#fff;">Confirmar Exclusão</button>
                        </div>
                    </div>

                    <div id="modal-dependentes-container"></div>
                </div>

                <div class="af-standard-card">
                    <h3>🖼️ Avatar (Foto)</h3>
                    <div style="display: flex; gap: 25px; align-items: center; flex-wrap: wrap;">
                        <img id="modal-avatar-preview" class="avatar-preview" src="${f.avatar_url || '/img/avatar-placeholder.png'}" alt="Preview" onerror="this.src='/img/avatar-placeholder.png'" style="width:120px; height:120px; border-radius:15px; object-fit:cover; border:3px solid var(--amarelo);">
                        <div style="flex:1; min-width:250px; display:flex; flex-direction:column; gap:12px;">
                            <input type="file" id="modal-avatar-input" accept="image/*">
                            <div style="display:flex; gap:10px;">
                                <button type="button" class="btn btn-primary" onclick="FiliadosAdmin.uploadAvatar(${f.id})" style="flex:1;">📤 Upload</button>
                                <button type="button" class="btn btn-outline" onclick="FiliadosAdmin.removerAvatar(${f.id})" style="flex:1; border-color:#e74c3c; color:#e74c3c;">🗑️ Remover</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer-actions">
                    <button type="button" class="btn btn-outline" style="padding: 12px 40px;" onclick="document.getElementById('modal-editar-filiado').style.display='none'">Cancelar</button>
                    <button type="submit" class="btn btn-primary" style="padding: 12px 50px;">💾 Salvar Alterações</button>
                </div>
            </form>
        `;
    }

    function configurarFormEdicao(id) {
        const form = document.getElementById("form-edicao-modal");
        const { gerarCamposDependentes, aplicarMascaraTelefone, aplicarMascaraCPF } = global.Utils || {};

        if (aplicarMascaraCPF) {
            const cpfInput = form.querySelector('input[name="cpf"]');
            if (cpfInput) aplicarMascaraCPF(cpfInput);
        }

        const filiado = cacheLista.find(f => f.id == id);

        if (gerarCamposDependentes) {
            const container = document.getElementById("modal-dependentes-container");
            gerarCamposDependentes(container, "mod");

            const dependentesAtuais = [];
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
                    if (pVal && pVal !== "OUTRO" && options.includes(pVal)) {
                        select.value = pVal;
                        if (outro) { outro.style.display = "none"; outro.value = ""; }
                    } else if (pVal) {
                        select.value = "OUTRO";
                        if (outro) {
                            outro.value = (pVal === "OUTRO") ? "" : pVal;
                            outro.style.display = "block";
                        }
                    } else {
                        select.value = "";
                        if (outro) { outro.style.display = "none"; outro.value = ""; }
                    }
                }
            }

            const btnToggleExcluir = document.getElementById("btn-toggle-excluir-modal");
            const painelExcluir = document.getElementById("painel-excluir-modal");
            const containerCheckboxes = document.getElementById("checkboxes-excluir-modal");
            const btnConfirmarExclusao = document.getElementById("btn-confirmar-exclusao-modal");

            if (dependentesAtuais.length === 0) btnToggleExcluir.style.display = 'none';

            btnToggleExcluir.onclick = () => {
                painelExcluir.style.display = painelExcluir.style.display === 'none' ? 'block' : 'none';
            };

            containerCheckboxes.innerHTML = '';
            dependentesAtuais.forEach(dep => {
                containerCheckboxes.innerHTML += `
                    <label style="display: flex; align-items: center; gap: 10px; font-weight:normal; cursor:pointer;">
                        <input type="checkbox" name="excluir_dep_index" value="${dep.index}" style="width: auto !important;">
                        <span>Dependente ${dep.index}: ${dep.nome}</span>
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
                    if (typeof form.requestSubmit === "function") form.requestSubmit();
                    else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            };
        }

        form.querySelectorAll(".campo-telefone").forEach(inp => aplicarMascaraTelefone?.(inp));
        const cepInput = form.querySelector(".campo-cep");

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
            fd.forEach((v, k) => { if (!k.includes("_select") && !k.includes("_outro")) rawPayload[k] = v; });

            const onlyDigits = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").toString().replace(/\D/g, "");
            const ehGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);

            const payload = {};
            Object.keys(rawPayload).forEach(key => {
                let val = rawPayload[key];
                if (typeof val === 'string') val = val.trim();
                if (val === "" || val === null || val === undefined || val === "Selecione...") return;
                if (!ehGestao && (key === 'sexo' || key === 'cpf' || key === 'siape')) return;
                if (key === 'nome' || key.includes('_nome')) {
                    if (global.Canon?.normalizeNome) val = global.Canon.normalizeNome(val);
                }
                if (key === 'cpf' || key.includes('_cpf') || key === 'telefone1' || key === 'telefone2' || key === 'cep' || key === 'siape') {
                    val = onlyDigits(val);
                }
                payload[key] = val;
            });

            if (payload.cpf && payload.cpf.length !== 11) {
                alert("O CPF deve ter exatamente 11 dígitos.");
                return;
            }

            try {
                const url = `/api/filiados/${id}`;
                const r = await window.Api.apiFetch(url, { method: "PUT", body: payload });
                const data = await r.json();

                if (r.ok) {
                    alert("Sucesso!");
                    document.getElementById("modal-editar-filiado").style.display = "none";
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
                const apiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
                    ? "http://localhost:3000"
                    : "https://api.sinprfes.org.br";

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
            const r = await window.Api.apiFetch(`/api/filiados/${id}/avatar`, { method: "DELETE" });
            if (r.ok) {
                document.getElementById("modal-avatar-preview").src = "/img/avatar-placeholder.png";
                alert("Foto removida.");
                await carregarLista();
            }
        } catch(e) { alert("Erro ao remover."); }
    }

    function abrirNovoFiliado(container) {
        if (container.style.display === "none") {
            renderizarFormularioNovoFiliado(container);
            container.style.display = "block";
            container.scrollIntoView({ behavior: 'smooth' });
        } else {
            container.style.display = "none";
        }
    }

    function renderizarFormularioNovoFiliado(container) {
        if (!container) return;
        const { gerarCamposDependentes, aplicarMascaraTelefone, aplicarMascaraCPF, aplicarMascaraCEP, aplicarMascaraData } = global.Utils || {};

        container.innerHTML = `
            <div class="af-standard-card af-standard-form">
                <h3 style="border-bottom-color: var(--azul-fundo) !important;">👤 Novo Filiado</h3>
                <form id="form-novo-filiado-admin">
                    <div class="field-row">
                        <div class="field-group">
                            <label>Nome *</label>
                            <input name="nome" required>
                        </div>
                        <div class="field-group">
                            <label>Sexo</label>
                            <select name="sexo">
                                <option value="" selected>-</option>
                                <option value="M">♂️ Masculino</option>
                                <option value="F">♀️ Feminino</option>
                            </select>
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>CPF *</label>
                            <input name="cpf" required placeholder="000.000.000-00">
                        </div>
                        <div class="field-group">
                            <label>Matrícula (SIAPE)</label>
                            <input name="siape" placeholder="6 ou 7 dígitos" maxlength="7">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Email Principal *</label>
                            <input type="email" name="email1" required>
                        </div>
                        <div class="field-group">
                            <label>Telefone 1 *</label>
                            <input name="telefone1" class="campo-telefone" required placeholder="(00) 00000-0000">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Data Nascimento</label>
                            <input name="data_nascimento" class="campo-data" placeholder="DD/MM/AAAA">
                        </div>
                        <div class="field-group"></div>
                    </div>

                    <div style="margin: 25px 0; border-top: 1px dashed #ccc; padding-top: 25px;">
                        <h4 style="margin-bottom: 15px; color: var(--azul-fundo);">🏠 Endereço</h4>
                        <div class="field-row">
                            <div class="field-group">
                                <label>CEP</label>
                                <div class="cep-input-wrapper">
                                    <input name="cep" id="new-cep" class="campo-cep" placeholder="00000-000">
                                    <span class="cep-search-icon">🔍</span>
                                </div>
                            </div>
                            <div class="field-group">
                                <label>Logradouro / Bairro</label>
                                <input name="logradouro_bairro" id="new-logradouro" readonly style="background:#f9f9f9;">
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field-group">
                                <label>Número</label>
                                <input name="numero">
                            </div>
                            <div class="field-group">
                                <label>Complemento</label>
                                <input name="complemento">
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field-group">
                                <label>Cidade</label>
                                <input name="cidade" id="new-cidade" readonly style="background:#f9f9f9;">
                            </div>
                            <div class="field-group">
                                <label>UF</label>
                                <input name="uf" id="new-uf" readonly style="background:#f9f9f9;">
                            </div>
                        </div>
                    </div>

                    <div id="novo-dependentes-container" style="margin-top:25px;"></div>

                    <div style="text-align:right; margin-top:35px; border-top: 1px solid #eee; padding-top: 25px;">
                        <button type="button" class="btn btn-outline" style="margin-right:10px;" onclick="this.closest('.af-standard-card').parentElement.style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="padding: 12px 60px;">🚀 Criar Cadastro</button>
                    </div>
                </form>
            </div>
        `;

        if (gerarCamposDependentes) gerarCamposDependentes(container.querySelector("#novo-dependentes-container"), "new");

        const form = container.querySelector("#form-novo-filiado-admin");
        if (aplicarMascaraCPF) aplicarMascaraCPF(form.querySelector('input[name="cpf"]'));
        if (aplicarMascaraTelefone) aplicarMascaraTelefone(form.querySelector('input[name="telefone1"]'));
        if (aplicarMascaraData) aplicarMascaraData(form.querySelector('input[name="data_nascimento"]'));

        const cepInp = form.querySelector("#new-cep");
        if (cepInp) {
            if (aplicarMascaraCEP) aplicarMascaraCEP(cepInp);
            const buscar = async () => {
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
            };
            cepInp.addEventListener('blur', buscar);
            form.querySelector(".cep-search-icon").onclick = buscar;
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const payload = {};
            fd.forEach((v, k) => { if (!k.includes("_select") && !k.includes("_outro")) payload[k] = v; });

            if (payload.nome && global.Canon?.normalizeNome) payload.nome = global.Canon.normalizeNome(payload.nome);
            for (let i = 1; i <= 5; i++) {
                if (payload[`dep${i}_nome`] && global.Canon?.normalizeNome) {
                    payload[`dep${i}_nome`] = global.Canon.normalizeNome(payload[`dep${i}_nome`]);
                }
            }

            const onlyDigits = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").toString().replace(/\D/g, "");
            const cpfLimp = onlyDigits(payload.cpf);
            if (cpfLimp.length !== 11) { alert("O CPF deve ter exatamente 11 dígitos."); return; }
            payload.cpf = cpfLimp;
            if (payload.telefone1) payload.telefone1 = onlyDigits(payload.telefone1);

            if (payload.data_nascimento) {
                const iso = global.Formatters ? global.Formatters.parseBRToISO(payload.data_nascimento) : null;
                if (payload.data_nascimento.includes('/') && !iso) { alert("Data de nascimento inválida."); return; }
                if (iso) payload.data_nascimento = iso;
            }

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
            if (inputOutro) { inputOutro.style.display = "none"; inputOutro.value = ""; }
            if (inputHidden) inputHidden.value = value;
        }
    }

    global.FiliadosAdmin = {
        inicializarFiliados,
        abrirModalEdicao,
        confirmarArquivar,
        confirmarDesarquivar,
        uploadAvatar,
        removerAvatar,
        handleParentescoChange,
        abrirNovoFiliado
    };

})(typeof window !== 'undefined' ? window : global);
