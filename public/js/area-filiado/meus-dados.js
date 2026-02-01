/**
 * Módulo Meus Dados (Página Inicial)
 * Carregado como script clássico (window.MeusDados)
 */

(function (global) {
    if (global.MeusDados) return;

    function formatarDataBR(isoStr) {
        if (global.Formatters) return global.Formatters.formatISOToBR(isoStr);
        if (!isoStr) return "";
        try {
            const parts = isoStr.split('T')[0].split('-');
            if (parts.length !== 3) return isoStr;
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        } catch (e) {
            return isoStr;
        }
    }

    function compactarDependentes(filiado) {
        const dependentesValidos = [];
        for (let i = 1; i <= 5; i++) {
            if (filiado[`dep${i}_nome`]) {
                dependentesValidos.push({
                    nome: filiado[`dep${i}_nome`],
                    cpf: filiado[`dep${i}_cpf`],
                    data_nascimento: filiado[`dep${i}_data_nascimento`],
                    parentesco: filiado[`dep${i}_parentesco`]
                });
            }
        }

        // Limpa todos os slots originais
        for (let i = 1; i <= 5; i++) {
            filiado[`dep${i}_nome`] = null;
            filiado[`dep${i}_cpf`] = null;
            filiado[`dep${i}_data_nascimento`] = null;
            filiado[`dep${i}_parentesco`] = null;
        }

        // Preenche sequencialmente
        dependentesValidos.forEach((dep, idx) => {
            const i = idx + 1;
            filiado[`dep${i}_nome`] = dep.nome;
            filiado[`dep${i}_cpf`] = dep.cpf;
            filiado[`dep${i}_data_nascimento`] = dep.data_nascimento;
            filiado[`dep${i}_parentesco`] = dep.parentesco;
        });
    }

    async function carregarMeusDados() {
        if (!window.Api.apiFetch) return null;

        const conteudo = document.getElementById("area-filiado-conteudo");
        const alerta = document.getElementById("alerta-endereco-desatualizado");

        if (!conteudo) return null;
        conteudo.innerHTML = "Carregando seus dados...";
        if (alerta) alerta.style.display = 'none';

        try {
            const resp = await window.Api.apiFetch("/api/filiados/me");
            if (!resp.ok) throw new Error();
            const dados = await resp.json();

            // Compactar dependentes antes de renderizar
            compactarDependentes(dados);

            // Alerta de endereço
            if ((!dados.cep || dados.cep === "") && alerta) {
                alerta.textContent = " Por favor, atualize seu endereço.";
                alerta.style.display = 'block';
            }

            renderizarFormularioMeusDados(dados, conteudo);
            if (global.Seguranca && global.Seguranca.renderizarSeguranca) {
                global.Seguranca.renderizarSeguranca(dados, carregarMeusDados);
            }
            if (global.Ressarcimento && global.Ressarcimento.preencherFormularioRessarcimentoComDados) {
                global.Ressarcimento.preencherFormularioRessarcimentoComDados(dados);
            }

            return dados;
        } catch (e) {
            console.error(e);
            conteudo.innerHTML = "<p>Erro ao carregar dados.</p>";
            return null;
        }
    }

    function renderizarFormularioMeusDados(dados, container) {
        const {
            nome, cpf, situacao, situacao_funcional, perfil_acesso,
            telefone1, telefone2, email1, email2,
            logradouro_bairro, numero, complemento, cidade, uf, cep, lotacao,
            avatar_url
        } = dados;

        const { aplicarMascaraTelefone, aplicarMascaraCEP, aplicarMascaraCPF, gerarCamposDependentes, formatarCPF } = global.Utils || {};

        let situacaoRaw = (situacao || situacao_funcional || "NÃO INFORMADO").toUpperCase();
        // Strip "[OK] " or "OK " prefixes
        const situacaoUpper = situacaoRaw.replace(/^(\[OK\]\s*|OK\s*)/i, "");
        let corStatus = '#95a5a6'; // Cinza
        let classeBadge = 'badge-desconhecido';

        if (situacaoUpper === 'ATIVO') {
            corStatus = '#27ae60';
            classeBadge = 'badge-ativo';
        } else if (situacaoUpper === 'VETERANO') {
            corStatus = '#f39c12';
            classeBadge = 'badge-veterano';
        } else if (situacaoUpper === 'PENSIONISTA') {
            corStatus = '#e91e63';
            classeBadge = 'badge-pensionista';
        }

        const opcoes = ["SEDE", "1ª DEL (Viana)", "2ª DEL (Serra)", "3ª DEL (Guarapari)", "4ª DEL (Linhares)"]
            .map(op => `<option value="${op}" ${String(lotacao || "SEDE").toUpperCase() === op.toUpperCase() ? "selected" : ""}>${op}</option>`)
            .join("");

        if (!document.getElementById('style-meus-dados')) {
            const s = document.createElement('style');
            s.id = 'style-meus-dados';
            s.textContent = `
                .profile-header {
                    background: linear-gradient(135deg, #003366 0%, #00152b 100%);
                    color: #fff;
                    padding: 35px 30px;
                    border-radius: 15px;
                    border-bottom: 6px solid #ffc107;
                    margin-bottom: 25px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    display: flex;
                    justify-content: center;
                }
                .profile-header-inner {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 40px;
                    text-align: left;
                }
                .header-left-col {
                    flex: 0 0 auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 15px;
                }
                .header-right-col {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .profile-name-title {
                    margin: 0;
                    font-size: 2rem;
                    color: #fff;
                    font-weight: 800;
                }
                .profile-badges { display: flex; gap: 10px; margin-top: 5px; flex-wrap: wrap; }
                .badge {
                    padding: 6px 15px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: bold;
                    display: inline-block;
                    color: #333;
                }
                .badge-perfil { background: #3498db; color: #fff; }
                .badge-ativo { background: #27ae60; }
                .badge-veterano { background: #f39c12; }
                .badge-pensionista { background: #e91e63; }
                .badge-desconhecido { background: #95a5a6; }
                .data-card {
                    background: #fff;
                    color: #333;
                    padding: 25px;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    margin-bottom: 20px;
                    border: 1px solid #e0e0e0;
                    transition: background-color 0.3s ease;
                }
                .data-card.bg-alt { background-color: #f7f9fc; }
                .data-card h3 {
                    color: #003366;
                    font-size: 1.2rem;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                    font-weight: bold;
                    text-align: center;
                }
                .data-card input, .data-card select {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ccc;
                    border-radius: 6px;
                    color: #333;
                    background-color: #fff;
                    font-size: 1rem;
                    box-sizing: border-box;
                }
                .data-card input:focus, .data-card select:focus {
                    border-color: #003366;
                    outline: none;
                    background-color: #f9fbff;
                }
                .data-card label {
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: #555;
                    margin-bottom: 5px;
                    display: block;
                }
                input[readonly] {
                    background-color: #f8f9fa;
                    color: #666;
                    border-color: #eee;
                    cursor: not-allowed;
                }
                .field-row { display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:12px; }
                .field-group { display:flex; flex-direction:column; gap:6px; }

                /* ✅ CEP alinhado como na gestão */
                .cep-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                #me-cep {
                    max-width: 180px;   /* controla o tamanho visual */
                }
                #btn-buscar-cep {
                    width: 44px;
                    min-width: 44px;
                    height: 42px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                }

                /* Avatar Row Renovado - Agora no Topo */
                .profile-header-avatar-section { display: flex; flex-direction: column; align-items: center; gap: 10px; }
                .avatar-row { display:flex; gap:15px; align-items:center; flex-wrap:wrap; }
                .avatar-preview {
                    width:90px; height:90px; border-radius:50%;
                    background:#f1f3f5;
                    border:3px solid #ffc107;
                    overflow:hidden;
                    display:flex; align-items:center; justify-content:center;
                    flex-shrink:0; position: relative;
                }
                .avatar-preview img { width:100%; height:100%; object-fit:cover; display:block; }
                .avatar-fallback { font-size: 32px; color:#6c757d; }

                .avatar-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; }
                .avatar-buttons { display: flex; gap: 8px; justify-content: center; }
                .avatar-buttons button { padding: 5px 12px; font-size: 0.75rem; }
                .btn-upload-label {
                    background: rgba(255,255,255,0.1); color: #fff; padding: 8px 16px; border-radius: 8px;
                    font-size: 0.8rem; cursor: pointer; text-align: center; border: 1px solid rgba(255,255,255,0.3);
                    transition: all 0.2s; display: inline-block;
                    font-weight: 600;
                }
                .btn-upload-label:hover { background: rgba(255,255,255,0.2); }
                #me-avatar-file { display: none; }

                .form-actions { margin-top: 35px; text-align: center; }

                /* Zebra striping for dependents */
                .dependente-card:nth-child(even) { background-color: #ffffff; }
                .dependente-card:nth-child(odd) { background-color: #f7f9fc; }

                @media (max-width: 768px) {
                    .profile-header {
                        padding: 30px 20px;
                    }
                    .profile-header-inner {
                        flex-direction: column;
                        text-align: center;
                        gap: 25px;
                    }
                    .header-right-col {
                        align-items: center;
                        min-width: unset;
                    }
                    .profile-name-title {
                        font-size: 1.6rem;
                    }
                    .profile-badges {
                        justify-content: center;
                    }
                }
            `;
            document.head.appendChild(s);
        }

        const avatarUrlSafe = (avatar_url || "").toString().trim();
        const apiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? "http://localhost:3000"
            : "https://api.sinprfes.org.br";

        const avatarFullUrl = avatarUrlSafe
            ? (avatarUrlSafe.startsWith('http') ? avatarUrlSafe : apiBase + avatarUrlSafe)
            : null;

        const avatarImg = avatarFullUrl
            ? `<img src="${avatarFullUrl}" alt="Avatar" onerror="this.remove();">`
            : `<div class="avatar-fallback"></div>`;

        // AgeUtils é carregado como global em area-filiado.html
        const idadeTxt = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(dados.data_nascimento) : '—';

        const situacaoLower = situacaoUpper.toLowerCase();
        const ehGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes((perfil_acesso || "").toUpperCase());

        container.innerHTML = `
            <div class="profile-header">
                <div class="profile-header-inner">
                    <div class="header-left-col">
                        <div class="avatar-preview" id="avatar-preview">${avatarImg}</div>
                        <div class="avatar-actions">
                            <label class="btn-upload-label" for="me-avatar-file">Alterar Foto</label>
                            <input type="file" id="me-avatar-file" accept="image/*" />
                            <div class="avatar-buttons">
                                <button type="button" class="btn btn-primary btn-sm" id="btn-salvar-foto" style="display:none;">Salvar</button>
                                <button type="button" class="btn btn-danger btn-sm" id="btn-remover-foto">Remover</button>
                            </div>
                        </div>
                    </div>
                    <div class="header-right-col">
                        <h2 class="profile-name-title">${nome || ""}</h2>
                        <div class="profile-badges">
                            <span class="badge badge-perfil">${(perfil_acesso || "").toUpperCase()}</span>
                            <span class="badge badge-${situacaoLower}">${situacaoUpper}</span>
                        </div>
                    </div>
                </div>
            </div>

            <form id="form-meus-dados">
                <div class="data-card">
                    <h3>👤 Informações Pessoais</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>CPF</label>
                            <input type="text" value="${formatarCPF ? formatarCPF(cpf || "") : cpf}" readonly />
                        </div>
                        <div class="field-group">
                            <label>Data de Nascimento</label>
                            <input type="text" value="${formatarDataBR(dados.data_nascimento)}" readonly />
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Idade</label>
                            <input type="text" value="${idadeTxt}" readonly />
                        </div>
                        <div class="field-group">
                            <label>Lotação</label>
                            <select id="me-lotacao">
                                ${opcoes}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="data-card bg-alt">
                    <h3>📞 Contato</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Telefone 1</label>
                            <input type="text" id="me-telefone1" value="${telefone1 || ""}" />
                        </div>
                        <div class="field-group">
                            <label>Telefone 2</label>
                            <input type="text" id="me-telefone2" value="${telefone2 || ""}" />
                        </div>
                    </div>

                    <div class="field-row">
                        <div class="field-group">
                            <label>Email 1</label>
                            <input type="email" id="me-email1" value="${email1 || ""}" />
                        </div>
                        <div class="field-group">
                            <label>Email 2</label>
                            <input type="email" id="me-email2" value="${email2 || ""}" />
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
                                <input type="text" id="me-cep" value="${cep || ""}" placeholder="00000-000" class="campo-cep" />
                                <span class="cep-search-icon" id="btn-buscar-cep" style="cursor:pointer;">🔍</span>
                            </div>
                        </div>
                        <div class="edit-group logradouro-group">
                            <label>Logradouro / Bairro</label>
                            <input type="text" id="me-endereco" value="${logradouro_bairro || ""}" readonly style="background:#f0f0f0;" />
                        </div>

                        <!-- Linha 2: Número + Complemento -->
                        <div class="edit-group">
                            <label>Número</label>
                            <input type="text" id="me-numero" value="${numero || ""}" />
                        </div>
                        <div class="edit-group">
                            <label>Complemento</label>
                            <input type="text" id="me-complemento" value="${complemento || ""}" />
                        </div>

                        <!-- Linha 3: Cidade + UF -->
                        <div class="edit-group">
                            <label>Cidade</label>
                            <input type="text" id="me-cidade" value="${cidade || ""}" readonly style="background:#f0f0f0;" />
                        </div>
                        <div class="edit-group">
                            <label>UF</label>
                            <input type="text" id="me-uf" value="${uf || ""}" readonly style="background:#f0f0f0;" />
                        </div>
                    </div>
                </div>

                <div class="data-card bg-alt">
                    <div class="dependentes-header" style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 25px; position: relative;">
                        <h3 style="margin: 0;">👶 Dependentes (até 5)</h3>
                        <button type="button" id="btn-toggle-excluir-dependentes" class="btn btn-danger-outline btn-sm" style="position: absolute; right: 0;">Excluir</button>
                    </div>

                    <div id="painel-excluir-dependentes" style="display: none; background: #fff8f8; border: 1px solid #e57373; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <p style="margin-top:0; font-weight:bold;">Selecione os dependentes para remover:</p>
                        <div id="checkboxes-excluir-dependentes" style="display: flex; flex-direction: column; gap: 8px;">
                            <!-- Checkboxes serão inseridos aqui -->
                        </div>
                        <div style="margin-top: 15px; text-align: right;">
                            <button type="button" id="btn-confirmar-exclusao-dependentes" class="btn btn-danger">Confirmar Exclusão</button>
                        </div>
                    </div>

                    <div id="dependentes-container-meus-dados">
                        <!-- Campos dos dependentes serão inseridos aqui -->
                    </div>
                </div>

                <div class="form-actions">
                    <span id="meus-dados-status" class="field-hint" style="display: block; margin-bottom: 10px; font-weight:bold;"></span>
                    <button type="submit" class="btn btn-primary btn-lg" style="padding: 15px 50px; font-size: 1.2rem; border-radius: 50px; box-shadow: 0 4px 15px rgba(241, 196, 15, 0.3);">Salvar Dados</button>
                </div>
            </form>

            ${ehGestao ? `
                <div class="data-card" style="margin-top: 40px; border-top: 4px solid #003366;">
                    <h3>🛠️ Módulos de Gestão</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px;">
                        <button type="button" class="btn btn-outline" style="height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;" onclick="document.querySelector('.af-nav-item[data-target=\'sec-repasse\']').click()">
                            <span style="font-size: 2rem;">💱</span>
                            <span>Repasse por Localidade</span>
                        </button>
                    </div>
                </div>
            ` : ''}
        `;

        // --- MÁSCARAS ---
        if (aplicarMascaraTelefone) {
            aplicarMascaraTelefone(document.getElementById("me-telefone1"));
            aplicarMascaraTelefone(document.getElementById("me-telefone2"));
        }

        const cepInput = document.getElementById("me-cep");
        if (aplicarMascaraCEP) aplicarMascaraCEP(cepInput);

        // --- DEPENDENTES ---
        const containerDependentes = document.getElementById("dependentes-container-meus-dados");
        if (gerarCamposDependentes) gerarCamposDependentes(containerDependentes, 'me');

        for (let i = 1; i <= 5; i++) {
            const nome = document.getElementById(`me-dep${i}_nome`);
            const cpfEl = document.getElementById(`me-dep${i}_cpf`);
            const dataNascimento = document.getElementById(`me-dep${i}_data_nascimento`);

            if (nome) nome.value = dados[`dep${i}_nome`] || '';
            if (cpfEl) {
                cpfEl.value = dados[`dep${i}_cpf`] || '';
                if (aplicarMascaraCPF) aplicarMascaraCPF(cpfEl);
            }
            if (dataNascimento) {
                dataNascimento.value = dados[`dep${i}_data_nascimento`] ? dados[`dep${i}_data_nascimento`].split('T')[0] : '';
                const depIdade = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(dataNascimento.value) : '—';
                const idadeLabel = document.createElement('div');
                idadeLabel.style.fontSize = '0.75rem';
                idadeLabel.style.color = '#666';
                idadeLabel.style.marginTop = '2px';
                idadeLabel.textContent = `Idade: ${depIdade}`;
                dataNascimento.insertAdjacentElement('afterend', idadeLabel);
                dataNascimento.onchange = () => {
                    idadeLabel.textContent = `Idade: ${global.AgeUtils ? global.AgeUtils.formatAgeDetailed(dataNascimento.value) : '—'}`;
                };
            }

            // Lógica para preencher o campo de parentesco (select + outro)
            const parentescoValor = dados[`dep${i}_parentesco`] || '';
            const selectParentesco = document.getElementById(`me-dep${i}_parentesco_select`);
            const inputOutro = document.getElementById(`me-dep${i}_parentesco_outro`);
            const inputHidden = document.getElementById(`me-dep${i}_parentesco`);

            if (selectParentesco && inputOutro && inputHidden) {
                inputHidden.value = parentescoValor;
                const opcoesPadrao = Array.from(selectParentesco.options).map(opt => opt.value);

                if (opcoesPadrao.includes(parentescoValor)) {
                    selectParentesco.value = parentescoValor;
                    inputOutro.style.display = 'none';
                    inputOutro.value = '';
                } else if (parentescoValor) {
                    selectParentesco.value = 'Outro';
                    inputOutro.style.display = 'block';
                    inputOutro.value = parentescoValor;
                } else {
                    selectParentesco.value = '';
                    inputOutro.style.display = 'none';
                    inputOutro.value = '';
                }
            }
        }

        // --- LÓGICA DE EXCLUSÃO DE DEPENDENTES ---
        const dependentesAtuais = [];
        for (let i = 1; i <= 5; i++) {
            if (dados[`dep${i}_nome`]) {
                dependentesAtuais.push({
                    nome: dados[`dep${i}_nome`],
                    index: i - 1
                });
            }
        }

        const btnToggleExcluir = document.getElementById("btn-toggle-excluir-dependentes");
        const painelExcluir = document.getElementById("painel-excluir-dependentes");
        const containerCheckboxes = document.getElementById("checkboxes-excluir-dependentes");
        const btnConfirmarExclusao = document.getElementById("btn-confirmar-exclusao-dependentes");

        if (dependentesAtuais.length === 0) {
            btnToggleExcluir.style.display = 'none';
        }

        btnToggleExcluir.onclick = () => {
            painelExcluir.style.display = painelExcluir.style.display === 'none' ? 'block' : 'none';
        };

        containerCheckboxes.innerHTML = '';
        dependentesAtuais.forEach(dep => {
            containerCheckboxes.innerHTML += `
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" name="excluir_dependente" value="${dep.index}" style="width: auto;">
                    Dependente ${dep.index + 1}: ${dep.nome}
                </label>
            `;
        });

        btnConfirmarExclusao.onclick = async () => {
            const checkboxesMarcados = containerCheckboxes.querySelectorAll('input:checked');
            const indicesParaExcluir = Array.from(checkboxesMarcados).map(cb => parseInt(cb.value, 10));

            if (indicesParaExcluir.length === 0) {
                alert("Selecione pelo menos um dependente para excluir.");
                return;
            }

            if (confirm(`Tem certeza que deseja excluir ${indicesParaExcluir.length} dependente(s)? Esta ação não pode ser desfeita.`)) {
                try {
                    const r = await window.Api.apiFetch(`/api/filiados/${dados.id}/dependentes`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ indices: indicesParaExcluir })
                    });

                    if (r.ok) {
                        alert("Dependentes excluídos com sucesso.");
                        await carregarMeusDados();
                    } else {
                        const err = await r.json();
                        alert(err.message || "Erro ao excluir dependentes.");
                    }
                } catch (e) {
                    alert("Erro de conexão ao tentar excluir os dependentes.");
                }
            }
        };

        // --- CEP ---
        document.getElementById("btn-buscar-cep").onclick = buscarCep;
        cepInput.onblur = () => {
            const onlyDigitsFn = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").replace(/\D/g, "");
            if (cepInput.value && onlyDigitsFn(cepInput.value).length === 8) buscarCep();
        };

        // --- SUBMIT DADOS (PUT /me) ---
        document.getElementById("form-meus-dados").onsubmit = async (e) => {
            e.preventDefault();
            const status = document.getElementById("meus-dados-status");
            status.textContent = "Salvando...";

            const form = e.target;
            const formData = new FormData(form);
            const rawPayload = {};

            for (const [key, value] of formData.entries()) {
                rawPayload[key] = value;
            }

            // Compactar dependentes antes de enviar
            const dependentesCompactados = [];
            for (let i = 1; i <= 5; i++) {
                const n = rawPayload[`dep${i}_nome`];
                const c = rawPayload[`dep${i}_cpf`];
                const d = rawPayload[`dep${i}_data_nascimento`];
                const p = rawPayload[`dep${i}_parentesco`];
                if (n || c || d || p) {
                    dependentesCompactados.push({ n, c, d, p });
                }
            }

            const payload = { ...rawPayload };

            // Normalização de Nomes (Canônico)
            if (payload.nome && global.Canon?.normalizeNome) {
                payload.nome = global.Canon.normalizeNome(payload.nome);
            }
            for (let i = 1; i <= 5; i++) {
                if (payload[`dep${i}_nome`] && global.Canon?.normalizeNome) {
                    payload[`dep${i}_nome`] = global.Canon.normalizeNome(payload[`dep${i}_nome`]);
                }
            }

            // Limpa slots no payload
            for (let i = 1; i <= 5; i++) {
                payload[`dep${i}_nome`] = "";
                payload[`dep${i}_cpf`] = "";
                payload[`dep${i}_data_nascimento`] = "";
                payload[`dep${i}_parentesco`] = "";
            }
            // Preenche sequencialmente
            dependentesCompactados.forEach((dep, idx) => {
                const i = idx + 1;
                payload[`dep${i}_nome`] = dep.n;
                payload[`dep${i}_cpf`] = dep.c;
                payload[`dep${i}_data_nascimento`] = dep.d;
                payload[`dep${i}_parentesco`] = dep.p;
            });

            const onlyDigitsFn = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").replace(/\D/g, "");

            // Adiciona campos que não estão no form ou precisam de normalização
            payload.telefone1 = onlyDigitsFn(document.getElementById("me-telefone1").value);
            payload.telefone2 = onlyDigitsFn(document.getElementById("me-telefone2").value);
            payload.email1 = document.getElementById("me-email1").value;
            payload.email2 = document.getElementById("me-email2").value;
            payload.logradouro_bairro = document.getElementById("me-endereco").value;
            payload.numero = document.getElementById("me-numero").value;
            payload.complemento = document.getElementById("me-complemento").value;
            payload.cidade = document.getElementById("me-cidade").value;
            payload.uf = document.getElementById("me-uf").value;
            payload.cep = onlyDigitsFn(document.getElementById("me-cep").value);
            payload.lotacao = document.getElementById("me-lotacao").value;

            // Sanitiza CPF dos dependentes
            for (let i = 1; i <= 5; i++) {
                const key = `dep${i}_cpf`;
                if (payload[key]) {
                    payload[key] = onlyDigitsFn(payload[key]);
                }
            }

            try {
                const r = await window.Api.apiFetch("/api/filiados/me", { method: "PUT", body: payload });
                if (r.ok) {
                    await carregarMeusDados();
                    alert("Dados salvos com sucesso!");
                } else {
                    status.textContent = "Erro ao salvar.";
                    try {
                        const d = await r.json();
                        if (d?.message) alert(d.message);
                    } catch {}
                }
            } catch (e) {
                status.textContent = "Erro de conexão.";
            }
        };

        // --- UPLOAD DE AVATAR ---
        const inputFile = document.getElementById("me-avatar-file");
        const previewContainer = document.getElementById("avatar-preview");
        const btnSalvarFoto = document.getElementById("btn-salvar-foto");
        const btnRemoverFoto = document.getElementById("btn-remover-foto");

        inputFile.onchange = () => {
            const file = inputFile.files && inputFile.files[0];
            if (file) {
                const urlLocal = URL.createObjectURL(file);
                previewContainer.innerHTML = `<img src="${urlLocal}" style="width:100%; height:100%; object-fit:cover;" />`;
                btnSalvarFoto.style.display = "inline-block";
            }
        };

        btnSalvarFoto.onclick = async () => {
            const file = inputFile.files && inputFile.files[0];
            if (!file) return;

            const originalText = btnSalvarFoto.innerText;
            btnSalvarFoto.disabled = true;
            btnSalvarFoto.innerText = "Enviando...";

            const fd = new FormData();
            fd.append("avatar", file);

            try {
                const r = await window.Api.apiFetch("/api/filiados/me/avatar", { method: "POST", body: fd });
                if (r.ok) {
                    alert("Foto atualizada com sucesso!");
                    btnSalvarFoto.style.display = "none";
                    inputFile.value = "";
                } else {
                    alert("Erro ao enviar foto.");
                }
            } catch (e) {
                alert("Erro de conexão.");
            } finally {
                btnSalvarFoto.disabled = false;
                btnSalvarFoto.innerText = originalText;
            }
        };

        btnRemoverFoto.onclick = async () => {
          if (!confirm("Remover a foto de perfil?")) return;

          btnRemoverFoto.disabled = true;
          const txt = btnRemoverFoto.innerText;
          btnRemoverFoto.innerText = "Removendo...";

          try {
            const r = await window.Api.apiFetch("/api/filiados/me/avatar", { method: "DELETE" });
            if (r.ok) {
              alert("Foto removida com sucesso!");
              previewContainer.innerHTML = `<div class="avatar-fallback"></div>`;
              inputFile.value = "";
              btnSalvarFoto.style.display = "none";
            } else {
              alert("Erro ao remover foto.");
            }
          } catch {
            alert("Erro de conexão.");
          } finally {
            btnRemoverFoto.disabled = false;
            btnRemoverFoto.innerText = txt;
          }
        };
    }

    async function buscarCep() {
        const onlyDigitsFn = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").replace(/\D/g, "");
        const cep = onlyDigitsFn(document.getElementById("me-cep").value || "");
        if (cep.length !== 8) {
            alert("Informe um CEP válido (8 dígitos).");
            return;
        }

        try {
            const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const d = await r.json();
            if (d?.erro) {
                alert("CEP não encontrado.");
                return;
            }

            document.getElementById("me-endereco").value = d.logradouro || "";
            document.getElementById("me-cidade").value = d.localidade || "";
            document.getElementById("me-uf").value = d.uf || "";
        } catch (e) {
            alert("Erro ao buscar CEP.");
        }
    }

    global.MeusDados = {
        carregarMeusDados,
        labelSituacaoFuncional: (valor) => `Situação funcional do servidor: ${(valor || 'ATIVO').toString().toUpperCase()}`,
        labelEstadoCadastro: (filiado) => {
            const raw = (filiado && (filiado.estado_cadastro || (filiado.arquivado_em ? 'ARQUIVADO' : 'CADASTRO_ATIVO'))) || 'CADASTRO_ATIVO';
            const txt = raw === 'CADASTRO_ATIVO' ? 'CADASTRO ATIVO' : 'ARQUIVADO';
            return `Estado do cadastro: ${txt}`;
        }
    };
})(typeof window !== 'undefined' ? window : global);
