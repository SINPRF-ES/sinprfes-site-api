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

    async function carregarMeusDados() {
        if (!window.Api.apiFetch) return null;

        const conteudo = document.getElementById("area-user-conteudo");
        const alerta = document.getElementById("alerta-endereco-desatualizado");

        if (!conteudo) return null;
        conteudo.innerHTML = "Carregando seus dados...";
        if (alerta) alerta.style.display = 'none';

        try {
            const resp = await window.Api.apiFetch("/api/users/me");
            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || "Erro na API");
            }
            const dados = await resp.json();

            renderizarFormularioMeusDados(dados, conteudo);

            // Alerta de endereço (Aviso não-fatal)
            if ((!dados.cep || dados.cep.trim() === "") && alerta) {
                alerta.innerHTML = "<strong>Aviso:</strong> Seu endereço está incompleto. Por favor, atualize seu cadastro para regularizar sua situação.";
                alerta.style.display = 'block';
            } else if (alerta) {
                alerta.style.display = 'none';
            }

            if (global.Seguranca && global.Seguranca.renderizarSeguranca) {
                global.Seguranca.renderizarSeguranca(dados, carregarMeusDados);
            }

            return dados;
        } catch (e) {
            console.error("MeusDados: Erro ao carregar/renderizar:", e);
            conteudo.innerHTML = `<div class="alerta alerta-danger">Erro ao carregar dados: ${e.message}</div>`;
            return null;
        }
    }

    function renderizarFormularioMeusDados(dados, container) {
        const {
            nome, cpf, perfil_acesso, situacao,
            telefone1, telefone2, email1, email2,
            logradouro, bairro, numero, complemento, cidade, uf, cep,
            avatar_url
        } = dados;

        const logradouro_bairro = logradouro ? `${logradouro}${bairro ? ', ' + bairro : ''}` : '';

        const { aplicarMascaraTelefone, aplicarMascaraCEP, formatarCPF } = global.Utils || {};


        if (!document.getElementById('style-meus-dados')) {
            const s = document.createElement('style');
            s.id = 'style-meus-dados';
            s.textContent = `
                .profile-header {
                    background: linear-gradient(135deg, #003366 0%, #00152b 100%);
                    color: #fff;
                    padding: 35px 30px;
                    border-radius: 15px;
                    border-bottom: 6px solid var(--amarelo);
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
                    color: var(--amarelo);
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
            : "https://fenaprf-sistema.onrender.com";

        const avatarFullUrl = avatarUrlSafe
            ? (avatarUrlSafe.startsWith('http') ? avatarUrlSafe : apiBase + avatarUrlSafe)
            : null;

        const avatarImg = avatarFullUrl
            ? `<img src="${avatarFullUrl}" alt="Avatar" class="me-avatar-img">`
            : `<div class="avatar-fallback"></div>`;

        // AgeUtils é carregado como global em portal/index.html
        const idadeTxt = global.AgeUtils ? global.AgeUtils.formatAgeDetailed(dados.data_nascimento) : '—';

        const situacaoDisplay = (situacao || "ATIVO").toUpperCase();
        const ehGestao = ["ADMIN", "DIRETORIA", "COLABORADOR"].includes((perfil_acesso || "").toUpperCase());

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
                        </div>
                    </div>
                </div>
            </div>

            <form id="form-meus-dados">
                <div class="data-card">
                    <h3>👤 Informações Pessoais</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Nome</label>
                            <input type="text" value="${nome || ""}" readonly />
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
                            <input type="text" value="${window.Formatters ? window.Formatters.formatCpf(cpf || "") : cpf}" readonly />
                        </div>
                        <div class="field-group"></div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Data de Nascimento</label>
                            <input type="text" value="${formatarDataBR(dados.data_nascimento)}" readonly />
                        </div>
                        <div class="field-group">
                            <label>Idade</label>
                            <input type="text" value="${idadeTxt}" readonly />
                        </div>
                    </div>
                </div>

                <div class="data-card bg-alt">
                    <h3>📞 Contato</h3>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Telefone 1</label>
                            <input type="text" id="me-telefone1" value="${global.Utils.formatarTelefoneTexto(telefone1)}" />
                        </div>
                        <div class="field-group">
                            <label>Telefone 2</label>
                            <input type="text" id="me-telefone2" value="${global.Utils.formatarTelefoneTexto(telefone2)}" />
                        </div>
                    </div>

                    <div class="field-row">
                        <div class="field-group">
                            <label>Email</label>
                            <input type="email" id="me-email" value="${dados.email || email1 || ""}" />
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
                                <input type="text" id="me-cep" value="${global.Utils.formatarCEP(cep)}" placeholder="00000-000" class="campo-cep" />
                                <span class="cep-search-icon" id="btn-buscar-cep" style="cursor:pointer;">🔍</span>
                            </div>
                        </div>
                        <div class="edit-group logradouro-group">
                            <label>Logradouro / Bairro</label>
                            <input type="text" id="me-endereco" value="${logradouro_bairro || ""}"
                                   data-logradouro="${logradouro || ""}" data-bairro="${bairro || ""}"
                                   readonly style="background:#f0f0f0;" />
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
                            <input type="text" id="me-uf" value="${dados.uf_endereco || ""}" readonly style="background:#f0f0f0;" />
                        </div>
                    </div>
                </div>

                <!-- Dependentes removidos conforme política FENAPRF -->

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

        // --- CEP ---
        document.getElementById("btn-buscar-cep").addEventListener("click", buscarCep);
        cepInput.addEventListener("blur", () => {
            const onlyDigitsFn = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").replace(/\D/g, "");
            if (cepInput.value && onlyDigitsFn(cepInput.value).length === 8) buscarCep();
        });

        // --- SUBMIT DADOS (PUT /me) ---
        document.getElementById("form-meus-dados").addEventListener("submit", async (e) => {
            e.preventDefault();
            const status = document.getElementById("meus-dados-status");
            status.textContent = "Salvando...";

            const form = e.target;
            const formData = new FormData(form);
            const rawPayload = {};

            for (const [key, value] of formData.entries()) {
                rawPayload[key] = value;
            }

            const payload = { ...rawPayload };

            // Normalização de Nomes (Canônico)
            if (payload.nome && global.Canon?.normalizeNome) {
                payload.nome = global.Canon.normalizeNome(payload.nome);
            }

            const onlyDigitsFn = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").replace(/\D/g, "");

            // Adiciona campos que não estão no form ou precisam de normalização
            payload.sexo = document.getElementById("me-sexo").value;

            payload.telefone1 = onlyDigitsFn(document.getElementById("me-telefone1").value);
            payload.telefone2 = onlyDigitsFn(document.getElementById("me-telefone2").value);
            payload.email = document.getElementById("me-email").value;

            // FENAPRF: Use separate fields for logradouro and bairro
            const inputEnd = document.getElementById("me-endereco");
            payload.logradouro = inputEnd.dataset.logradouro || "";
            payload.bairro = inputEnd.dataset.bairro || "";

            if (!payload.logradouro && inputEnd.value) {
                payload.logradouro = inputEnd.value;
            }

            payload.numero = document.getElementById("me-numero").value;
            payload.complemento = document.getElementById("me-complemento").value;
            payload.cidade = document.getElementById("me-cidade").value;
            payload.uf_endereco = document.getElementById("me-uf").value;
            payload.cep = onlyDigitsFn(document.getElementById("me-cep").value);

            try {
                const r = await window.Api.apiFetch("/api/users/me", { method: "PUT", body: payload });
                const d = await r.json().catch(() => ({}));
                if (r.ok) {
                    await carregarMeusDados();
                    if (d.warnings && d.warnings.length > 0) {
                        const warnMsgs = d.warnings.map(w => w.message).join("\n");
                        alert("Dados salvos com avisos:\n" + warnMsgs);
                    } else {
                        alert("Dados salvos com sucesso!");
                    }
                } else {
                    status.textContent = "Erro ao salvar.";
                    if (d?.message) alert(d.message);
                }
            } catch (e) {
                status.textContent = "Erro de conexão.";
            }
        });

        // --- UPLOAD DE AVATAR ---
        const inputFile = document.getElementById("me-avatar-file");
        const previewContainer = document.getElementById("avatar-preview");
        const btnSalvarFoto = document.getElementById("btn-salvar-foto");
        const btnRemoverFoto = document.getElementById("btn-remover-foto");

        inputFile.addEventListener("change", () => {
            const file = inputFile.files && inputFile.files[0];
            if (file) {
                const urlLocal = URL.createObjectURL(file);
                previewContainer.innerHTML = `<img src="${urlLocal}" style="width:100%; height:100%; object-fit:cover;" />`;
                btnSalvarFoto.style.display = "inline-block";
            }
        });

        btnSalvarFoto.addEventListener("click", async () => {
            const file = inputFile.files && inputFile.files[0];
            if (!file) return;

            const originalText = btnSalvarFoto.innerText;
            btnSalvarFoto.disabled = true;
            btnSalvarFoto.innerText = "Enviando...";

            const fd = new FormData();
            fd.append("avatar", file);

            try {
                const r = await window.Api.apiFetch("/api/users/me/avatar", { method: "POST", body: fd });
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
        });

        btnRemoverFoto.addEventListener("click", async () => {
          if (!confirm("Remover a foto de perfil?")) return;

          btnRemoverFoto.disabled = true;
          const txt = btnRemoverFoto.innerText;
          btnRemoverFoto.innerText = "Removendo...";

          try {
            const r = await window.Api.apiFetch("/api/users/me/avatar", { method: "DELETE" });
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
        });
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

            const inputEnd = document.getElementById("me-endereco");
            inputEnd.value = `${d.logradouro || ""}${d.bairro ? ', ' + d.bairro : ''}`;
            inputEnd.dataset.logradouro = d.logradouro || "";
            inputEnd.dataset.bairro = d.bairro || "";

            document.getElementById("me-cidade").value = d.localidade || "";
            document.getElementById("me-uf").value = d.uf || "";
        } catch (e) {
            console.error("Erro busca CEP", e);
            alert("Erro ao buscar CEP. Verifique sua conexão.");
        }
    }

    global.MeusDados = {
        carregarMeusDados,
        labelEstadoCadastro: (user) => {
            const raw = (user && (user.estado_cadastro || (user.arquivado_em ? 'ARQUIVADO' : 'CADASTRO_ATIVO'))) || 'CADASTRO_ATIVO';
            const txt = raw === 'CADASTRO_ATIVO' ? 'CADASTRO ATIVO' : 'ARQUIVADO';
            return `Estado do cadastro: ${txt}`;
        }
    };
})(typeof window !== 'undefined' ? window : global);
