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

// Helpers
function toDateInputValue(v) {
  // Aceita: yyyy-MM-dd, yyyy-MM-ddTHH:mm..., dd/MM/yyyy ou null
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
  // Avatar em public/img -> servido como /img/...
  const src = avatarUrl || "/img/avatar-placeholder.png";
  return `<img class="avatar-mini" src="${src}" alt="Avatar ${safeNome}" onerror="this.src='/img/avatar-placeholder.png'">`;
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function inicializarFiliados(perfil) {
  const listaEl = document.getElementById("lista-filiados");
  if (!listaEl) return;

  perfilAtual = (perfil || "").toString().trim().toUpperCase();

  // 1) CSS (premium + robusto + arquivamento + avatar)
  if (!document.getElementById("style-filiados-premium")) {
    const s = document.createElement("style");
    s.id = "style-filiados-premium";
    s.textContent = `
      .search-box-container { background:#003366; padding:20px; border-radius:12px; margin-bottom:25px; box-shadow:0 4px 10px rgba(0,0,0,0.2); color:#fff; }

      .filiado-card { background:#fff; border-left:5px solid #ccc; border-radius:8px; padding:20px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.05); color:#333; transition:transform 0.2s; }
      .filiado-card:hover { transform: translateY(-2px); box-shadow:0 5px 15px rgba(0,0,0,0.1); }
      .status-ativo { border-left-color:#27ae60; }
      .status-veterano { border-left-color:#f39c12; }
      .status-pensionista { border-left-color:#8e44ad; }
      .status-arquivado { border-left-color:#7f8c8d; opacity: 0.96; }

      /* HEADER robusto (não quebra com 2 telefones) */
      .filiado-header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:15px; }
      .filiado-left { display:flex; align-items:flex-start; gap:12px; min-width: 240px; flex: 1; }
      .filiado-info-main { flex: 1; min-width: 200px; }
      .filiado-info-extra { text-align:right; min-width: 180px; }
      .filiado-nome { font-size:1.2rem; font-weight:700; color:#003366; line-height:1.2; margin-bottom:4px; }
      .filiado-meta { font-size:0.9rem; color:#666; margin-top:4px; }
      .filiado-badge { background:#eee; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700; text-transform:uppercase; display:inline-block; margin-bottom:4px; }
      .badge-arquivado { background:#ecf0f1; color:#2c3e50; border:1px solid #bdc3c7; margin-left:8px; }
      .filiado-phones { margin-top:5px; font-size:0.9rem; color:#555; white-space:normal; }

      /* Avatar */
      .avatar-mini { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #e9ecef; background:#f8f9fa; }
      .avatar-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .avatar-preview { width:64px; height:64px; border-radius:50%; object-fit:cover; border:2px solid #e9ecef; background:#f8f9fa; }
      .btn-upload-avatar { background:#34495e; color:#fff; border:none; padding:8px 10px; border-radius:5px; cursor:pointer; font-weight:700; }
      .btn-upload-avatar:hover { background:#2c3e50; }

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
      .cep-wrapper input { width:100%; padding-right:44px; box-sizing:border-box; }
      .btn-buscar-cep-admin {
        border: 1px solid #ccc;
        background: #e9ecef;
        cursor: pointer;
        border-radius: 4px;
        font-size: 1.1rem;
        transition: background 0.2s;
        min-width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        right: 4px;
        top: 50%;
        transform: translateY(-50%);
        padding: 0;
      }
      .btn-buscar-cep-admin:hover { background: #dde2e6; }

      @media (max-width:650px){
        .filiado-header { flex-direction: column; align-items: flex-start; gap: 10px; }
        .filiado-info-extra { text-align: left; margin-top: 5px; width: 100%; min-width: 0; }
        .filiado-left { min-width: 0; }
      }
    `;
    document.head.appendChild(s);
  }

  // 2) Listeners (uma vez)
  if (!handlersConfigurados) {
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

    const campoBusca = document.getElementById("busca-filiados");
    if (campoBusca) {
      const novoInput = campoBusca.cloneNode(true);
      campoBusca.parentNode.replaceChild(novoInput, campoBusca);

      novoInput.addEventListener("input", (e) => filtrarLista(e.target.value));
      if (novoInput.value) setTimeout(() => filtrarLista(novoInput.value), 100);

      // Toggle "Mostrar arquivados"
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

      const tel1Raw = String(f.telefone1 || "").replace(/\D/g, "");
      const tel2Raw = String(f.telefone2 || "").replace(/\D/g, "");
      const tels = [tel1Raw, tel2Raw].filter(Boolean).map(formatarTelefoneTexto).join(" / ");

      const badgeArquivado = arquivado ? `<span class="filiado-badge badge-arquivado">ARQUIVADO</span>` : "";
      const motivoHtml = arquivado
        ? `<div class="filiado-meta">Motivo: ${escapeHtml(f.arquivado_motivo || "-")}</div>`
        : "";

      const header = `
        <div class="filiado-header">
          <div class="filiado-left">
            ${avatarHtml(f.avatar_url, f.nome)}
            <div class="filiado-info-main">
              <div class="filiado-nome">${escapeHtml(f.nome)} ${badgeArquivado}</div>
              <div class="filiado-meta">CPF: ${formatarCPF(f.cpf)} &bull; ${escapeHtml(f.lotacao || "SEDE")}</div>
              ${motivoHtml}
            </div>
          </div>
          <div class="filiado-info-extra">
            <span class="filiado-badge" style="background:${classeStatusBase === "status-ativo" ? "#e8f8f5" : "#fef9e7"}; color:#333;">${situacao}</span>
            <div class="filiado-phones">📞 ${tels || "-"}</div>
          </div>
        </div>
      `;

      if (!podeEditar) return `<div class="filiado-card ${classeStatus}">${header}</div>`;

      const disabledCpf = !podeEditarCpf || arquivado ? 'disabled style="background:#eee; cursor:not-allowed;"' : "";
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

      const dnValue = toDateInputValue(f.data_nascimento);

      return `
        <div class="filiado-card ${classeStatus}">
          ${header}
          <details class="edit-area">
            <summary class="btn-editar-toggle">✏️ Editar dados completos <span class="seta" style="margin-left:5px;">▼</span></summary>
            <form class="form-edit-filiado" data-id="${f.id}" data-arquivado="${arquivado ? "1" : "0"}" style="margin-top:15px;">
              <div class="edit-grid">
                <div class="edit-group"><label>Nome</label><input name="nome" value="${escapeHtml(f.nome)}" ${disabledAll}></div>
                <div class="edit-group"><label>CPF</label><input name="cpf" value="${formatarCPF(f.cpf)}" ${disabledCpf} placeholder="Somente números"></div>

                <div class="edit-group"><label>Data de Nascimento</label><input name="data_nascimento" type="date" value="${dnValue}" ${disabledAll}></div>

                <div class="edit-group"><label>E-mail 1</label><input name="email1" value="${escapeHtml(f.email1 || "")}" ${disabledAll}></div>
                <div class="edit-group"><label>E-mail 2</label><input name="email2" value="${escapeHtml(f.email2 || "")}" ${disabledAll}></div>
                <div class="edit-group"><label>Tel 1</label><input name="telefone1" value="${tel1Raw}" ${disabledAll}></div>
                <div class="edit-group"><label>Tel 2</label><input name="telefone2" value="${tel2Raw}" ${disabledAll}></div>
                <div class="edit-group"><label>Lotação</label><input name="lotacao" value="${escapeHtml(f.lotacao || "")}" ${disabledAll}></div>
                <div class="edit-group"><label>Situação</label>
                  <select name="situacao" ${disabledAll}>
                    ${SITUACAO_OPCOES.map((op) => `<option value="${op}" ${op === situacao ? "selected" : ""}>${op}</option>`).join("")}
                  </select>
                </div>

                <div class="edit-group">
                  <label>Endereço / Bairro</label>
                  <input name="logradouro_bairro" value="${escapeHtml(f.logradouro_bairro || "")}" ${disabledAll} ${arquivado ? "" : 'readonly style="background:#f8f9fa;"'}>
                </div>

                ${adminSection}
              </div>

              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(100px, 1fr)); gap:10px; margin-top:10px;">
                <div class="edit-group"><label>Nº</label><input name="numero" value="${escapeHtml(f.numero || "")}" ${disabledAll}></div>
                <div class="edit-group"><label>Compl.</label><input name="complemento" value="${escapeHtml(f.complemento || "")}" ${disabledAll}></div>

                <div class="edit-group">
                  <label>CEP</label>
                  <div class="cep-wrapper">
                    <input class="campo-cep-admin" name="cep" value="${String(f.cep || "").replace(/\D/g, "")}" maxlength="8" placeholder="00000000" ${disabledAll}>
                    <button type="button" class="btn-buscar-cep-admin" title="Buscar Endereço" ${arquivado ? "disabled" : ""}>🔍</button>
                  </div>
                </div>

                <div class="edit-group">
                  <label>Cidade</label>
                  <input name="cidade" value="${escapeHtml(f.cidade || "")}" ${disabledAll} ${arquivado ? "" : 'readonly style="background:#f8f9fa;"'}>
                </div>
                <div class="edit-group">
                  <label>UF</label>
                  <input name="uf" value="${escapeHtml(f.uf || "")}" maxlength="2" ${disabledAll} ${arquivado ? "" : 'readonly style="background:#f8f9fa; text-transform:uppercase;"'}>
                </div>
              </div>

              <div style="margin-top:14px;">
                <label style="font-size:0.8rem; color:#666; font-weight:bold;">Avatar (foto)</label>
                <div class="avatar-actions">
                  <img class="avatar-preview" src="${f.avatar_url || "/img/avatar-placeholder.png"}" onerror="this.src='/img/avatar-placeholder.png'">
                  <input type="file" name="avatar_file" accept="image/*" ${arquivado ? "disabled" : ""}>
                  <button type="button" class="btn-upload-avatar" ${arquivado ? "disabled" : ""}>Enviar foto</button>
                </div>
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

      aplicarMascaraTelefone(frm.querySelector('input[name="telefone1"]'));
      aplicarMascaraTelefone(frm.querySelector('input[name="telefone2"]'));

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
          btnCep.innerText = "...";

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

        inputCep.addEventListener("blur", () => {
          if (inputCep.value.replace(/\D/g, "").length === 8) btnCep.click();
        });
      }

      const btnAvatar = frm.querySelector(".btn-upload-avatar");
      const inputAvatar = frm.querySelector('input[name="avatar_file"]');
      const imgPreview = frm.querySelector(".avatar-preview");

      if (!arquivado && inputAvatar && imgPreview) {
        inputAvatar.addEventListener("change", () => {
          const file = inputAvatar.files && inputAvatar.files[0];
          if (file) imgPreview.src = URL.createObjectURL(file);
        });
      }

      if (!arquivado && btnAvatar && inputAvatar) {
        btnAvatar.addEventListener("click", async () => {
          const file = inputAvatar.files && inputAvatar.files[0];
          if (!file) return alert("Selecione uma foto (arquivo) antes de enviar.");

          const fd = new FormData();
          fd.append("avatar", file);

          const original = btnAvatar.innerText;
          btnAvatar.disabled = true;
          btnAvatar.innerText = "Enviando...";

          try {
            const r = await apiFetch(`/api/filiados/${id}/avatar`, { method: "POST", body: fd });
            const d = await r.json().catch(() => ({}));

            if (r.ok) {
              const idx = cacheLista.findIndex((i) => String(i.id) === String(id));
              if (idx !== -1) {
                const novoAvatar = d.avatar_url || d.filiado?.avatar_url || cacheLista[idx].avatar_url || null;
                cacheLista[idx].avatar_url = novoAvatar;
              }
              filtrarLista(document.getElementById("busca-filiados")?.value || "");
              alert("Foto enviada com sucesso.");
            } else {
              alert(d.message || d.error || "Não foi possível enviar a foto.");
            }
          } catch {
            alert("Erro de conexão ao enviar foto.");
          } finally {
            btnAvatar.disabled = false;
            btnAvatar.innerText = original;
          }
        });
      }

      frm.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const action = btn.dataset.action;

          if (action === "arquivar") {
            const motivo = prompt("Motivo do arquivamento (ex.: desligado, óbito, a pedido):") || "";
            if (!confirm("Confirmar arquivamento deste cadastro?")) return;

            try {
              const r = await apiFetch(`/api/filiados/${id}/arquivar`, { method: "POST", body: { motivo } });

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
              const r = await apiFetch(`/api/filiados/${id}/desarquivar`, { method: "POST", body: {} });

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
          if (k === "avatar_file") return;
          if (k.includes("telefone") || k === "cep" || k === "cpf") payload[k] = String(v).replace(/\D/g, "");
          else payload[k] = v;
        });

        if (!ehAdmin) delete payload.perfil_acesso;

        const podeEditarCpfNoSubmit = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);
        if (!podeEditarCpfNoSubmit) delete payload.cpf;

        try {
          const r = await apiFetch(`/api/filiados/${id}`, { method: "PUT", body: payload });
          const d = await r.json().catch(() => ({}));

          if (r.ok) {
            alert("Salvo com sucesso!");
            const idx = cacheLista.findIndex((i) => String(i.id) === String(id));
            if (idx !== -1) cacheLista[idx] = { ...cacheLista[idx], ...payload };
            filtrarLista(document.getElementById("busca-filiados")?.value || "");
          } else if (r.status === 409) {
            alert(d.message || "CPF já cadastrado para outro filiado.");
          } else {
            alert(d.message || "Erro ao salvar.");
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
      const d = await r.json().catch(() => ({}));

      if (r && r.ok) {
        alert("Criado!");
        container.innerHTML = "";
        await carregarLista();
      } else {
        alert(d.message || d.error || "Erro ao criar.");
      }
    } catch {
      alert("Erro de conexão.");
    }
  });
}
