// meus-dados.js
import { apiFetch, aplicarMascaraTelefone, formatarCPF } from "./utils.js";
import { renderizarSeguranca } from "./seguranca.js";
import { preencherFormularioRessarcimentoComDados } from "./ressarcimento.js";

const LOTACOES_OPCOES = [
  "SEDE",
  "1ª DEL (Viana)",
  "2ª DEL (Serra)",
  "3ª DEL (Guarapari)",
  "4ª DEL (Linhares)",
];

/**
 * Carrega os dados do próprio filiado e renderiza a tela.
 */
export async function carregarMeusDados() {
  const conteudo = document.getElementById("area-filiado-conteudo");
  const alerta = document.getElementById("alerta-endereco-desatualizado");
  if (!conteudo) return;

  conteudo.innerHTML = "Carregando...";
  if (alerta) alerta.style.display = "none";

  // CSS específico para o bloco "Meus Dados", alinhado com o card de filiados
  if (!document.getElementById("style-meus-dados-modulo")) {
    const style = document.createElement("style");
    style.id = "style-meus-dados-modulo";
    style.textContent = `
      .af-meus-dados-card {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 16px 18px;
        margin-bottom: 12px;
        color: #fff;
      }

      .af-meus-dados-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }

      .af-meus-dados-header h3 {
        margin: 0;
        font-size: 1.1rem;
      }

      .af-meus-dados-badges {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .af-pill {
        display: inline-flex;
        align-items: center;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        font-weight: 600;
        border: 1px solid rgba(255,255,255,0.25);
        white-space: nowrap;
      }

      .af-pill-label {
        opacity: 0.7;
        margin-right: 4px;
      }

      .af-pill-situacao-ativo {
        background: rgba(39, 174, 96, 0.2);
        color: #2ecc71;
      }

      .af-pill-situacao-veterano {
        background: rgba(52, 152, 219, 0.2);
        color: #3498db;
      }

      .af-pill-situacao-pensionista {
        background: rgba(241, 196, 15, 0.2);
        color: #f1c40f;
      }

      .af-pill-perfil-admin,
      .af-pill-perfil-diretoria,
      .af-pill-perfil-funcionario {
        background: rgba(155, 89, 182, 0.2);
        color: #e8daff;
      }

      .af-pill-perfil-filiado {
        background: rgba(255, 255, 255, 0.08);
        color: #ecf0f1;
      }

      .af-meus-dados-card input,
      .af-meus-dados-card select {
        background-color: rgba(0,0,0,0.35);
        border-color: rgba(255,255,255,0.25);
        color: #fff;
      }

      .af-meus-dados-card input[readonly],
      .af-meus-dados-card select[disabled] {
        opacity: 0.8;
      }

      .af-meus-dados-card label {
        color: #ecf0f1;
      }

      #meus-dados-status {
        color: #ecf0f1;
      }

      @media (max-width: 600px) {
        .af-meus-dados-header {
          flex-direction: column;
          align-items: flex-start;
        }
        .af-meus-dados-badges {
          justify-content: flex-start;
        }
      }
    `;
    document.head.appendChild(style);
  }

  try {
    const resp = await apiFetch("/api/filiados/me");
    if (!resp || !resp.ok) throw new Error("Falha no carregamento de /me");

    const dados = await resp.json();

    const cepOk =
      !!dados.cep && String(dados.cep).replace(/\D/g, "").length === 8;
    const enderecoOk =
      !!dados.logradouro_bairro && !!dados.cidade && !!dados.uf;

    if ((!cepOk || !enderecoOk) && alerta) {
      alerta.textContent =
        "Endereço desatualizado ou incompleto, favor atualizar.";
      alerta.style.display = "block";
    }

    // Renderiza bloco "Meus Dados"
    renderizarFormularioMeusDados(dados, conteudo);

    // Box de segurança (2FA)
    renderizarSeguranca(dados, carregarMeusDados);

    // Preenche aba de ressarcimento com os dados carregados
    preencherFormularioRessarcimentoComDados(dados);
  } catch (e) {
    console.error("Erro em carregarMeusDados:", e);
    conteudo.innerHTML = "<p>Erro ao carregar dados.</p>";
  }
}

/**
 * Monta o HTML do formulário e registra os listeners.
 */
