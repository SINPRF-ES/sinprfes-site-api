import {
  apiFetch,
  aplicarMascaraTelefone,
  formatarCPF,
  normalizarTextoBusca,
} from "./utils.js";

let cacheLista = [];
const SITUACAO_OPCOES = ["ATIVO", "VETERANO", "PENSIONISTA"];

// Guarda o perfil atual e evita registrar handlers mais de uma vez
let perfilAtual = null;
let handlersConfigurados = false;

export async function inicializarFiliados(perfil) {
  const listaEl = document.getElementById("lista-filiados");
  if (!listaEl) return;

  perfilAtual = (perfil || "").toUpperCase();

  // 🟢 INJEÇÃO DE CSS (Correção do Alinhamento) – apenas uma vez
  if (!document.getElementById("style-filiados-modulo")) {
    const style = document.createElement("style");
    style.id = "style-filiados-modulo";
    style.textContent = `
      /* Card do Filiado */
      .af-filiado-card {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 10px;
      }
      
      /* Linha Flexível: Nome na Esquerda, Contato na Direita */
      .af-filiado-linha {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
      }
      
      .af-filiado-info {
          flex: 1;
          text-align: left;
      }
      
      .af-filiado-contatos {
          text-align: right;
          font-size: 0.9em;
          color: #ccc;
          white-space: nowrap;
      }

      /* Detalhes (Edição) */
      details.af-filiado-details {
          margin-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 10px;
      }
      
      summary {
          cursor: pointer;
          color: #ffc107;
          font-size: 0.9em;
          margin-bottom: 10px;
      }

      /* Mobile: Empilha um embaixo do outro */
      @media (max-width: 600px) {
          .af-filiado-linha {
              flex-direction: column;
              align-items: flex-start;
          }
          .af-filiado-contatos {
              text-align: left;
              margin-top: 5px;
          }
      }
    `;
    document.head.appendChild(style);
  }

  // Handlers de botão e busca – registrados uma única vez
  if (!handlersConfigurados) {
    const btnNovo = document.getElementById("btn-novo-filiado");
    if (btnNovo) {
      if (["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual)) {
        btnNovo.addEventListener("click", abrirNovoFiliado);
      } else {
        btnNovo.style.display = "none";
      }
    }

    const campoBusca = document.getElementById("busca-filiados");
    if (campoBusca) {
      campoBusca.addEventListener("input", (e) =>
        filtrarLista(e.target.value, perfilAtual)
      );
    }

    handlersConfigurados = true;
  }

  // Carrega dados
  try {
    listaEl.innerHTML = "<p>Carregando lista...</p>";
    const r = await apiFetch("/api/filiados");
    if (r && r.ok) {
      const d = await r.json();
      cacheLista = d.filiados || d || [];
      filtrarLista("", perfilAtual);
    } else {
      listaEl.innerHTML = "<p>Erro ao carregar.</p>";
    }
  } catch (e) {
    console.error("Erro ao carregar filiados:", e);
    listaEl.innerHTML = "<p>Erro.</p>";
  }
}

function filtrarLista(termo, perfil) {
  const el = document.getElementById("lista-filiados");
  if (!el) return;

  const t = normalizarTextoBusca(termo || "");
  const res = cacheLista.filter((f) => {
    const nome = normalizarTextoBusca(f?.nome || "");
    const cpf = normalizarTextoBusca(f?.cpf || "");
    return nome.includes(t) || cpf.includes(t);
  });

  if (!res.length) {
    el.innerHTML = "<p>Nenhum encontrado.</p>";
    return;
  }

  const podeEditar = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfil);

  el.innerHTML = res
    .map((f) => {
      const situacaoAtual = (f.situacao || "ATIVO").toUpperCase();
      const corSituacao =
        situacaoAtual === "ATIVO" ? "#27ae60" : "#f1c40f";

      const base = `
        <div class="af-filiado-linha">
          <div class="af-filiado-info">
            <strong style="font-size: 1.1em; color: #fff;">${f.nome}</strong><br>
            <span style="color: #aaa; font-size: 0.9em;">
              CPF: ${formatarCPF(f.cpf)} | ${f.lotacao || "SEDE"} |
              <span style="color: ${corSituacao}">${situacaoAtual}</span>
            </span>
          </div>
          <div class="af-filiado-contatos">
            <div>${f.telefone1 || "-"}</div>
            <div>${f.telefone2 || ""}</div>
          </div>
        </div>`;

      if (!podeEditar) return `<div class="af-filiado-card">${base}</div>`;

      // Form de Edição (Só aparece se expandir o details)
      const disabledSeNaoAdmin = perfil !== "ADMIN" ? "disabled" : "";
      const classeAdmin = perfil !== "ADMIN" ? "af-only-admin" : "";

      return `
        <div class="af-filiado-card">
          ${base}
          <details class="af-filiado-details">
            <summary>Editar dados completos</summary>
            <form class="form-edit-filiado" data-id="${f.id}">
              <div class="field-row">
                <div class="field-group">
                  <label>Nome</label>
                  <input type="text" name="nome" value="${f.nome}">
                </div>
                <div class="field-group">
                  <label>Lotação</label>
                  <input type="text" name="lotacao" value="${f.lotacao || ""}">
                </div>
              </div>
              <div class="field-row">
                <div class="field-group">
                  <label>Tel 1</label>
                  <input type="text" name="telefone1" value="${f.telefone1 || ""}">
                </div>
                <div class="field-group">
                  <label>Tel 2</label>
                  <input type="text" name="telefone2" value="${f.telefone2 || ""}">
                </div>
              </div>
              <div class="field-row">
                <div class="field-group">
                  <label>Situação</label>
                  <select name="situacao">
                    ${SITUACAO_OPCOES.map(
                      (o) =>
                        `<option ${
                          o === situacaoAtual ? "selected" : ""
                        }>${o}</option>`
                    ).join("")}
                  </select>
                </div>
                <div class="field-group ${classeAdmin}">
                  <label>Perfil</label>
                  <select name="perfil_acesso" ${disabledSeNaoAdmin}>
                    <option value="FILIADO" ${
                      f.perfil_acesso === "FILIADO" ? "selected" : ""
                    }>FILIADO</option>
                    <option value="ADMIN" ${
                      f.perfil_acesso === "ADMIN" ? "selected" : ""
                    }>ADMIN</option>
                    <option value="DIRETORIA" ${
                      f.perfil_acesso === "DIRETORIA" ? "selected" : ""
                    }>DIRETORIA</option>
                    <option value="FUNCIONARIO" ${
                      f.perfil_acesso === "FUNCIONARIO" ? "selected" : ""
                    }>FUNCIONARIO</option>
                  </select>
                </div>
              </div>
              <div class="form-actions" style="margin-top:10px;">
                <button type="submit" class="btn btn-primary btn-sm">Salvar Alterações</button>
              </div>
            </form>
          </details>
        </div>`;
    })
    .join("");

  // Listeners de edição
  if (podeEditar) {
    el.querySelectorAll("form.form-edit-filiado").forEach((frm) => {
      aplicarMascaraTelefone(frm.querySelector('input[name="telefone1"]'));
      aplicarMascaraTelefone(frm.querySelector('input[name="telefone2"]'));

      frm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = frm.dataset.id;
        const fd = new FormData(frm);
        const payload = {};
        fd.forEach((v, k) => {
          payload[k] = k.includes("telefone") ? v.replace(/\D/g, "") : v;
        });

        try {
          const r = await apiFetch(`/api/filiados/${id}`, {
            method: "PUT",
            body: payload, // mantém sua convenção atual
          });
          if (r && r.ok) {
            alert("Dados atualizados!");
            // Recarrega a lista mantendo perfil original
            inicializarFiliados(perfilAtual);
          } else {
            alert("Erro ao salvar.");
          }
        } catch (ex) {
          console.error("Erro ao atualizar filiado:", ex);
          alert("Erro de conexão.");
        }
      });
    });
  }
}

