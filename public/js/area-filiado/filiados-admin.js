import {
  apiFetch,
  aplicarMascaraTelefone,
  formatarCPF,
  normalizarTextoBusca,
  formatarTelefoneTexto,
} from "./utils.js";

let cacheLista = [];
const SITUACAO_OPCOES = ["ATIVO", "VETERANO", "PENSIONISTA"];

// Variáveis de estado
let perfilAtual = null;
let handlersConfigurados = false;

export async function inicializarFiliados(perfil) {
  const listaEl = document.getElementById("lista-filiados");
  if (!listaEl) return;

  perfilAtual = (perfil || "").toString().trim().toUpperCase();

  // 1) CSS
  if (!document.getElementById("style-filiados-premium")) {
    const s = document.createElement("style");
    s.id = "style-filiados-premium";
    s.textContent = `
      .filiado-card { background:#fff; border-left:5px solid #ccc; border-radius:8px; padding:20px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05); color:#333; transition:transform 0.2s; }
      .filiado-card:hover { transform: translateY(-2px); box-shadow:0 5px 15px rgba(0,0,0,0.1); }
      .status-ativo { border-left-color:#27ae60; }
      .status-veterano { border-left-color:#f39c12; }
      .status-pensionista { border-left-color:#8e44ad; }
      .status-arquivado { border-left-color:#7f8c8d; }

      .filiado-header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; }
      .filiado-nome { font-size:1.2rem; font-weight:700; color:#003366; }
      .filiado-meta { font-size:0.9rem; color:#666; margin-top:4px; }
      .filiado-badge { background:#eee; padding:4px 8px; border-radius:4px; font-size:0.8rem; font-weight:700; text-transform:uppercase; display:inline-block; }
      .badge-arquivado { background:#ecf0f1; color:#2c3e50; border:1px solid #bdc3c7; margin-left:8px; }

      details.edit-area { margin-top:15px; border-top:1px solid #eee; padding-top:15px; }
      summary.btn-editar-toggle { cursor:pointer; color:#2980b9; font-weight:600; list-style:none; display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:4px; transition:background 0.2s; }
      summary.btn-editar-toggle:hover { background:#f0f7ff; }
      details[open] summary.btn-editar-toggle .seta { transform:rotate(180deg); }
      .seta { transition:transform 0.2s; display:inline-block; }

      .edit-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:15px; margin-top:15px; }
      .edit-group { display:flex; flex-direction:column; }
      .edit-group label { font-size:0.8rem; color:#666; margin-bottom:4px; font-weight:700; }
      .edit-group input, .edit-group select { padding:8px; border:1px solid #ccc; border-radius:4px; color:#333; background:#fff; font-size:0.95rem; }
      .edit-group input:focus, .edit-group select:focus { border-color:#2980b9; outline:none; }
      .admin-field input, .admin-field select { background-color:#fff8e1; border-color:#f1c40f; }

      .btn-save { background:#27ae60; color:#fff; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:700; margin-top:15px; width:100%; }
      .btn-save:hover { background:#219150; }

      .btn-archive { background:#7f8c8d; color:#fff; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:700; margin-top:10px; width:100%; }
      .btn-archive:hover { background:#6c7a7a; }

      .btn-unarchive { background:#2980b9; color:#fff; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:700; margin-top:10px; width:100%; }
      .btn-unarchive:hover { background:#2471a3; }

      .row-filtros { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-top:10px; }
      .row-filtros label { font-size:0.9rem; display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none; }

      .cep-wrapper { position:relative; }
      .cep-wrapper input { width:100%; padding-right:40px; box-sizing:border-box; }
      .btn-buscar-cep-admin {
        position:absolute; right:5px; top:50%; transform:translateY(-50%);
        border:none; background:transparent; cursor:pointer; font-size:1.2rem; padding:5px; color:#2980b9; transition:transform 0.2s;
      }
      .btn-buscar-cep-admin:hover { transform:translateY(-50%) scale(1.1); color:#1abc9c; }

      @media (max-width:600px){ .filiado-header{flex-direction:column;} }
    `;
    document.head.appendChild(s);
  }

  // 2) Listeners (uma vez)
  if (!handlersConfigurados) {
    // Botão novo filiado
    const btnNovo = document.getElementById("btn-novo-filiado");
    const containerNovo = document.getElementById("novo-filiado-container");

    if (btnNovo) {
      if (["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual)) {
        btnNovo.style.display = "inline-block";
        const novoBtn = btnNovo.cloneNode(true);
        btnNovo.parentNode.replaceChild(novoBtn, btnNovo);
        novoBtn.addEventListener("click", () => abrirNovoFiliado(containerNovo));
      } else {
        btnNovo.style.display = "none";
      }
    }

    // Campo busca
    const campoBusca = document.getElementById("busca-filiados");
    if (campoBusca) {
      const novoInput = campoBusca.cloneNode(true);
      campoBusca.parentNode.replaceChild(novoInput, campoBusca);

      novoInput.addEventListener("input", (e) => filtrarLista(e.target.value));
      if (novoInput.value) setTimeout(() => filtrarLista(novoInput.value), 100);

      // ✅ Toggle "Mostrar arquivados" – injeção garantida (independe de classes do container)
      if (!document.getElementById("chk-incluir-arquivados")) {
        const filtros = document.createElement("div");
        filtros.className = "row-filtros";
        filtros.innerHTML = `
          <label>
            <input type="checkbox" id="chk-incluir-arquivados" />
            Mostrar arquivados
          </label>
        `;

        novoInput.insertAdjacentElement("afterend", filtros);

        filtros.querySelector("#chk-incluir-arquivados").addEventListener("change", () => {
          carregarLista();
        });
      }
    }

    handlersConfigurados = true;
  }

  // 3) Carrega dados
  await carregarLista();
}

async function carregarLista() {
  const listaEl = document.getElementById("lista-filiados");
  if (!listaEl) return;

  try {
    listaEl.innerHTML = `<p style="color:#fff; text-align:center;">Carregando base de dados...</p>`;

    const incluirArquivados = !!document.getElementById("chk-incluir-arquivados")?.checked;
    const url = incluirArquivados ? "/api/filiados?incluirArquivados=1" : "/api/filiados";

    const r = await apiFetch(url);
    if (r && r.ok) {
      const d = await r.json();
      cacheLista = d.filiados || d || [];
      filtrarLista(document.getElementById("busca-filiados")?.value || "");
    } else {
      listaEl.innerHTML = `<p style="color:#e74c3c; text-align:center;">Erro ao carregar lista.</p>`;
    }
  } catch (e) {
    console.error(e);
    listaEl.innerHTML = `<p style="color:#e74c3c; text-align:center;">Erro de conexão.</p>`;
  }
}

function filtrarLista(termo) {
  const el = document.getElementById("lista-filiados");
  if (!el) return;

  const t = normalizarTextoBusca(termo || "");
  const res = cacheLista.filter((f) => {
    const nome = normalizarTextoBusca(f?.nome || "");
    const cpf = normalizarTextoBusca(f?.cpf || "");
    return nome.includes(t) || cpf.includes(t);
  });

  if (!res.length) {
    el.innerHTML = `<div style="background:#fff; color:#333; padding:20px; border-radius:8px; text-align:center;">Nenhum filiado encontrado.</div>`;
    return;
  }

  const podeEditar = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);
  const ehAdmin = perfilAtual === "ADMIN";
  const podeEditarCpf = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);
  const podeArquivar = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);

  el.innerHTML = res
    .map((f) => {
      const arquivado = !!f.arquivado_em;

      const situacao = (f.situacao || "ATIVO").toUpperCase();
      const classeStatusBase =
        situacao === "ATIVO"
          ? "status-ativo"
          : situacao === "VETERANO"
          ? "status-veterano"
          : "status-pensionista";

      const classeStatus = arquivado ? "status-arquivado" : classeStatusBase;

      // Telefones (card)
      const tel1Raw = String(f.telefone1 || "").replace(/\D/g, "");
      const tel2Raw = String(f.telefone2 || "").replace(/\D/g, "");
      const tels = [tel1Raw, tel2Raw].filter(Boolean).map(formatarTelefoneTexto).join(" / ");

      const badgeArquivado = arquivado
        ? `<span class="filiado-badge badge-arquivado">ARQUIVADO</span>`
        : "";

      const header = `
        <div class="filiado-header">
          <div>
            <div class="filiado-nome">${f.nome} ${badgeArquivado}</div>
            <div class="filiado-meta">CPF: ${formatarCPF(f.cpf)} &bull; ${f.lotacao || "SEDE"}</div>
            ${arquivado ? `<div class="filiado-meta">Motivo: ${f.arquivado_motivo || "-"}</div>` : ""}
          </div>
          <div style="text-align:right;">
            <span class="filiado-badge" style="background:${classeStatusBase === "status-ativo" ? "#e8f8f5" : "#fef9e7"}; color:#333;">${situacao}</span>
            <div style="margin-top:5px; font-size:0.9rem; color:#555;">📞 ${tels || "-"}</div>
          </div>
        </div>
      `;

      if (!podeEditar) return `<div class="filiado-card ${classeStatus}">${header}</div>`;

      // Inputs: se arquivado, desabilita (evita edição acidental)
      const disabledCpf =
        !podeEditarCpf || arquivado ? 'disabled style="background:#eee; cursor:not-allowed;"' : "";
      const disabledAll = arquivado ? 'disabled style="background:#eee; cursor:not-allowed;"' : "";

      const adminSection = ehAdmin
        ? `
          <div class="edit-group admin-field">
            <label>Perfil de Acesso (ADMIN)</label>
            <select name="perfil_acesso" ${disabledAll}>
              <option value="FILIADO" ${f.perfil_acesso === "FILIADO" ? "selected" : ""}>FILIADO</option>
              <option value="ORGANIZADOR" ${f.perfil_acesso === "ORGANIZADOR" ? "selected" : ""}>ORGANIZADOR</option>
              <option value="FUNCIONARIO" ${f.perfil_acesso === "FUNCIONARIO" ? "selected" : ""}>FUNCIONARIO</option>
              <option value="DIRETORIA" ${f.perfil_acesso === "DIRETORIA" ? "selected" : ""}>DIRETORIA</option>
              <option value="ADMIN" ${f.perfil_acesso === "ADMIN" ? "selected" : ""}>ADMIN</option>
            </select>
          </div>
        `
        : "";

      return `
        <div class="filiado-card ${classeStatus}">
          ${header}
          <details class="edit-area">
            <summary class="btn-editar-toggle">✏️ Editar dados completos <span class="seta" style="margin-left:5px;">▼</span></summary>
            <form class="form-edit-filiado" data-id="${f.id}" data-arquivado="${arquivado ? "1" : "0"}" style="margin-top:15px;">
              <div class="edit-grid">
                <div class="edit-group"><label>Nome</label><input name="nome" value="${f.nome}" ${disabledAll}></div>
                <div class="edit-group"><label>CPF</label><input name="cpf" value="${formatarCPF(f.cpf)}" ${disabledCpf} placeholder="Somente números"></div>
                <div class="edit-group"><label>E-mail 1</label><input name="email1" value="${f.email1 || ""}" ${disabledAll}></div>
                <div class="edit-group"><label>E-mail 2</label><input name="email2" value="${f.email2 || ""}" ${disabledAll}></div>
                <div class="edit-group"><label>Tel 1</label><input name="telefone1" value="${tel1Raw}" ${disabledAll}></div>
                <div class="edit-group"><label>Tel 2</label><input name="telefone2" value="${tel2Raw}" ${disabledAll}></div>
                <div class="edit-group"><label>Lotação</label><input name="lotacao" value="${f.lotacao || ""}" ${disabledAll}></div>
                <div class="edit-group"><label>Situação</label>
                  <select name="situacao" ${disabledAll}>
                    ${SITUACAO_OPCOES.map((op) => `<option value="${op}" ${op === situacao ? "selected" : ""}>${op}</option>`).join("")}
                  </select>
                </div>
                <div class="edit-group"><label>Endereço / Bairro</label><input name="logradouro_bairro" value="${f.logradouro_bairro || ""}" ${disabledAll}></div>
                ${adminSection}
              </div>

              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(100px, 1fr)); gap:10px; margin-top:10px;">
                <div class="edit-group"><label>Nº</label><input name="numero" value="${f.numero || ""}" ${disabledAll}></div>
                <div class="edit-group"><label>Compl.</label><input name="complemento" value="${f.complemento || ""}" ${disabledAll}></div>
                <div class="edit-group">
                  <label>CEP</label>
                  <div class="cep-wrapper">
                    <input name="cep" value="${f.cep || ""}" maxlength="8" placeholder="00000000" ${disabledAll}>
                    <button type="button" class="btn-buscar-cep-admin" title="Buscar Endereço" ${arquivado ? "disabled" : ""}>🔍</button>
                  </div>
                </div>
                <div class="edit-group"><label>Cidade</label><input name="cidade" value="${f.cidade || ""}" ${disabledAll}></div>
                <div class="edit-group"><label>UF</label><input name="uf" value="${f.uf || ""}" maxlength="2" ${disabledAll}></div>
              </div>

              ${!arquivado ? `<button type="submit" class="btn-save">💾 Salvar Alterações</button>` : ""}

              ${
                podeArquivar
                  ? `
                    ${!arquivado ? `<button type="button" class="btn-archive" data-action="arquivar">📦 Arquivar cadastro</button>` : ""}
                    ${arquivado ? `<button type="button" class="btn-unarchive" data-action="desarquivar">↩️ Desarquivar cadastro</button>` : ""}
                  `
                  : ""
              }
            </form>
          </details>
        </div>
      `;
    })
    .join("");

  // Listeners pós-render
  if (podeEditar) {
    el.querySelectorAll("form.form-edit-filiado").forEach((frm) => {
      const arquivado = frm.dataset.arquivado === "1";
      const id = frm.dataset.id;

      // Máscaras telefone (utils já aplica formatação inicial também)
      aplicarMascaraTelefone(frm.querySelector('input[name="telefone1"]'));
      aplicarMascaraTelefone(frm.querySelector('input[name="telefone2"]'));

      // Máscara CPF (somente se editável)
      const inputCpf = frm.querySelector('input[name="cpf"]');
      if (inputCpf && !inputCpf.disabled) {
        inputCpf.addEventListener("input", (e) => {
          let v = e.target.value.replace(/\D/g, "").slice(0, 11);
          if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
          else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
          else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
          e.target.value = v;
        });
      }

      // CEP + ViaCEP (apenas se não arquivado)
      const inputCep = frm.querySelector('input[name="cep"]');
      const btnCep = frm.querySelector(".btn-buscar-cep-admin");

      if (!arquivado && inputCep) {
        inputCep.addEventListener("input", (e) => {
          e.target.value = e.target.value.replace(/\D/g, "").slice(0, 8);
        });
      }

      if (!arquivado && btnCep && inputCep) {
        btnCep.addEventListener("click", async () => {
          const cepVal = inputCep.value.replace(/\D/g, "");
          if (cepVal.length !== 8) return alert("CEP inválido. Digite 8 números.");

          const originalText = btnCep.innerText;
          btnCep.innerText = "⏳";

          try {
            const r = await fetch(`https://viacep.com.br/ws/${cepVal}/json/`);
            const d = await r.json();
            if (d.erro) {
              alert("CEP não encontrado.");
            } else {
              const enderecoCompleto = [d.logradouro, d.bairro].filter(Boolean).join(", ");
              const lb = frm.querySelector('input[name="logradouro_bairro"]');
              const cid = frm.querySelector('input[name="cidade"]');
              const uf = frm.querySelector('input[name="uf"]');
              if (lb) lb.value = enderecoCompleto;
              if (cid) cid.value = d.localidade || "";
              if (uf) uf.value = d.uf || "";
            }
          } catch {
            alert("Erro ao buscar CEP.");
          } finally {
            btnCep.innerText = originalText;
          }
        });
      }

      // Arquivar / Desarquivar
      frm.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const action = btn.dataset.action;

          if (action === "arquivar") {
            const motivo =
              prompt("Motivo do arquivamento (ex.: desligado, óbito, a pedido):") || "";
            if (!confirm("Confirmar arquivamento deste cadastro?")) return;

            try {
              const r = await apiFetch(`/api/filiados/${id}/arquivar`, {
                method: "POST",
                body: { motivo },
              });

              if (r.ok) {
                alert("Cadastro arquivado.");
                await carregarLista();
              } else {
                let msg = "Erro ao arquivar.";
                try {
                  const d = await r.json();
                  if (d?.message) msg = d.message;
                } catch {}
                alert(msg);
              }
            } catch {
              alert("Erro de conexão.");
            }
          }

          if (action === "desarquivar") {
            if (!confirm("Confirmar desarquivamento deste cadastro?")) return;

            try {
              const r = await apiFetch(`/api/filiados/${id}/desarquivar`, {
                method: "POST",
                body: {},
              });

              if (r.ok) {
                alert("Cadastro desarquivado.");
                await carregarLista();
              } else {
                let msg = "Erro ao desarquivar.";
                try {
                  const d = await r.json();
                  if (d?.message) msg = d.message;
                } catch {}
                alert(msg);
              }
            } catch {
              alert("Erro de conexão.");
            }
          }
        });
      });

      // Submit (somente se não arquivado)
      frm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (arquivado) {
          alert("Cadastro arquivado não pode ser editado. Desarquive primeiro.");
          return;
        }

        const btn = frm.querySelector(".btn-save");
        const txtOriginal = btn?.innerText || "Salvar";
        if (btn) {
          btn.disabled = true;
          btn.innerText = "Salvando...";
        }

        const fd = new FormData(frm);
        const payload = {};
        fd.forEach((v, k) => {
          if (k.includes("telefone") || k === "cep" || k === "cpf") payload[k] = String(v).replace(/\D/g, "");
          else payload[k] = v;
        });

        // perfil_acesso: somente ADMIN
        const ehAdmin = perfilAtual === "ADMIN";
        if (!ehAdmin) delete payload.perfil_acesso;

        // cpf: ADMIN/DIRETORIA/FUNCIONARIO
        const podeEditarCpfNoSubmit = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);
        if (!podeEditarCpfNoSubmit) delete payload.cpf;

        try {
          const r = await apiFetch(`/api/filiados/${id}`, { method: "PUT", body: payload });

          if (r.ok) {
            alert("Salvo com sucesso!");
            await carregarLista();
          } else {
            let erroMsg = "Erro ao salvar.";
            try {
              const errData = await r.json();
              if (errData?.message) erroMsg = errData.message;
            } catch {}
            alert(erroMsg);
          }
        } catch {
          alert("Erro de conexão.");
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerText = txtOriginal;
          }
        }
      });
    });
  }
}

