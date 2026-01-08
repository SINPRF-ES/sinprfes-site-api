import { apiFetch, aplicarMascaraTelefone, formatarCPF, aplicarMascaraCEP } from './utils.js';
import { renderizarSeguranca } from './seguranca.js';
import { preencherFormularioRessarcimentoComDados } from './ressarcimento.js';

export async function carregarMeusDados() {
    const conteudo = document.getElementById("area-filiado-conteudo");
    const alerta = document.getElementById("alerta-endereco-desatualizado");

    if (!conteudo) return null;
    conteudo.innerHTML = "Carregando seus dados...";
    if (alerta) alerta.style.display = 'none';

    try {
        const resp = await apiFetch("/api/filiados/me");
        if (!resp.ok) throw new Error();
        const dados = await resp.json();

        // Alerta de endereço
        if ((!dados.cep || dados.cep === "") && alerta) {
            alerta.textContent = "⚠️ Por favor, atualize seu endereço.";
            alerta.style.display = 'block';
        }

        renderizarFormularioMeusDados(dados, conteudo);
        renderizarSeguranca(dados, carregarMeusDados);
        preencherFormularioRessarcimentoComDados(dados);

        return dados;
    } catch (e) {
        console.error(e);
        conteudo.innerHTML = "<p>Erro ao carregar dados.</p>";
        return null;
    }
}

