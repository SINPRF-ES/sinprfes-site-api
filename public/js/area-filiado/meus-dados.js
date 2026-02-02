/**
 * Módulo Meus Dados (Página Inicial)
 * Carregado como script clássico (window.MeusDados)
 */

(function (global) {
    if (global.MeusDados) return;

    let filiadoLocal = null;

    async function inicializar(perfil) {
        const container = document.getElementById("area-filiado-conteudo");
        if (!container) return;

        try {
            const r = await window.Api.apiFetch("/api/me");
            if (r.ok) {
                const d = await r.json();
                filiadoLocal = d.filiado;
                renderizar(container);
                verificarEndereco();
            } else {
                container.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar seus dados.</p>`;
            }
        } catch (e) {
            container.innerHTML = `<p style="color:red; text-align:center;">Erro de conexão.</p>`;
        }
    }

    function renderizar(container) {
        const f = filiadoLocal;
        const { formatarCPF, formatarTelefoneTexto, formatarDataBR, formatDateSafe } = global.Utils || {};

        // Formatação de Sexo com Emoji (ReadOnly UI Standard)
        const sexos = { 'M': '♂️ Masculino', 'F': '♀️ Feminino' };
        const sexoDisplay = sexos[f.sexo] || '—';

        const apiBase = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? "http://localhost:3000"
            : "https://api.sinprfes.org.br";

        const avatarSrc = f.avatar_url
            ? (f.avatar_url.startsWith('http') ? f.avatar_url : apiBase + f.avatar_url)
            : "/img/avatar-placeholder.png";

        container.innerHTML = `
            <div class="af-standard-header">
                <h2>👤 Meus Dados</h2>
                <p class="section-subtitle">Confira e mantenha suas informações sempre atualizadas.</p>
            </div>

            <div class="af-standard-card" style="background: var(--azul-fundo) !important; color: #fff !important; border-bottom: 5px solid var(--amarelo) !important;">
                <div style="display: flex; align-items: center; gap: 30px; flex-wrap: wrap;">
                    <div style="text-align: center;">
                        <img src="${avatarSrc}" alt="Avatar" id="me-avatar-preview" onerror="this.src='/img/avatar-placeholder.png'" style="width: 130px; height: 130px; border-radius: 50%; border: 4px solid #fff; object-fit: cover; background: #fff;">
                        <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px;">
                            <button class="btn btn-outline btn-sm" onclick="MeusDados.triggerAvatar()" style="color: #fff; border-color: rgba(255,255,255,0.5);">Alterar Foto</button>
                            <input type="file" id="me-avatar-input" accept="image/*" style="display: none;" onchange="MeusDados.uploadAvatar()">
                            ${f.avatar_url ? `<button class="btn btn-sm" onclick="MeusDados.removerAvatar()" style="color: #ff7675; background: transparent; border: none;">Remover</button>` : ''}
                        </div>
                    </div>
                    <div style="flex: 1; min-width: 250px;">
                        <h2 style="margin: 0; font-size: 2rem; font-weight: 800;">${f.nome}</h2>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px;">
                            <span class="filiado-badge" style="background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.3);">${f.perfil_acesso}</span>
                            <span class="filiado-badge badge-${(f.situacao || 'ativo').toLowerCase()}">${f.situacao || 'ATIVO'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="af-standard-card af-standard-form">
                <h3><i class="emoji">👤</i> Informações Pessoais</h3>
                <div class="field-row">
                    <div class="field-group">
                        <label>Nome</label>
                        <input value="${f.nome}" readonly style="background: #f1f4f8;">
                    </div>
                    <div class="field-group">
                        <label>Sexo</label>
                        <input value="${sexoDisplay}" readonly style="background: #f1f4f8;">
                    </div>
                </div>
                <div class="field-row">
                    <div class="field-group">
                        <label>CPF</label>
                        <input value="${formatarCPF ? formatarCPF(f.cpf) : f.cpf}" readonly style="background: #f1f4f8;">
                    </div>
                    <div class="field-group">
                        <label>Matrícula (SIAPE)</label>
                        <input value="${f.siape || '—'}" readonly style="background: #f1f4f8;">
                    </div>
                </div>
                <div class="field-row">
                    <div class="field-group">
                        <label>Data de Nascimento</label>
                        <input value="${formatDateSafe ? formatDateSafe(f.data_nascimento) : f.data_nascimento}" readonly style="background: #f1f4f8;">
                    </div>
                    <div class="field-group">
                        <label>Idade</label>
                        <input value="${global.AgeUtils ? global.AgeUtils.formatAgeDetailed(f.data_nascimento) : '—'}" readonly style="background: #f1f4f8;">
                    </div>
                </div>
                <div class="field-row">
                    <div class="field-group">
                        <label>Lotação</label>
                        <input value="${f.lotacao || 'SEDE'}" readonly style="background: #f1f4f8;">
                    </div>
                    <div class="field-group"></div>
                </div>
            </div>

            <form id="form-meus-contatos" class="af-standard-card af-standard-form" style="background: #f8fafc !important;">
                <h3><i class="emoji">📞</i> Contato e Endereço</h3>
                <p style="margin-bottom: 25px; color: #666; font-size: 0.95rem;">Estes campos podem ser editados por você.</p>

                <div class="field-row">
                    <div class="field-group">
                        <label>Email Principal</label>
                        <input type="email" name="email1" value="${f.email1 || ''}" required>
                    </div>
                    <div class="field-group">
                        <label>Telefone 1</label>
                        <input name="telefone1" class="campo-telefone" value="${f.telefone1 || ''}" required>
                    </div>
                </div>

                <div class="field-row">
                    <div class="field-group">
                        <label>Email Secundário</label>
                        <input type="email" name="email2" value="${f.email2 || ''}">
                    </div>
                    <div class="field-group">
                        <label>Telefone 2</label>
                        <input name="telefone2" class="campo-telefone" value="${f.telefone2 || ''}">
                    </div>
                </div>

                <div style="margin-top: 30px; padding-top: 25px; border-top: 1px dashed #cbd5e0;">
                    <div class="field-row">
                        <div class="field-group">
                            <label>CEP</label>
                            <div class="cep-input-wrapper">
                                <input name="cep" id="me-cep" class="campo-cep" value="${f.cep || ''}" maxlength="9">
                                <span class="cep-search-icon" onclick="MeusDados.buscarCEP()">🔍</span>
                            </div>
                        </div>
                        <div class="field-group">
                            <label>Logradouro / Bairro</label>
                            <input name="logradouro_bairro" id="me-logradouro" value="${f.logradouro_bairro || ''}" readonly style="background: #f1f4f8;">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Número</label>
                            <input name="numero" value="${f.numero || ''}">
                        </div>
                        <div class="field-group">
                            <label>Complemento</label>
                            <input name="complemento" value="${f.complemento || ''}">
                        </div>
                    </div>
                    <div class="field-row">
                        <div class="field-group">
                            <label>Cidade</label>
                            <input name="cidade" id="me-cidade" value="${f.cidade || ''}" readonly style="background: #f1f4f8;">
                        </div>
                        <div class="field-group">
                            <label>UF</label>
                            <input name="uf" id="me-uf" value="${f.uf || ''}" readonly style="background: #f1f4f8;">
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 35px;">
                    <button type="submit" class="btn btn-primary" style="padding: 12px 60px;">💾 Salvar Alterações</button>
                </div>
            </form>
        `;

        const form = document.getElementById("form-meus-contatos");
        const { aplicarMascaraTelefone, aplicarMascaraCEP } = global.Utils || {};

        form.querySelectorAll(".campo-telefone").forEach(inp => aplicarMascaraTelefone?.(inp));
        const cepInp = form.querySelector(".campo-cep");
        if (cepInp) {
            aplicarMascaraCEP?.(cepInp);
            cepInp.onblur = () => MeusDados.buscarCEP();
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const payload = {};
            fd.forEach((v, k) => payload[k] = v.trim());

            if (global.Formatters) {
                payload.telefone1 = global.Formatters.onlyDigits(payload.telefone1);
                payload.telefone2 = global.Formatters.onlyDigits(payload.telefone2);
                payload.cep = global.Formatters.onlyDigits(payload.cep);
            }

            try {
                const r = await window.Api.apiFetch("/api/me", {
                    method: "PUT",
                    body: payload
                });
                if (r.ok) {
                    alert("Dados atualizados com sucesso!");
                    inicializar();
                } else {
                    const err = await r.json();
                    alert(err.message || "Erro ao atualizar.");
                }
            } catch (err) { alert("Erro de conexão."); }
        };
    }

    async function buscarCEP() {
        const input = document.getElementById("me-cep");
        const cep = (input.value || "").replace(/\D/g, "");
        if (cep.length !== 8) return;

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                document.getElementById("me-logradouro").value = `${data.logradouro}${data.bairro ? ' - ' + data.bairro : ''}`;
                document.getElementById("me-cidade").value = data.localidade;
                document.getElementById("me-uf").value = data.uf;
            }
        } catch (e) { console.error("CEP Erro", e); }
    }

    function triggerAvatar() {
        document.getElementById("me-avatar-input").click();
    }

    async function uploadAvatar() {
        const input = document.getElementById("me-avatar-input");
        const file = input.files[0];
        if (!file) return;

        const fd = new FormData();
        fd.append("avatar", file);

        try {
            const r = await window.Api.apiFetch("/api/me/avatar", {
                method: "POST",
                body: fd
            });
            if (r.ok) {
                alert("Foto atualizada!");
                inicializar();
            }
        } catch (e) { alert("Erro no upload."); }
    }

    async function removerAvatar() {
        if (!confirm("Remover sua foto de perfil?")) return;
        try {
            const r = await window.Api.apiFetch("/api/me/avatar", { method: "DELETE" });
            if (r.ok) {
                alert("Foto removida.");
                inicializar();
            }
        } catch (e) { alert("Erro ao remover."); }
    }

    function verificarEndereco() {
        const f = filiadoLocal;
        const alerta = document.getElementById("alerta-endereco-desatualizado");
        if (!alerta) return;

        if (!f.cep || !f.logradouro_bairro || !f.numero) {
            alerta.style.display = "block";
            alerta.innerHTML = `<strong>📍 Endereço Incompleto:</strong> Por favor, preencha seu endereço para receber correspondências do sindicato.`;
        } else {
            alerta.style.display = "none";
        }
    }

    global.MeusDados = {
        inicializar,
        triggerAvatar,
        uploadAvatar,
        removerAvatar,
        buscarCEP
    };

})(typeof window !== 'undefined' ? window : global);