function abrirNovoFiliado() {
  const container = document.getElementById("novo-filiado-container");
  if (!container) return;

  // Toggle
  if (container.innerHTML) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="section-box" style="background:#fff; color:#333; padding:20px; border-radius:10px; margin-bottom:20px;">
      <h3 style="color:#003366; margin-bottom:15px;">Cadastrar Novo Filiado</h3>
      <form id="form-novo-filiado">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
          <div>
            <label>Nome *</label>
            <input name="nome" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
          </div>
          <div>
            <label>CPF *</label>
            <input name="cpf" required placeholder="Somente números" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
          </div>
        </div>
        <div style="margin-bottom:15px;">
          <label>E-mail *</label>
          <input name="email1" type="email" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
        </div>
        <button class="btn btn-primary">Criar Cadastro</button>
        <button type="button" id="btn-cancelar-novo" class="btn btn-outline" style="margin-left:10px; color:#333; border-color:#999;">Cancelar</button>
      </form>
    </div>`;

  container
    .querySelector("#btn-cancelar-novo")
    .addEventListener("click", () => (container.innerHTML = ""));

  container.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.perfil_acesso = "FILIADO";
    try {
      const r = await apiFetch("/api/filiados", {
        method: "POST",
        body: payload, // mantém seu padrão
      });
      if (r && r.ok) {
        alert("Criado com sucesso!");
        container.innerHTML = "";
        inicializarFiliados(perfilAtual || "ADMIN");
      } else {
        const d = (await r.json().catch(() => ({}))) || {};
        alert(d.message || "Erro ao criar.");
      }
    } catch (ex) {
      console.error("Erro ao criar filiado:", ex);
      alert("Erro.");
    }
  });
}