function renderizarFormularioMeusDados(dados, container) {
  const {
    nome,
    cpf,
    situacao,
    perfil_acesso,
    telefone1,
    telefone2,
    email1,
    email2,
    logradouro_bairro,
    numero,
    complemento,
    cidade,
    uf,
    cep,
    lotacao,
  } = dados;

  const situacaoFmt = (situacao || "ATIVO").toUpperCase();
  const perfilFmt = (perfil_acesso || "FILIADO").toUpperCase();

  const situacaoClass = (() => {
    switch (situacaoFmt) {
      case "ATIVO":
        return "af-pill-situacao-ativo";
      case "VETERANO":
        return "af-pill-situacao-veterano";
      case "PENSIONISTA":
        return "af-pill-situacao-pensionista";
      default:
        return "af-pill-situacao-ativo";
    }
  })();

  const perfilClass = (() => {
    switch (perfilFmt) {
      case "ADMIN":
      case "DIRETORIA":
      case "FUNCIONARIO":
        return "af-pill-perfil-admin";
      case "FILIADO":
      default:
        return "af-pill-perfil-filiado";
    }
  })();

  const lotacaoAtual = (lotacao || "SEDE").toUpperCase();
  const opcoesLotacao = LOTACOES_OPCOES.map(
    (op) =>
      `<option value="${op}" ${
        op.toUpperCase() === lotacaoAtual ? "selected" : ""
      }>${op}</option>`
  ).join("");

  const cepLimpo = (cep || "").toString().replace(/\D/g, "");

  container.innerHTML = `
    <div class="af-meus-dados-card">
      <div class="af-meus-dados-header">
        <h3 class="section-subtitle">Dados básicos</h3>
        <div class="af-meus-dados-badges">
          <span class="af-pill ${situacaoClass}">
            <span class="af-pill-label">Situação</span> ${situacaoFmt}
          </span>
          <span class="af-pill ${perfilClass}">
            <span class="af-pill-label">Perfil</span> ${perfilFmt}
          </span>
        </div>
      </div>

      <div class="field-row">
        <div class="field-group">
          <label>Nome</label>
          <input type="text" value="${nome || ""}" readonly />
        </div>
        <div class="field-group">
          <label>CPF</label>
          <input type="text" value="${formatarCPF(cpf)}" readonly />
        </div>
      </div>
    </div>

    <form id="form-meus-dados" class="af-meus-dados-card form-grid">
      <fieldset style="border: none; padding: 0; margin: 0;">
        <legend class="section-subtitle" style="margin-bottom: 10px;">Contatos e endereço</legend>

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

        <div class="field-row">
          <div class="field-group">
            <label>CEP</label>
            <div style="display:flex; gap:8px;">
              <input
                type="text"
                id="me-cep"
                value="${cepLimpo}"
                style="flex:1;"
                maxlength="8"
                inputmode="numeric"
              />
              <button type="button" id="btn-buscar-cep" class="btn btn-outline">
                Buscar
              </button>
            </div>
            <small id="me-cep-status" class="field-hint"></small>
          </div>
        </div>

        <div class="field-row">
          <div class="field-group">
            <label>Lotação</label>
            <select id="me-lotacao">
              ${opcoesLotacao}
            </select>
          </div>
        </div>

        <div class="field-row">
          <div class="field-group">
            <label>Logradouro</label>
            <input
              type="text"
              id="me-endereco"
              value="${logradouro_bairro || ""}"
              readonly
            />
          </div>
        </div>

        <div class="field-row" style="grid-template-columns: 1fr 2fr 1fr;">
          <div class="field-group">
            <label>Número</label>
            <input type="text" id="me-numero" value="${numero || ""}" />
          </div>
          <div class="field-group">
            <label>Complemento</label>
            <input type="text" id="me-complemento" value="${complemento || ""}" />
          </div>
          <div class="field-group">
            <label>UF</label>
            <input
              type="text"
              id="me-uf"
              value="${uf || ""}"
              readonly
            />
          </div>
        </div>

        <div class="field-row">
          <div class="field-group">
            <label>Cidade</label>
            <input
              type="text"
              id="me-cidade"
              value="${cidade || ""}"
              readonly
            />
          </div>
        </div>
      </fieldset>

      <div class="form-actions" style="margin-top: 16px;">
        <button type="submit" class="btn btn-primary">Salvar meus dados</button>
        <span id="meus-dados-status" class="field-hint" style="margin-left: 12px;"></span>
      </div>
    </form>
  `;

  // Máscaras de telefone
  aplicarMascaraTelefone(document.getElementById("me-telefone1"));
  aplicarMascaraTelefone(document.getElementById("me-telefone2"));

  // CEP – apenas dígitos
  const cepInput = document.getElementById("me-cep");
  const cepStatus = document.getElementById("me-cep-status");

  if (cepInput) {
    cepInput.addEventListener("input", () => {
      cepInput.value = cepInput.value.replace(/\D/g, "").slice(0, 8);
      if (cepStatus) cepStatus.textContent = "";
    });
  }

  const buscarCep = async () => {
    const val = (cepInput?.value || "").replace(/\D/g, "");
    if (val.length !== 8) {
      if (cepStatus) cepStatus.textContent = "CEP inválido (8 dígitos).";
      alert("CEP inválido. Informe 8 dígitos.");
      return;
    }

    if (cepStatus) cepStatus.textContent = "Consultando CEP...";

    try {
      const r = await fetch(`https://viacep.com.br/ws/${val}/json/`);
      const d = await r.json();
      if (d.erro) {
        if (cepStatus) cepStatus.textContent = "CEP não encontrado.";
        alert("CEP não encontrado.");
        return;
      }

      document.getElementById("me-endereco").value =
        d.logradouro || logradouro_bairro || "";
      document.getElementById("me-cidade").value = d.localidade || cidade || "";
      document.getElementById("me-uf").value = d.uf || uf || "";

      if (cepStatus) cepStatus.textContent = "CEP carregado com sucesso.";
    } catch (e) {
      console.error("Erro ao consultar CEP:", e);
      if (cepStatus) cepStatus.textContent = "Erro ao consultar CEP.";
    }
  };

  document
    .getElementById("btn-buscar-cep")
    ?.addEventListener("click", buscarCep);

  if (cepInput) {
    cepInput.addEventListener("blur", () => {
      if (cepInput.value) buscarCep();
    });
  }

  // Submit do formulário
  document
    .getElementById("form-meus-dados")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = document.getElementById("meus-dados-status");
      if (status) status.textContent = "Salvando...";

      const payload = {
        telefone1: document
          .getElementById("me-telefone1")
          .value.replace(/\D/g, ""),
        telefone2: document
          .getElementById("me-telefone2")
          .value.replace(/\D/g, ""),
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
        const r = await apiFetch("/api/filiados/me", {
          method: "PUT",
          body: payload, // segue o mesmo padrão que você já usa
        });

        if (r && r.ok) {
          await carregarMeusDados();
          if (status) status.textContent = "Salvo com sucesso.";
        } else {
          if (status) status.textContent = "Erro ao salvar.";
        }
      } catch (e) {
        console.error("Erro ao salvar meus dados:", e);
        if (status) status.textContent = "Erro.";
      }
    });
}