function renderizarFormularioMeusDados(dados, container) {
    const {
        nome, cpf, situacao, perfil_acesso,
        telefone1, telefone2, email1, email2,
        logradouro_bairro, numero, complemento, cidade, uf, cep, lotacao,
        avatar_url
    } = dados;

    const situacaoUpper = (situacao || "ATIVO").toUpperCase();
    const corStatus = situacaoUpper === 'ATIVO' ? '#27ae60' : '#f39c12';
    const iconeStatus = situacaoUpper === 'ATIVO' ? '✅' : '⚠️';

    const opcoes = ["SEDE", "1ª DEL (Viana)", "2ª DEL (Serra)", "3ª DEL (Guarapari)", "4ª DEL (Linhares)"]
        .map(op => `<option value="${op}" ${op === (lotacao || "SEDE").toUpperCase() ? "selected" : ""}>${op}</option>`)
        .join("");

    if (!document.getElementById('style-meus-dados')) {
        const s = document.createElement('style');
        s.id = 'style-meus-dados';
        s.textContent = `
            .profile-header {
                background: linear-gradient(135deg, #003366 0%, #00152b 100%);
                color: #fff;
                padding: 25px;
                border-radius: 12px;
                border-left: 6px solid #ffc107;
                margin-bottom: 25px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                align-items: center;
                gap: 15px;
            }
            .profile-name h2 { margin: 0; font-size: 1.5rem; color: #fff; }
            .profile-meta { font-size: 0.95rem; color: #ccdceb; margin-top: 5px; display:flex; flex-wrap:wrap; gap:8px; }
            .profile-badge {
                background: rgba(255,255,255,0.1);
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 0.85rem;
                border: 1px solid rgba(255,255,255,0.2);
                display:inline-block;
            }
            .data-card {
                background: #fff;
                color: #333;
                padding: 25px;
                border-radius: 10px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                margin-bottom: 20px;
                border: 1px solid #e0e0e0;
            }
            .data-card h3 {
                color: #003366;
                font-size: 1.1rem;
                border-bottom: 2px solid #f0f0f0;
                padding-bottom: 10px;
                margin-bottom: 20px;
                font-weight: bold;
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
            
            /* Avatar Row Renovado */
            .avatar-row { display:flex; gap:20px; align-items:center; flex-wrap:wrap; }
            .avatar-preview {
                width:80px; height:80px; border-radius:50%;
                background:#f1f3f5;
                border:3px solid #dee2e6;
                overflow:hidden;
                display:flex; align-items:center; justify-content:center;
                flex-shrink:0; position: relative;
            }
            .avatar-preview img { width:100%; height:100%; object-fit:cover; display:block; }
            .avatar-fallback { font-size: 32px; color:#6c757d; }
            
            /* Botão de Upload Invisível mas clicável */
            .avatar-actions { display: flex; flex-direction: column; gap: 8px; }
            .btn-upload-label {
                background: #e9ecef; color: #333; padding: 8px 15px; border-radius: 5px;
                font-size: 0.9rem; cursor: pointer; text-align: center; border: 1px solid #ccc;
                transition: all 0.2s; display: inline-block;
            }
            .btn-upload-label:hover { background: #dde2e6; border-color: #bbb; }
            #me-avatar-file { display: none; } /* Esconde o input file feio */

            .form-actions { margin-top: 25px; text-align:right; }
        `;
        document.head.appendChild(s);
    }

    const avatarUrlSafe = (avatar_url || "").toString().trim();

    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-name">
            <h2>${nome || "Usuário"}</h2>
            <div class="profile-meta">
                <span class="profile-badge">CPF: ${formatarCPF(cpf)}</span>
                <span class="profile-badge">Perfil: ${perfil_acesso || "FILIADO"}</span>
            </div>
        </div>
        <div style="text-align:right;">
            <div style="font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Situação</div>
            <div style="font-weight:bold; color:${corStatus}; font-size:1.2rem; background:#fff; padding:4px 10px; border-radius:4px; margin-top:4px;">
                ${iconeStatus} ${situacaoUpper}
            </div>
        </div>
      </div>

      <form id="form-meus-dados">
        <div class="data-card">
            <h3>🖼️ Foto de Perfil</h3>
            <div class="avatar-row">
                <div class="avatar-preview" id="avatar-preview">
                    ${avatarUrlSafe ? `<img src="${avatarUrlSafe}" alt="Avatar" id="img-avatar-real" />` : `<div class="avatar-fallback">👤</div>`}
                </div>
                <div class="avatar-actions">
                    <label for="me-avatar-file" class="btn-upload-label">📁 Alterar Foto...</label>
                    <input type="file" id="me-avatar-file" accept="image/*">
                    
                    <button type="button" id="btn-salvar-foto" class="btn btn-primary" style="display:none; padding: 6px 12px; font-size: 0.85rem;">
                        ⬆️ Enviar Foto Agora
                    </button>
                    <div style="font-size:0.85rem; color:#666;">Formatos: JPG ou PNG</div>
                    <button type="button" id="btn-remover-foto"
                    class="btn btn-outline"
                    style="padding:6px 12px; font-size:0.85rem;">
                        🗑️ Remover Foto
                    </button>
                </div>
            </div>
        </div>

        <div class="data-card">
            <h3>📞 Contatos</h3>
            <div class="form-grid">
                <div class="field-row">
                    <div class="field-group">
                        <label>Tel 1</label>
                        <input type="text" id="me-telefone1" value="${telefone1 || ""}" placeholder="(00) 00000-0000" />
                    </div>
                    <div class="field-group">
                        <label>Tel 2</label>
                        <input type="text" id="me-telefone2" value="${telefone2 || ""}" placeholder="Opcional" />
                    </div>
                </div>
                <div class="field-row">
                    <div class="field-group">
                        <label>E-mail 1</label>
                        <input type="email" id="me-email1" value="${email1 || ""}" />
                    </div>
                    <div class="field-group">
                        <label>E-mail 2</label>
                        <input type="email" id="me-email2" value="${email2 || ""}" />
                    </div>
                </div>
            </div>
        </div>

        <div class="data-card">
            <h3>📍 Endereço</h3>
            <div class="form-grid">
                <div class="field-row">
                    <div class="field-group" style="flex:1;">
                        <label>CEP</label>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="text" id="me-cep" value="${cep || ""}" style="width:140px;" maxlength="8" />
                            <button type="button" id="btn-buscar-cep" class="btn btn-outline" style="color:#003366; border-color:#003366;">🔍</button>
                        </div>
                    </div>
                    <div class="field-group" style="flex:2;">
                        <label>Lotação</label>
                        <select id="me-lotacao">${opcoes}</select>
                    </div>
                </div>

                <div class="field-row" style="grid-template-columns: 1fr;">
                    <div class="field-group">
                        <label>Logradouro</label>
                        <input type="text" id="me-endereco" value="${logradouro_bairro || ""}" readonly />
                    </div>
                </div>

                <div class="field-row" style="grid-template-columns: 1fr 2fr 1fr;">
                    <div class="field-group">
                        <label>Nº</label>
                        <input type="text" id="me-numero" value="${numero || ""}" />
                    </div>
                    <div class="field-group">
                        <label>Compl.</label>
                        <input type="text" id="me-complemento" value="${complemento || ""}" />
                    </div>
                    <div class="field-group">
                        <label>UF</label>
                        <input type="text" id="me-uf" value="${uf || ""}" readonly />
                    </div>
                </div>

                <div class="field-row" style="grid-template-columns: 1fr;">
                    <div class="field-group">
                        <label>Cidade</label>
                        <input type="text" id="me-cidade" value="${cidade || ""}" readonly />
                    </div>
                </div>
            </div>
        </div>

        <div class="form-actions">
            <span id="meus-dados-status" class="field-hint" style="margin-right: 15px; font-weight:bold;"></span>
            <button type="submit" class="btn btn-primary btn-lg" style="padding: 12px 30px;">💾 Salvar Dados</button>
        </div>
      </form>
    `;

    // --- MÁSCARAS ---
    aplicarMascaraTelefone(document.getElementById("me-telefone1"));
    aplicarMascaraTelefone(document.getElementById("me-telefone2"));

    // ✅ PATCH: máscara do CEP em tempo real (apenas números, máx 8)
    const cepInput = document.getElementById("me-cep");
    aplicarMascaraCEP(cepInput);

    // --- UPLOAD DE AVATAR ---
    const inputFile = document.getElementById("me-avatar-file");
    const previewContainer = document.getElementById("avatar-preview");
    const btnSalvarFoto = document.getElementById("btn-salvar-foto");
    const btnRemoverFoto = document.getElementById("btn-remover-foto");

    // 1. Preview local ao selecionar
    inputFile.addEventListener("change", () => {
        const file = inputFile.files && inputFile.files[0];
        if (file) {
            const urlLocal = URL.createObjectURL(file);
            previewContainer.innerHTML = `<img src="${urlLocal}" style="width:100%; height:100%; object-fit:cover;" />`;
            btnSalvarFoto.style.display = "inline-block";
        }
    });

    // 2. Enviar foto para o backend
    btnSalvarFoto.addEventListener("click", async () => {
        const file = inputFile.files && inputFile.files[0];
        if (!file) return;

        const originalText = btnSalvarFoto.innerText;
        btnSalvarFoto.disabled = true;
        btnSalvarFoto.innerText = "Enviando...";

        const fd = new FormData();
        fd.append("avatar", file);

        try {
            const r = await apiFetch("/api/filiados/me/avatar", { method: "POST", body: fd });
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

    // 3. Remover foto
    btnRemoverFoto.addEventListener("click", async () => {
      if (!confirm("Remover a foto de perfil?")) return;

      btnRemoverFoto.disabled = true;
      const txt = btnRemoverFoto.innerText;
      btnRemoverFoto.innerText = "Removendo...";

      try {
        const r = await apiFetch("/api/filiados/me/avatar", { method: "DELETE" });
        if (r.ok) {
          alert("Foto removida com sucesso!");
          previewContainer.innerHTML = `<div class="avatar-fallback">👤</div>`;
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

    // --- CEP (busca via ViaCEP) ---
    const buscarCep = async () => {
        const val = (cepInput?.value || "").replace(/\D/g, "");
        if (val.length !== 8) return alert("CEP inválido");
        try {
            const r = await fetch(`https://viacep.com.br/ws/${val}/json/`);
            const d = await r.json();
            if (d.erro) return alert("CEP não encontrado");
            document.getElementById("me-endereco").value = `${d.logradouro || ""}${d.bairro ? ", " + d.bairro : ""}`.trim();
            document.getElementById("me-cidade").value = d.localidade || "";
            document.getElementById("me-uf").value = d.uf || "";
        } catch (e) {
            console.error(e);
        }
    };

    document.getElementById("btn-buscar-cep").addEventListener("click", buscarCep);
    cepInput.addEventListener("blur", () => {
        if (cepInput.value && cepInput.value.replace(/\D/g, "").length === 8) buscarCep();
    });

    // --- SUBMIT DADOS (PUT /me) ---
    document.getElementById("form-meus-dados").addEventListener("submit", async (e) => {
        e.preventDefault();
        const status = document.getElementById("meus-dados-status");
        status.textContent = "Salvando...";

        const payload = {
            telefone1: document.getElementById("me-telefone1").value.replace(/\D/g, ""),
            telefone2: document.getElementById("me-telefone2").value.replace(/\D/g, ""),
            email1: document.getElementById("me-email1").value,
            email2: document.getElementById("me-email2").value,
            logradouro_bairro: document.getElementById("me-endereco").value,
            numero: document.getElementById("me-numero").value,
            complemento: document.getElementById("me-complemento").value,
            cidade: document.getElementById("me-cidade").value,
            uf: document.getElementById("me-uf").value,
            cep: document.getElementById("me-cep").value.replace(/\D/g, ""),
            lotacao: document.getElementById("me-lotacao").value,
        };

        try {
            const r = await apiFetch("/api/filiados/me", { method: "PUT", body: payload });
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
    });
}

// Padronização de nomenclatura (frontend)
function labelSituacaoFuncional(valor) {
  return `Situação funcional do servidor: ${(valor || 'ATIVO').toString().toUpperCase()}`;
}

function labelEstadoCadastro(filiado) {
  const raw = (filiado && (filiado.estado_cadastro || (filiado.arquivado_em ? 'ARQUIVADO' : 'CADASTRO_ATIVO'))) || 'CADASTRO_ATIVO';
  const txt = raw === 'CADASTRO_ATIVO' ? 'CADASTRO ATIVO' : 'ARQUIVADO';
  return `Estado do cadastro: ${txt}`;
}
