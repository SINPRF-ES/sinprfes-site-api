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
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
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
        <p style="margin:0;"><strong>Prazo:</strong> ${parseDate(poll.deadline_at)}</p>
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
        <p style="margin:0;"><strong>Prazo:</strong> ${parseDate(poll.deadline_at)} ${isClosed ? "(Encerrada)" : "(Ativa)"}</p>
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

  function abrirModalNovaEnquete() {
    document.getElementById("modal-generic-titulo").textContent = "➕ Nova enquete";
    document.getElementById("modal-generic-corpo").innerHTML = `
      <form id="enquete-form" class="form-container" style="display:flex; flex-direction:column; gap:12px;">
        <label>Pergunta* <input name="title" required /></label>
        <label>Tipo
          <select name="type" id="enquete-type">
            <option value="YES_NO">Sim / Não</option>
            <option value="MULTIPLE_CHOICE">Múltipla escolha</option>
          </select>
        </label>
        <label><input type="checkbox" name="allow_multiple_answers" /> Permitir mais de uma resposta por usuário</label>
        <label><input type="checkbox" name="allow_other_option" /> Permitir resposta livre (Outro)</label>
        <label>Opções (uma por linha, para múltipla escolha)
          <textarea name="options" rows="4" placeholder="100&#10;200&#10;300"></textarea>
        </label>
        <label>Data limite* <input type="datetime-local" name="deadline_at" required /></label>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button type="button" class="ui-button ui-button-outline" onclick="Utils.fecharModal('modal-generic')">Cancelar</button>
          <button type="submit" class="ui-button ui-button-secondary">Salvar enquete</button>
        </div>
      </form>
    `;
    document.getElementById("modal-generic").style.display = "flex";

    const form = document.getElementById("enquete-form");
    const typeSelect = document.getElementById("enquete-type");
    const optionsField = form.querySelector("textarea[name='options']");

    const toggleOptionsVisibility = () => {
      optionsField.closest("label").style.display = typeSelect.value === "MULTIPLE_CHOICE" ? "block" : "none";
    };
    typeSelect.onchange = toggleOptionsVisibility;
    toggleOptionsVisibility();

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const payload = {
        title: String(fd.get("title") || "").trim(),
        type: String(fd.get("type") || "YES_NO"),
        allow_multiple_answers: fd.get("allow_multiple_answers") === "on",
        allow_other_option: fd.get("allow_other_option") === "on",
        deadline_at: fd.get("deadline_at"),
        options: String(fd.get("options") || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
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