function abrirNovoFiliado(container) {
  if (!container) return;
  if (container.innerHTML !== "") {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="section-box" style="background:#fff; color:#333; padding:25px; border-radius:12px; margin-bottom:25px; border-left:6px solid #2980b9; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
      <h3 style="color:#003366; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:20px;">👤 Cadastrar Novo Filiado</h3>
      <form id="form-novo-filiado">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
          <div>
            <label style="font-weight:700; display:block; margin-bottom:5px;">Nome *</label>
            <input name="nome" required style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;">
          </div>
          <div>
            <label style="font-weight:700; display:block; margin-bottom:5px;">CPF *</label>
            <input name="cpf" required placeholder="Somente números" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
          <div>
            <label style="font-weight:700; display:block; margin-bottom:5px;">E-mail *</label>
            <input name="email1" type="email" required style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;">
          </div>
          <div>
            <label style="font-weight:700; display:block; margin-bottom:5px;">Situação</label>
            <select name="situacao" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;">
              ${SITUACAO_OPCOES.map((op) => `<option value="${op}">${op}</option>`).join("")}
            </select>
          </div>
        </div>

        <div style="display:flex; gap:10px; margin-top:20px;">
          <button class="btn btn-primary" style="flex:1; padding:12px;" type="submit">Criar Cadastro</button>
          <button type="button" id="btn-cancelar-novo" class="btn btn-outline" style="flex:0 0 120px; color:#333; border-color:#999;">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  // Máscara de CPF no formulário de criação
  const inputCpf = container.querySelector('input[name="cpf"]');
  if (inputCpf) {
    inputCpf.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
      else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
      e.target.value = v;
    });
  }

  const btnCancelar = container.querySelector("#btn-cancelar-novo");
  if (btnCancelar) btnCancelar.addEventListener("click", () => (container.innerHTML = ""));

  const form = container.querySelector("form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());

    payload.perfil_acesso = "FILIADO";
    payload.cpf = (payload.cpf || "").replace(/\D/g, "");

    try {
      const r = await apiFetch("/api/filiados", { method: "POST", body: payload });

      if (r && r.ok) {
        alert("Criado!");
        container.innerHTML = "";
        await carregarLista();
      } else {
        let msg = "Erro ao criar.";
        try {
          const d = await r.json();
          if (d?.message) msg = d.message;
        } catch {}
        alert(msg);
      }
    } catch {
      alert("Erro de conexão.");
    }
  });
}
