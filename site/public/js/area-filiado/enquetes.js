(function (window) {
  const state = {
    status: "ativas",
    polls: [],
    initialized: false,
    canManage: false,
  };

  function escapeHtml(text) {
    return (window.Utils?.escapeHTML ? window.Utils.escapeHTML(text) : String(text || ""));
  }

  function parseDate(value) {
    if (!value) return "-";
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const [y, m, d] = String(value).split("-");
      return `${d}/${m}/${y}`;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("pt-BR");
  }

  async function fetchPolls() {
    const res = await window.Api.apiFetch(`/api/polls?status=${state.status}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Erro ao carregar enquetes.");
    state.polls = data.polls || [];
    renderList();
  }

  function renderList() {
    const list = document.getElementById("enquetes-list");
    if (!list) return;

    if (!state.polls.length) {
      list.innerHTML = `<div class="ui-card"><p style="margin:0;">Nenhuma enquete em ${state.status}.</p></div>`;
      return;
    }

    list.innerHTML = state.polls.map((poll) => `
      <article class="ui-card" style="display:flex; flex-direction:column; gap:10px;">
        <h3 style="margin:0; color:var(--azul-fundo);">${escapeHtml(poll.title)}</h3>
        <p style="margin:0;"><strong>Data limite:</strong> ${parseDate(poll.deadline_date || poll.deadline_at)}</p>
        <p style="margin:0;"><strong>Participantes:</strong> ${Number(poll.participants || 0)}</p>
        <div>
          <button class="ui-button ui-button-outline" onclick="Enquetes.abrirEnquete(${poll.id})">Abrir enquete</button>
        </div>
      </article>
    `).join("");
  }

  async function abrirEnquete(id) {
    const res = await window.Api.apiFetch(`/api/polls/${id}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || "Erro ao abrir enquete.");
      return;
    }

    const poll = data.poll;
    const isClosed = poll.status === "CLOSED";
    const inputType = poll.allow_multiple_answers ? "checkbox" : "radio";
    const selected = new Set((poll.my_votes || []).map((v) => Number(v.option_id)));

    document.getElementById("modal-generic-titulo").textContent = "🗨️ Enquete";
    document.getElementById("modal-generic-corpo").innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <h3 style="margin:0;">${escapeHtml(poll.title)}</h3>
        <p style="margin:0;"><strong>Data limite:</strong> ${parseDate(poll.deadline_date || poll.deadline_at)} ${isClosed ? "(Encerrada)" : "(Ativa até o fim do dia)"}</p>
        <form id="enquete-voto-form" style="display:flex; flex-direction:column; gap:10px;">
          ${(poll.options || []).map((opt) => {
            const checked = selected.has(Number(opt.id)) ? "checked" : "";
            return `<label style="display:flex; gap:8px; align-items:center;">
              <input type="${inputType}" name="enquete-opcao" value="${opt.id}" ${checked} ${isClosed ? "disabled" : ""}>
              <span>${escapeHtml(opt.label)}</span>
            </label>`;
          }).join("")}
          ${!isClosed ? '<button type="submit" class="ui-button ui-button-secondary">Salvar voto</button>' : ""}
        </form>
        <hr>
        <h4 style="margin:0;">${isClosed ? "Resultado final" : "Resultado parcial"}</h4>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${(poll.options || []).map((opt) => `
            <div class="ui-card" style="padding:10px;">
              <strong>${escapeHtml(opt.label)} — ${opt.votes_count || 0} votos</strong>
              <ul style="margin:8px 0 0 18px;">
                ${(opt.voters || []).map((v) => `<li>${escapeHtml(v.nome || "Usuário")} ${v.other_text ? `— ${escapeHtml(v.other_text)}` : ""}</li>`).join("") || "<li>Nenhum voto.</li>"}
              </ul>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    document.getElementById("modal-generic").style.display = "flex";
    const form = document.getElementById("enquete-voto-form");

    if (form && !isClosed) {
      form.onsubmit = async (ev) => {
        ev.preventDefault();
        const checked = Array.from(form.querySelectorAll("input[name='enquete-opcao']:checked"));
        if (!checked.length) {
          alert("Selecione ao menos uma opção.");
          return;
        }

        const otherInputByOption = {};
        checked.forEach((el) => {
          const optionId = Number(el.value);
          const option = (poll.options || []).find((o) => Number(o.id) === optionId);
          if (option && option.is_other) {
            const text = prompt("Informe sua resposta");
            if (text !== null) otherInputByOption[optionId] = String(text).trim();
          }
        });

        const voteRes = await window.Api.apiFetch(`/api/polls/${id}/vote`, {
          method: "POST",
          body: {
            option_ids: checked.map((el) => Number(el.value)),
            other_texts: otherInputByOption,
          },
        });
        const voteData = await voteRes.json();
        if (!voteRes.ok || !voteData.success) {
          alert(voteData.error || "Erro ao salvar voto.");
          return;
        }

        await abrirEnquete(id);
        await fetchPolls();
      };
    }
  }

  function bindEvents() {
    const filter = document.getElementById("enquetes-filtro-status");
    if (filter) {
      filter.onchange = async (event) => {
        state.status = String(event.target.value || "ativas");
        await fetchPolls();
      };
    }

    const btnNovo = document.getElementById("btn-nova-enquete");
    if (btnNovo) {
      btnNovo.onclick = () => abrirModalNovaEnquete();
      btnNovo.style.display = state.canManage ? "inline-flex" : "none";
    }
  }

  function renderOptionsFields(root, count) {
    root.innerHTML = "";
    for (let index = 0; index < count; index += 1) {
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.gap = "8px";
      item.style.alignItems = "center";
      item.innerHTML = `
        <label style="flex:1; margin:0;">Opção ${index + 1}
          <input name="mc_option_${index + 1}" placeholder="Texto da opção ${index + 1}" required />
        </label>
        ${index >= 2 ? `<button type="button" class="ui-button ui-button-outline" data-remove-index="${index}" style="margin-top:18px;">Remover</button>` : ""}
      `;
      root.appendChild(item);
    }

    root.querySelectorAll("button[data-remove-index]").forEach((btn) => {
      btn.onclick = () => {
        if (count <= 2) return;
        renderOptionsFields(root, count - 1);
      };
    });
  }

  function abrirModalNovaEnquete() {
    document.getElementById("modal-generic-titulo").textContent = "➕ Nova enquete";
    document.getElementById("modal-generic-corpo").innerHTML = `
      <form id="enquete-form" class="form-container" style="display:flex; flex-direction:column; gap:12px;">
        <label>Pergunta* 
          <textarea name="title" rows="3" required placeholder="Digite a pergunta da enquete"></textarea>
        </label>
        <label>Tipo
          <select name="type" id="enquete-type">
            <option value="YES_NO">Sim / Não</option>
            <option value="MULTIPLE_CHOICE">Múltipla escolha</option>
          </select>
        </label>
        <div id="enquete-multiple-config" style="display:none; flex-direction:column; gap:10px;">
          <label><input type="checkbox" name="allow_multiple_answers" /> Permitir mais de uma resposta por usuário</label>
          <label><input type="checkbox" name="allow_other_option" /> Permitir resposta livre (Outro)</label>
          <div>
            <strong>Opções da enquete</strong>
            <div id="enquete-options-list" style="display:flex; flex-direction:column; gap:8px; margin-top:8px;"></div>
            <p style="margin:6px 0 0; font-size:12px;">Deseja adicionar outra opção?</p>
            <button type="button" id="btn-add-option" class="ui-button ui-button-outline">+ Adicionar opção</button>
          </div>
        </div>
        <label>Data limite* <input type="date" name="deadline_date" required /></label>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button type="button" class="ui-button ui-button-outline" onclick="Utils.fecharModal('modal-generic')">Cancelar</button>
          <button type="submit" class="ui-button ui-button-secondary">Salvar enquete</button>
        </div>
      </form>
    `;
    document.getElementById("modal-generic").style.display = "flex";

    const form = document.getElementById("enquete-form");
    const typeSelect = document.getElementById("enquete-type");
    const multipleConfig = document.getElementById("enquete-multiple-config");
    const optionsList = document.getElementById("enquete-options-list");
    const btnAddOption = document.getElementById("btn-add-option");

    let optionsCount = 2;
    renderOptionsFields(optionsList, optionsCount);

    btnAddOption.onclick = () => {
      optionsCount += 1;
      renderOptionsFields(optionsList, optionsCount);
    };

    const toggleOptionsVisibility = () => {
      const isMultiple = typeSelect.value === "MULTIPLE_CHOICE";
      multipleConfig.style.display = isMultiple ? "flex" : "none";
    };

    typeSelect.onchange = toggleOptionsVisibility;
    toggleOptionsVisibility();

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const type = String(fd.get("type") || "YES_NO");
      const options = [];

      if (type === "MULTIPLE_CHOICE") {
        for (let index = 1; index <= optionsCount; index += 1) {
          const value = String(fd.get(`mc_option_${index}`) || "").trim();
          if (value) options.push(value);
        }
      }

      const payload = {
        title: String(fd.get("title") || "").trim(),
        type,
        allow_multiple_answers: type === "MULTIPLE_CHOICE" && fd.get("allow_multiple_answers") === "on",
        allow_other_option: type === "MULTIPLE_CHOICE" && fd.get("allow_other_option") === "on",
        deadline_date: String(fd.get("deadline_date") || ""),
        options,
      };

      const createRes = await window.Api.apiFetch("/api/polls", { method: "POST", body: payload });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) {
        alert(createData.error || "Erro ao criar enquete.");
        return;
      }

      await window.Api.apiFetch(`/api/polls/${createData.poll.id}/publish`, { method: "POST" });
      window.Utils.fecharModal("modal-generic");
      await fetchPolls();
    };
  }

  async function inicializarEnquetes() {
    state.canManage = !!((window.Utils?.obterUserInfo?.().permissions || []).find((perm) => perm === "*" || perm === "ENQUETES_GERENCIAR"));
    if (!state.canManage) {
      const root = document.getElementById("sec-enquetes");
      if (root) root.innerHTML = '<div class="ui-card"><p>Acesso restrito à diretoria.</p></div>';
      return;
    }

    if (!state.initialized) {
      bindEvents();
      state.initialized = true;
    }

    await fetchPolls();
  }

  window.Enquetes = {
    inicializarEnquetes,
    abrirEnquete,
  };
})(window);
