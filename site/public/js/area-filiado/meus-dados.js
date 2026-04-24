/**
 * Módulo Meus Dados (Página Inicial)
 * Carregado como script clássico (window.MeusDados)
 */

(function (window) {
    if (window.MeusDados) return;

    function formatarDataBR(isoStr) {
        if (window.Formatters) return window.Formatters.formatISOToBR(isoStr);
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
            if (filiado[`dep${i}_nome`] || filiado[`dep${i}_cpf`] || filiado[`dep${i}_data_nascimento`] || filiado[`dep${i}_parentesco` ] || filiado[`dep${i}_parentesco_outro` ]) {
                dependentesValidos.push({
                    nome: filiado[`dep${i}_nome`],
                    cpf: filiado[`dep${i}_cpf`],
                    data_nascimento: filiado[`dep${i}_data_nascimento`],
                    parentesco: filiado[`dep${i}_parentesco`],
                    parentesco_outro: filiado[`dep${i}_parentesco_outro`]
                });
            }
        }

        // Limpa todos os slots originais
        for (let i = 1; i <= 5; i++) {
            filiado[`dep${i}_nome`] = null;
            filiado[`dep${i}_cpf`] = null;
            filiado[`dep${i}_data_nascimento`] = null;
            filiado[`dep${i}_parentesco`] = null;
            filiado[`dep${i}_parentesco_outro`] = null;
        }

        // Preenche sequencialmente
        dependentesValidos.forEach((dep, idx) => {
            const i = idx + 1;
            filiado[`dep${i}_nome`] = dep.nome;
            filiado[`dep${i}_cpf`] = dep.cpf;
            filiado[`dep${i}_data_nascimento`] = dep.data_nascimento;
            filiado[`dep${i}_parentesco`] = dep.parentesco;
            filiado[`dep${i}_parentesco_outro`] = dep.parentesco_outro;
        });
    }

    async function carregarMeusDados() {
        if (!window.Api?.apiFetch) {
            console.warn("[MeusDados] Api wrapper indisponível.");
            return null;
        }

        const conteudo = document.getElementById("area-filiado-conteudo");
        const alerta = document.getElementById("alerta-endereco-desatualizado");

        if (!conteudo) {
            console.warn("[MeusDados] Container #area-filiado-conteudo não encontrado.");
            return null;
        }

        conteudo.innerHTML = `<div class="ui-card" role="status" aria-live="polite"><p style="margin:0; text-align:center; color: var(--ui-text-muted);">⌛ Carregando seus dados...</p></div>`;
        if (alerta) alerta.style.display = 'none';

        try {
            const resp = await window.Api.apiFetch("/api/filiados/me");
            const requestId = resp.headers?.get("x-request-id") || resp.headers?.get("cf-ray") || "n/d";

            if (!resp.ok) {
                let msg = "Não foi possível carregar seus dados agora.";
                if (resp.status === 401) msg = "Sua sessão expirou. Faça login novamente.";
                else if (resp.status === 403) msg = "Você não possui permissão para visualizar seus dados.";
                else if (resp.status >= 500) msg = "Serviço temporariamente indisponível. Tente novamente em instantes.";
                conteudo.innerHTML = `<div class="ui-card" role="alert"><h3 style="margin-top:0; color:#b91c1c;">Erro ao carregar Meus Dados</h3><p style="margin:0 0 8px 0;">${msg}</p><small style="color:var(--ui-text-muted);">Código: ${resp.status} · Request ID: ${requestId}</small></div>`;
                return null;
            }

            const dados = await resp.json();

            // Compactar dependentes antes de renderizar
            compactarDependentes(dados);

            // Alerta de endereço
            if ((!dados.cep || dados.cep === "") && alerta) {
                alerta.textContent = " Por favor, atualize seu endereço.";
                alerta.style.display = 'block';
            }

            renderizarFormularioMeusDados(dados, conteudo);
            if (window.Seguranca && window.Seguranca.renderizarSeguranca) {
                window.Seguranca.renderizarSeguranca(dados, carregarMeusDados);
            }
            if (window.Ressarcimento && window.Ressarcimento.preencherFormularioRessarcimentoComDados) {
                window.Ressarcimento.preencherFormularioRessarcimentoComDados(dados);
            }

            return dados;
        } catch (e) {
            conteudo.innerHTML = `<div class="ui-card" role="alert"><h3 style="margin-top:0; color:#b91c1c;">Erro ao carregar Meus Dados</h3><p style="margin:0;">Falha de conexão ao buscar seus dados. Verifique sua internet e tente novamente.</p></div>`;
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

        const { aplicarMascaraTelefone, aplicarMascaraCEP, aplicarMascaraCPF, gerarCamposDependentes, formatarCPF } = window.Utils || {};

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

        const lotacoesParaSelect = (window.Canon && window.Canon.LOTACOES) ? window.Canon.LOTACOES : ["SEDE", "DEL 01 - Viana", "DEL 02 - Serra", "DEL 03 - Guarapari", "DEL 04 - Linhares", "NENHUMA"];
        const currentLotNorm = (window.Canon && window.Canon.normalizeLotacao) ? window.Canon.normalizeLotacao(lotacao || "SEDE") : (lotacao || "SEDE").toUpperCase();
        const opcoes = lotacoesParaSelect
            .map(op => {
                const opNorm = (window.Canon && window.Canon.normalizeLotacao) ? window.Canon.normalizeLotacao(op) : op.toUpperCase();
                return `<option value="${op}" ${currentLotNorm === opNorm ? "selected" : ""}>${op}</option>`;
            })
            .join("");

        if (!document.getElementById('style-meus-dados')) {
            const s = document.createElement('style');
            s.id = 'style-meus-dados';
            s.textContent = `
                .profile-header {
                    background: linear-gradient(135deg, var(--ui-primary) 0%, #00152b 100%);
                    color: #fff;
                    padding: var(--ui-space-5);
                    border-radius: var(--ui-radius);
                    border-bottom: 6px solid var(--ui-secondary);
                    margin-bottom: var(--ui-space-4);
                    box-shadow: var(--ui-shadow);
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
                .profile-header .profile-name-title {
                    margin: 0;
                    font-size: 2rem;
                    color: #f8fafc !important;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
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
                .ui-card {
                    background: var(--ui-surface);
                    color: var(--ui-text);
                    padding: var(--ui-space-4);
                    border-radius: var(--ui-radius);
                    box-shadow: var(--ui-shadow);
                    margin-bottom: var(--ui-space-3);
                    border: 1px solid var(--ui-border);
                    transition: background-color 0.3s ease;
                }
                .ui-card.bg-alt { background-color: var(--ui-bg); }
                .ui-card h3 {
                    color: var(--ui-primary);
                    font-size: 1.2rem;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                    font-weight: bold;
                    text-align: center;
                }
                .ui-card input, .ui-card select {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--ui-border);
                    border-radius: var(--ui-radius);
                    color: var(--ui-text);
                    background-color: var(--ui-surface);
                    font-size: 1rem;
                    box-sizing: border-box;
                }
                .ui-card input:focus, .ui-card select:focus {
                    border-color: var(--ui-primary);
                    outline: none;
                    background-color: #f9fbff;
                }
                .ui-card label {
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
                #me-cep {
                    max-width: 180px;   /* controla o tamanho visual */
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

                .invalid-field {
                    border-color: #e74c3c !important;
                    background-color: #fdf2f2 !important;
                }
                .field-error-msg {
                    color: #e74c3c;
                    font-size: 0.75rem;
                    font-weight: 600;
                    margin-top: 4px;
                    display: block;
                }

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
        const { resolveApiBase } = window.Utils || {};
        const apiBase = resolveApiBase
            ? resolveApiBase()
            : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || "").replace(/\/+$/, "");

        const avatarFullUrl = avatarUrlSafe
            ? (avatarUrlSafe.startsWith('http') ? avatarUrlSafe : apiBase + avatarUrlSafe)
            : null;

        const avatarImg = avatarFullUrl
            ? `<img src="${avatarFullUrl}" alt="Avatar" onerror="this.remove();">`
            : `<div class="avatar-fallback"></div>`;

        // AgeUtils é carregado como global em area-filiado.html
        const idadeTxt = window.AgeUtils ? window.AgeUtils.formatAgeDetailed(dados.data_nascimento) : '—';

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
                <div class="ui-card">
                    <h3>👤 Informações Pessoais</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Nome</label>
                            <input class="ui-input" type="text" value="${nome || ""}" readonly />
                        </div>
                        <div class="field-group">
                            <label>Sexo</label>
                            <div style="padding: 10px; border: 1px solid #eee; border-radius: 6px; background-color: #f8f9fa; color: #666; font-size: 1rem; cursor: not-allowed;">
                                ${dados.sexo === 'M' ? '♂️ Masculino' : (dados.sexo === 'F' ? '♀️ Feminino' : '—')}
                                <input type="hidden" id="me-sexo" value="${dados.sexo || ''}" />
                            </div>
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>CPF</label>
                            <input class="ui-input" type="text" value="${formatarCPF ? formatarCPF(cpf || "") : cpf}" readonly />
                        </div>
                        <div class="field-group">
                            <label>Matrícula (SIAPE)</label>
                            <input class="ui-input" type="text" id="me-siape" value="${dados.siape || "-"}" readonly />
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Data de Nascimento</label>
                            <input class="ui-input" type="text" value="${formatarDataBR(dados.data_nascimento)}" readonly />
                        </div>
                        <div class="field-group">
                            <label>Idade</label>
                            <input class="ui-input" type="text" value="${idadeTxt}" readonly />
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Lotação</label>
                            <select class="ui-select" id="me-lotacao">
                                ${opcoes}
                            </select>
                        </div>
                        <div class="field-group"></div>
                    </div>
                </div>

                <div class="ui-card bg-alt">
                    <h3>📞 Contato</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Telefone 1</label>
                            <input class="ui-input" type="text" id="me-telefone1" value="${telefone1 || ""}" />
                        </div>
                        <div class="field-group">
                            <label>Telefone 2</label>
                            <input class="ui-input" type="text" id="me-telefone2" value="${telefone2 || ""}" />
                        </div>
                    </div>

                    <div class="field-row">
                        <div class="field-group">
                            <label>Email 1</label>
                            <input class="ui-input" type="email" id="me-email1" value="${email1 || ""}" />
                        </div>
                        <div class="field-group">
                            <label>Email 2</label>
                            <input class="ui-input" type="email" id="me-email2" value="${email2 || ""}" />
                        </div>
                    </div>
                </div>

                <div class="ui-card">
                    <h3>🏠 Endereço</h3>
                    <div class="address-grid-v2">
                        <!-- Linha 1: CEP + Logradouro -->
                        <div class="edit-group cep-group">
                            <label>CEP</label>
                            <div class="cep-input-wrapper">
                                <input class="ui-input campo-cep" type="text" id="me-cep" value="${cep || ""}" placeholder="00000-000" />
                                <button type="button" class="cep-search-btn cep-search-icon" id="btn-buscar-cep" title="Buscar endereço pelo CEP" aria-label="Buscar endereço pelo CEP">🔍</button>
                            </div>
                        </div>
                        <div class="edit-group logradouro-group">
                            <label>Logradouro / Bairro</label>
                            <input class="ui-input" type="text" id="me-endereco" value="${logradouro_bairro || ""}" readonly style="background:#f0f0f0;" />
                        </div>

                        <!-- Linha 2: Número + Complemento -->
                        <div class="edit-group">
                            <label>Número</label>
                            <input class="ui-input" type="text" id="me-numero" value="${numero || ""}" />
                        </div>
                        <div class="edit-group">
                            <label>Complemento</label>
                            <input class="ui-input" type="text" id="me-complemento" value="${complemento || ""}" />
                        </div>

                        <!-- Linha 3: Cidade + UF -->
                        <div class="edit-group">
                            <label>Cidade</label>
                            <input class="ui-input" type="text" id="me-cidade" value="${cidade || ""}" readonly style="background:#f0f0f0;" />
                        </div>
                        <div class="edit-group">
                            <label>UF</label>
                            <input class="ui-input" type="text" id="me-uf" value="${uf || ""}" readonly style="background:#f0f0f0;" />
                        </div>
                    </div>
                </div>

                <div class="ui-card bg-alt">
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
                const depIdade = window.AgeUtils ? window.AgeUtils.formatAgeDetailed(dataNascimento.value) : '—';
                const idadeLabel = document.createElement('div');
                idadeLabel.style.fontSize = '0.75rem';
                idadeLabel.style.color = '#666';
                idadeLabel.style.marginTop = '2px';
                idadeLabel.textContent = `Idade: ${depIdade}`;
                dataNascimento.insertAdjacentElement('afterend', idadeLabel);
                dataNascimento.onchange = () => {
                    idadeLabel.textContent = `Idade: ${window.AgeUtils ? window.AgeUtils.formatAgeDetailed(dataNascimento.value) : '—'}`;
                };
            }

            // Lógica para preencher o campo de parentesco (select + outro)
            const parentescoValor = dados[`dep${i}_parentesco`] || '';
            const parentescoOutroValor = dados[`dep${i}_parentesco_outro`] || '';
            const selectParentesco = document.getElementById(`me-dep${i}_parentesco_select`);
            const inputOutro = document.getElementById(`me-dep${i}_parentesco_outro`);
            const inputHidden = document.getElementById(`me-dep${i}_parentesco`);

            if (selectParentesco && inputOutro && inputHidden) {
                inputHidden.value = parentescoValor;
                if (parentescoValor === 'OUTRO') {
                    selectParentesco.value = 'OUTRO';
                    inputOutro.style.display = 'block';
                    inputOutro.value = parentescoOutroValor;
                } else if (parentescoValor) {
                    selectParentesco.value = parentescoValor;
                    inputOutro.style.display = 'none';
                    inputOutro.value = '';
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
                    <input type="checkbox" style="width:auto;" name="excluir_dependente" value="${dep.index}" style="width: auto;">
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
                    const r = await window.Api.apiFetch(`/api/filiados/me/dependentes`, {
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
            const onlyDigitsFn = (v) => window.Formatters ? window.Formatters.onlyDigits(v) : (v || "").replace(/\D/g, "");
            if (cepInput.value && onlyDigitsFn(cepInput.value).length === 8) buscarCep();
        };

  // --- SUBMIT DADOS (PUT /me) ---
  document.getElementById("form-meus-dados").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;

    function limparErros() {
      form.querySelectorAll('.invalid-field').forEach(el => el.classList.remove('invalid-field'));
      form.querySelectorAll('.field-error-msg').forEach(el => el.remove());
    }
    limparErros();

    const status = document.getElementById("meus-dados-status");
    const btnSubmit = form.querySelector('button[type="submit"]');
    const originalBtnHtml = btnSubmit ? btnSubmit.innerHTML : "Salvar Dados";

    // Funções utilitárias locais para garantir limpeza dos dados
    const onlyDigits = (v) => (v || "").toString().replace(/\D/g, "");
    const val = (id) => (document.getElementById(id)?.value ?? "").trim();
    const nul = (s) => (s === "" || s === undefined) ? null : s;

    // ✅ VALIDAÇÃO OBRIGATÓRIA (UX Local)
    const t1 = val("me-telefone1");
    const e1 = val("me-email1");
    if (!t1) {
      alert("Telefone 1 é obrigatório.");
      document.getElementById("me-telefone1").focus();
      return;
    }
    if (!e1) {
      alert("E-mail 1 é obrigatório.");
      document.getElementById("me-email1").focus();
      return;
    }

    status.textContent = "Salvando...";
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span aria-hidden="true" class="ui-spinner"></span> Salvando...';
      btnSubmit.setAttribute("aria-busy", "true");
    }

    // ✅ COLETA DE DADOS (Camada 1: Pick from Whitelist)
    // Ref: shared/canon.js -> ME_EDITABLE_FIELDS_FILIADO
    const allPossibleFields = {
      telefone1: nul(onlyDigits(val("me-telefone1"))),
      telefone2: nul(onlyDigits(val("me-telefone2"))),
      email1: nul(val("me-email1")),
      email2: nul(val("me-email2")),
      cep: nul(onlyDigits(val("me-cep"))),
      logradouro_bairro: nul(val("me-endereco")),
      numero: nul(val("me-numero")),
      complemento: nul(val("me-complemento")),
      cidade: nul(val("me-cidade")),
      uf: nul(val("me-uf")),
      lotacao: nul(val("me-lotacao")),
    };

    const payload = {};
    const whitelist = (window.Canon && window.Canon.ME_EDITABLE_FIELDS_FILIADO) || Object.keys(allPossibleFields);
    whitelist.forEach(f => {
      if (allPossibleFields[f] !== undefined) payload[f] = allPossibleFields[f];
    });

    // ✅ DEPENDENTES - COMPACTAÇÃO E DERIVAÇÃO DE PARENTESCO
    const dependentesCompactados = [];
    for (let i = 1; i <= 5; i++) {
      const nome = nul(val(`me-dep${i}_nome`));
      const cpf  = nul(onlyDigits(val(`me-dep${i}_cpf`)));
      const dn   = nul(val(`me-dep${i}_data_nascimento`));

      // Derivação correta: select + outro
      const selPar = val(`me-dep${i}_parentesco_select`);
      const outPar = val(`me-dep${i}_parentesco_outro`);

      if (nome || cpf || dn || selPar || outPar) {
        dependentesCompactados.push({
          nome,
          cpf,
          data_nascimento: dn ? `${dn}T00:00:00.000Z` : null,
          parentesco: nul(selPar),
          parentesco_outro: (selPar === 'OUTRO') ? nul(outPar) : null
        });
      }
    }

    // Preenche slots 1..5 sequencialmente com os dados compactados
    for (let i = 1; i <= 5; i++) {
      const dep = dependentesCompactados[i - 1] || null;
      payload[`dep${i}_nome`] = dep ? dep.nome : null;
      payload[`dep${i}_cpf`] = dep ? dep.cpf : null;
      payload[`dep${i}_data_nascimento`] = dep ? dep.data_nascimento : null;
      payload[`dep${i}_parentesco`] = dep ? dep.parentesco : null;
      payload[`dep${i}_parentesco_outro`] = dep ? dep.parentesco_outro : null;
    }

    // Camada 2: “assert final” (defensivo)
    const forbidden = ["sexo", "siape", "cpf", "nome", "situacao", "data_nascimento", "me_sexo", "me_siape"];
    forbidden.forEach(f => delete payload[f]);

    // 🔎 DEBUG TEMPORÁRIO (Instrumentação solicitada para detectar vazamentos)
    if (window.DEBUG_API) {
      console.log("[DEBUG PUT /me] keys:", Object.keys(payload).sort());
      console.log("[DEBUG PUT /me] payload:", payload);
      console.trace("[DEBUG PUT /me] Envio disparado");
    }

    try {
      const r = await window.Api.apiFetch("/api/filiados/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        await carregarMeusDados();
        alert("Dados salvos com sucesso!");
        status.textContent = "";
        return;
      }

      status.textContent = "Erro ao salvar.";

      // Restore field-specific error highlighting
      try {
        const d = await r.json();
        console.warn("[DEBUG ERRO BACKEND]", r.status, d);

        if (d?.fields) {
          Object.keys(d.fields).forEach(key => {
            let fieldId = `me-${key.replace(/_/g, '-')}`;
            if (key === 'logradouro_bairro') fieldId = 'me-endereco';

            const el = document.getElementById(fieldId);
            if (el) {
              el.classList.add('invalid-field');
              const span = document.createElement('span');
              span.className = 'field-error-msg';
              span.textContent = d.fields[key];
              el.insertAdjacentElement('afterend', span);
            }
          });
          const first = document.getElementById("form-meus-dados")?.querySelector('.invalid-field');
          if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (d?.message) {
          alert(d.message);
        } else {
          alert(`Erro ao salvar (HTTP ${r.status}).`);
        }
      } catch (errJson) {
        console.error("Erro ao processar resposta de erro:", errJson);
        alert(`Erro ao salvar (HTTP ${r.status}).`);
      }

    } catch (err) {
      console.error(err);
      status.textContent = "Erro de conexão.";
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnHtml;
        btnSubmit.removeAttribute("aria-busy");
      }
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

            const originalHtml = btnSalvarFoto.innerHTML;
            btnSalvarFoto.disabled = true;
            btnSalvarFoto.innerHTML = '<span aria-hidden="true" class="ui-spinner"></span> Enviando...';
            btnSalvarFoto.setAttribute("aria-busy", "true");

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
                btnSalvarFoto.innerHTML = originalHtml;
                btnSalvarFoto.removeAttribute("aria-busy");
            }
        };

        btnRemoverFoto.onclick = async () => {
          if (!confirm("Remover a foto de perfil?")) return;

          const originalHtml = btnRemoverFoto.innerHTML;
          btnRemoverFoto.disabled = true;
          btnRemoverFoto.innerHTML = '<span aria-hidden="true" class="ui-spinner"></span> Removendo...';
          btnRemoverFoto.setAttribute("aria-busy", "true");

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
            btnRemoverFoto.innerHTML = originalHtml;
            btnRemoverFoto.removeAttribute("aria-busy");
          }
        };
    }

    async function buscarCep() {
        const btn = document.getElementById("btn-buscar-cep");
        const originalHtml = btn ? btn.innerHTML : "🔍";
        const onlyDigitsFn = (v) => window.Formatters ? window.Formatters.onlyDigits(v) : (v || "").replace(/\D/g, "");
        const cep = onlyDigitsFn(document.getElementById("me-cep").value || "");
        if (cep.length !== 8) {
            alert("Informe um CEP válido (8 dígitos).");
            return;
        }

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span aria-hidden="true" class="ui-spinner" style="margin-right: 0; width: 0.9rem; height: 0.9rem; border-width: 1.5px;"></span>';
                btn.setAttribute("aria-busy", "true");
            }
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
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                btn.removeAttribute("aria-busy");
            }
        }
    }

    window.MeusDados = {
        carregarMeusDados,
        labelSituacaoFuncional: (valor) => `Situação funcional do servidor: ${(valor || 'ATIVO').toString().toUpperCase()}`,
        labelEstadoCadastro: (filiado) => {
            const raw = (filiado && (filiado.estado_cadastro || (filiado.arquivado_em ? 'ARQUIVADO' : 'CADASTRO_ATIVO'))) || 'CADASTRO_ATIVO';
            const txt = raw === 'CADASTRO_ATIVO' ? 'CADASTRO ATIVO' : 'ARQUIVADO';
            return `Estado do cadastro: ${txt}`;
        }
    };
})(typeof window !== 'undefined' ? window : this);
