import { apiFetch, aplicarMascaraTelefone, formatarCPF } from './utils.js';
import { renderizarSeguranca } from './seguranca.js';
import { preencherFormularioRessarcimentoComDados } from './ressarcimento.js';

export async function carregarMeusDados() {
    const conteudo = document.getElementById("area-filiado-conteudo");
    const alerta = document.getElementById("alerta-endereco-desatualizado");
    
    if (!conteudo) return null; // Retorna null se não houver container
    conteudo.innerHTML = "Carregando seus dados...";
    if(alerta) alerta.style.display = 'none';

    try {
        const resp = await apiFetch("/api/filiados/me");
        if(!resp.ok) throw new Error();
        const dados = await resp.json();

        // Alerta de endereço
        if ((!dados.cep || dados.cep === "") && alerta) {
            alerta.textContent = "⚠️ Por favor, atualize seu endereço.";
            alerta.style.display = 'block';
        }

        renderizarFormularioMeusDados(dados, conteudo);
        renderizarSeguranca(dados, carregarMeusDados);
        preencherFormularioRessarcimentoComDados(dados);

        // 🟢 NOVO: Retorna os dados para que o 'Maestro' possa ler o perfil atualizado
        return dados; 

    } catch (e) {
        conteudo.innerHTML = "<p>Erro ao carregar dados.</p>";
        return null;
    }
}

function renderizarFormularioMeusDados(dados, container) {
    const { nome, cpf, situacao, perfil_acesso, telefone1, telefone2, email1, email2, logradouro_bairro, numero, complemento, cidade, uf, cep, lotacao } = dados;
    
    const situacaoUpper = (situacao || "ATIVO").toUpperCase();
    const corStatus = situacaoUpper === 'ATIVO' ? '#27ae60' : '#f39c12'; 
    const iconeStatus = situacaoUpper === 'ATIVO' ? '✅' : '⚠️';

    const opcoes = ["SEDE", "1ª DEL (Viana)", "2ª DEL (Serra)", "3ª DEL (Guarapari)", "4ª DEL (Linhares)"]
        .map(op => `<option value="${op}" ${op === (lotacao || "SEDE").toUpperCase() ? "selected" : ""}>${op}</option>`).join("");

    if (!document.getElementById('style-meus-dados')) {
        const s = document.createElement('style'); s.id = 'style-meus-dados';
        s.textContent = `
            .profile-header { background: linear-gradient(135deg, #003366 0%, #00152b 100%); color: #fff; padding: 25px; border-radius: 12px; border-left: 6px solid #ffc107; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 15px; }
            .profile-name h2 { margin: 0; font-size: 1.5rem; color: #fff; }
            .profile-meta { font-size: 0.95rem; color: #ccdceb; margin-top: 5px; }
            .profile-badge { background: rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.2); }
            .data-card { background: #fff; color: #333; padding: 25px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid #e0e0e0; }
            .data-card h3 { color: #003366; font-size: 1.1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 20px; font-weight: bold; }
            .data-card input, .data-card select { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; color: #333; background-color: #fff; font-size: 1rem; }
            .data-card input:focus, .data-card select:focus { border-color: #003366; outline: none; background-color: #f9fbff; }
            .data-card label { font-weight: 600; font-size: 0.9rem; color: #555; margin-bottom: 5px; display: block; }
            input[readonly] { background-color: #f8f9fa; color: #666; border-color: #eee; cursor: not-allowed; }
        `;
        document.head.appendChild(s);
    }

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
            <div style="font-weight:bold; color:${corStatus}; font-size:1.2rem; background:#fff; padding:4px 10px; border-radius:4px; margin-top:4px;">${iconeStatus} ${situacaoUpper}</div>
        </div>
      </div>

      <form id="form-meus-dados">
        <div class="data-card"><h3>📞 Contatos</h3>
            <div class="form-grid">
                <div class="field-row"><div class="field-group"><label>Tel 1</label><input type="text" id="me-telefone1" value="${telefone1 || ""}" placeholder="(00) 00000-0000" /></div><div class="field-group"><label>Tel 2</label><input type="text" id="me-telefone2" value="${telefone2 || ""}" placeholder="Opcional" /></div></div>
                <div class="field-row"><div class="field-group"><label>E-mail 1</label><input type="email" id="me-email1" value="${email1 || ""}" /></div><div class="field-group"><label>E-mail 2</label><input type="email" id="me-email2" value="${email2 || ""}" /></div></div>
            </div>
        </div>
        <div class="data-card"><h3>📍 Endereço</h3>
            <div class="form-grid">
                <div class="field-row"><div class="field-group" style="flex:1;"><label>CEP</label><div style="display:flex; gap:10px;"><input type="text" id="me-cep" value="${cep || ""}" style="width:140px;" maxlength="8" /><button type="button" id="btn-buscar-cep" class="btn btn-outline" style="color:#003366; border-color:#003366;">🔍</button></div></div><div class="field-group" style="flex:2;"><label>Lotação</label><select id="me-lotacao">${opcoes}</select></div></div>
                <div class="field-row"><div class="field-group"><label>Logradouro</label><input type="text" id="me-endereco" value="${logradouro_bairro || ""}" readonly /></div></div>
                <div class="field-row" style="grid-template-columns: 1fr 2fr 1fr;"><div class="field-group"><label>Nº</label><input type="text" id="me-numero" value="${numero || ""}" /></div><div class="field-group"><label>Compl.</label><input type="text" id="me-complemento" value="${complemento || ""}" /></div><div class="field-group"><label>UF</label><input type="text" id="me-uf" value="${uf || ""}" readonly /></div></div>
                <div class="field-row"><div class="field-group"><label>Cidade</label><input type="text" id="me-cidade" value="${cidade || ""}" readonly /></div></div>
            </div>
        </div>
        <div class="form-actions" style="margin-top: 25px; text-align:right;"><span id="meus-dados-status" class="field-hint" style="margin-right: 15px; font-weight:bold;"></span><button type="submit" class="btn btn-primary btn-lg" style="padding: 12px 30px;">💾 Salvar</button></div>
      </form>`;

    aplicarMascaraTelefone(document.getElementById("me-telefone1"));
    aplicarMascaraTelefone(document.getElementById("me-telefone2"));
    
    const cepInput = document.getElementById("me-cep");
    const buscarCep = async () => {
        const val = cepInput.value.replace(/\D/g,"");
        if(val.length !== 8) return alert("CEP inválido");
        try {
            const r = await fetch(`https://viacep.com.br/ws/${val}/json/`);
            const d = await r.json();
            if(d.erro) return alert("CEP não encontrado");
            document.getElementById("me-endereco").value = `${d.logradouro}, ${d.bairro}`;
            document.getElementById("me-cidade").value = d.localidade || "";
            document.getElementById("me-uf").value = d.uf || "";
        } catch(e) { console.error(e); }
    };
    document.getElementById("btn-buscar-cep").addEventListener("click", buscarCep);
    cepInput.addEventListener("blur", () => { if(cepInput.value) buscarCep(); });

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
            lotacao: document.getElementById("me-lotacao").value
        };
        try {
            const r = await apiFetch("/api/filiados/me", { method: "PUT", body: payload });
            if(r.ok) { await carregarMeusDados(); alert("Salvo com sucesso!"); }
            else status.textContent = "Erro.";
        } catch(e) { status.textContent = "Erro de conexão."; }
    });
}