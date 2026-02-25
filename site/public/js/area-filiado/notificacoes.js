/**
 * Módulo de Notificações Push (Página Inicial)
 */
(function (window) {
  if (window.Notificacoes) return;

  let historyCache = [];
  let isShowingArchived = false;

  let isLoadingMe = false;
  let isLoadingGestao = false;

  // Evita duplicar handlers se inicializar múltiplas vezes
  let _handlersReady = false;

  /**
   * Canon: busca o usuário completo do servidor se faltarem permissões.
   */
  async function getUserCanon(user) {
    // 1) Se já temos permissões, retorna
    if (user && Array.isArray(user.permissions) && user.permissions.length > 0) return user;

    // 2) Tenta cache do Utils
    const cached = window.Utils?.obterUserInfo();
    if (cached && Array.isArray(cached.permissions) && cached.permissions.length > 0) return cached;

    // 3) Busca oficial no backend (/api/auth/me é o mais leve para permissões)
    try {
      console.log("[Notificacoes] Fetching canon user from /api/auth/me...");
      const r = await window.Api.apiFetch("/api/auth/me");
      if (r && r.ok) {
        const info = await r.json();
        if (info && info.permissions) {
          localStorage.setItem("userInfo", JSON.stringify(info));
          return info;
        }
      }
    } catch (e) {
      console.error("[Notificacoes] Error fetching canon user", e);
    }

    return cached || user || {};
  }

  // Helper: aplica display com prioridade
  function setDisplay(el, value) {
    if (!el) return;
    el.style.setProperty("display", value, "important");
  }

  function ensureNotificationsSectionVisible() {
    const sec = document.getElementById("sec-notificacoes");
    if (!sec) return;

    // Garante que a seção não fica presa em display none por alguma corrida
    sec.classList.add("active");
    setDisplay(sec, "block");
    sec.style.setProperty("visibility", "visible", "important");
    sec.style.setProperty("opacity", "1", "important");
    sec.style.setProperty("max-height", "none", "important");
    sec.style.setProperty("position", "relative", "important");
    sec.style.setProperty("z-index", "1", "important");
  }

  function applyNotificationsMode(params) {
    const { isGestao, permissions } = params;

    ensureNotificationsSectionVisible();

    const adminContainer = document.getElementById("notificacoes-admin-container");
    const membroContainer = document.getElementById("notificacoes-membro-container");

    const displayAdmin = isGestao ? "block" : "none";
    const displayMembro = isGestao ? "none" : "block";

    // IMPORTANTE: usar important para não depender de CSS/ordem de execução
    setDisplay(adminContainer, displayAdmin);
    setDisplay(membroContainer, displayMembro);

    // Também garante visibilidade real (alguns CSS podem mexer em opacity/visibility)
    if (adminContainer) {
      adminContainer.style.setProperty("visibility", "visible", "important");
      adminContainer.style.setProperty("opacity", "1", "important");
      adminContainer.style.setProperty("max-height", "none", "important");
      adminContainer.style.setProperty("position", "relative", "important");
      adminContainer.style.setProperty("z-index", "1", "important");
    }
    if (membroContainer) {
      membroContainer.style.setProperty("visibility", "visible", "important");
      membroContainer.style.setProperty("opacity", "1", "important");
      membroContainer.style.setProperty("max-height", "none", "important");
      membroContainer.style.setProperty("position", "relative", "important");
      membroContainer.style.setProperty("z-index", "1", "important");
    }

    // Validação de segurança: se o container correto não estiver visível, força.
    setTimeout(() => {
      const a = document.getElementById('notificacoes-admin-container');
      const m = document.getElementById('notificacoes-membro-container');
      if (isGestao && a && getComputedStyle(a).display === "none") {
        a.style.setProperty("display", "block", "important");
        console.warn("[Notificacoes] admin container was hidden unexpectedly. Forced display:block.");
      } else if (!isGestao && m && getComputedStyle(m).display === "none") {
        m.style.setProperty("display", "block", "important");
        console.warn("[Notificacoes] member container was hidden unexpectedly. Forced display:block.");
      }
    }, 100);
  }

  async function inicializarNotificacoes(user) {
    const canonUser = await getUserCanon(user);
    const permissions = Array.isArray(canonUser.permissions) ? canonUser.permissions : [];

    // Gestão se tiver PUSH_GERENCIAR (ou wildcard)
    const isGestao = permissions.includes("PUSH_GERENCIAR") || permissions.includes("*");

    // 1) aplica modo e garante seção visível
    applyNotificationsMode({ isGestao, permissions });

    // 2) bind handlers uma única vez (idempotente)
    if (!_handlersReady) {
      setupHandlers();
      _handlersReady = true;
    }

    // 3) popular lotações sempre que entrar em gestão (barato e garante consistência)
    if (isGestao) popularLotacoes();

    // 4) carrega dados conforme modo
    if (isGestao) {
      await carregarCampanhasGestao();
    } else {
      await carregarHistoricoMe();
    }
  }

  function popularLotacoes() {
    const select = document.getElementById("push-target-lotacao");
    if (!select) return;
    const lotacoes =
      window.Canon?.LOTACOES || [
        "SEDE",
        "DEL 01 - Viana",
        "DEL 02 - Serra",
        "DEL 03 - Guarapari",
        "DEL 04 - Linhares",
        "NENHUMA",
      ];
    select.innerHTML = lotacoes.map((l) => `<option value="${l}">${l}</option>`).join("");
  }

  function setupHandlers() {
    const btnSend = document.getElementById("btn-send-push");
    const titleInput = document.getElementById("push-title");
    const messageInput = document.getElementById("push-message");
    const targetTypeSelect = document.getElementById("push-target-type");
    const filiadoSearchInput = document.getElementById("push-target-filiado-search");

    if (titleInput) {
      titleInput.oninput = () => {
        const len = titleInput.value.length;
        const counter = document.getElementById("push-title-count");
        if (!counter) return;
        counter.textContent = String(len);
        counter.style.color = len > 54 ? "#e74c3c" : "";
        counter.style.fontWeight = len > 54 ? "bold" : "normal";
      };
    }

    if (messageInput) {
      messageInput.oninput = () => {
        const len = messageInput.value.length;
        const counter = document.getElementById("push-message-count");
        if (!counter) return;
        counter.textContent = String(len);
        counter.style.color = len > 216 ? "#e74c3c" : "";
        counter.style.fontWeight = len > 216 ? "bold" : "normal";
      };
    }

    if (btnSend) btnSend.onclick = handleSend;
    if (targetTypeSelect) targetTypeSelect.onchange = handleTargetTypeChange;

    if (filiadoSearchInput) {
      let debounceTimer;
      filiadoSearchInput.oninput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => handleFiliadoSearch(filiadoSearchInput.value), 400);
      };
    }

    // Estado inicial do target UI
    try { handleTargetTypeChange(); } catch (_) {}
  }

  function handleTargetTypeChange() {
    const type = document.getElementById("push-target-type")?.value || "ALL";
    const container = document.getElementById("push-target-value-container");
    const lotacaoSelect = document.getElementById("push-target-lotacao");
    const filiadoWrapper = document.getElementById("push-target-filiado-wrapper");
    const label = document.getElementById("push-target-value-label");

    if (!container || !lotacaoSelect || !filiadoWrapper || !label) return;

    container.style.display = "none";
    lotacaoSelect.style.display = "none";
    filiadoWrapper.style.display = "none";

    if (type === "LOTACAO") {
      container.style.display = "block";
      label.textContent = "Selecionar Lotação:";
      lotacaoSelect.style.display = "block";
    } else if (type === "FILIADO") {
      container.style.display = "block";
      label.textContent = "Buscar Filiado:";
      filiadoWrapper.style.display = "block";
    }
  }

  async function handleFiliadoSearch(query) {
    if (!query || query.length < 2) return;
    const select = document.getElementById("push-target-filiado-select");
    if (!select) return;

    select.innerHTML = "<option>Buscando...</option>";

    const safeEscape = (v) => (window.Utils?.escapeHTML ? window.Utils.escapeHTML(v) : String(v || ""));

    try {
      const r = await window.Api.apiFetch(`/api/filiados?q=${encodeURIComponent(query)}`);
      if (r.ok) {
        const data = await r.json();
        const filiados = data.filiados || [];
        if (filiados.length === 0) {
          select.innerHTML = '<option value="">Nenhum encontrado</option>';
        } else {
          select.innerHTML = filiados
            .map(
              (f) =>
                `<option value="${f.id}" data-nome="${safeEscape(f.nome)}" data-cpf="${safeEscape(
                  f.cpf
                )}">${safeEscape(f.nome)} (CPF: ${safeEscape(f.cpf)})</option>`
            )
            .join("");
        }
      } else {
        select.innerHTML = '<option value="">Erro na busca</option>';
      }
    } catch (e) {
      console.error("Erro na busca de filiados", e);
      select.innerHTML = '<option value="">Erro na busca</option>';
    }
  }

  async function handleSend() {
    const titleEl = document.getElementById("push-title");
    const messageEl = document.getElementById("push-message");
    const targetTypeEl = document.getElementById("push-target-type");

    const title = (titleEl ? titleEl.value : "").trim();
    const body = (messageEl ? messageEl.value : "").trim();
    const targetType = targetTypeEl ? targetTypeEl.value : "ALL";

    if (!body) {
      alert("A mensagem é obrigatória.");
      return;
    }

    let targetValue = null;
    if (targetType === "LOTACAO") {
      targetValue = document.getElementById("push-target-lotacao")?.value || null;
    } else if (targetType === "FILIADO") {
      const select = document.getElementById("push-target-filiado-select");
      if (!select) {
        alert("Selecione um filiado válido.");
        return;
      }
      const opt = select.options[select.selectedIndex];
      if (!opt || !opt.value) {
        alert("Selecione um filiado válido.");
        return;
      }
      targetValue = { id: opt.value, nome: opt.dataset.nome, cpf: opt.dataset.cpf };
    }

    let targetLabel = targetType;
    if (targetType === "FILIADO" && targetValue && typeof targetValue === "object") {
      targetLabel = `Filiado — ${targetValue.nome} (${window.Formatters?.formatCpf(targetValue.cpf) || targetValue.cpf})`;
    } else if (targetValue) {
      targetLabel = `${targetType} (${targetValue})`;
    }

    const confirmMsg = `Deseja realmente enviar esta notificação?\n\nDestino: ${targetLabel}\nMensagem: "${body}"`;
    if (!confirm(confirmMsg)) return;

    const btnSend = document.getElementById("btn-send-push");
    if (!btnSend) return;

    const originalText = btnSend.innerHTML;

    try {
      btnSend.disabled = true;
      btnSend.innerHTML = "⌛ Enviando...";

      const payload = {
        title: title || null,
        body: body,
        targetType,
        targetValue,
      };

      const r = await window.Api.apiFetch("/api/push/campaigns/send", {
        method: "POST",
        body: payload,
      });

      const data = await r.json().catch(() => ({}));

      if (r.ok) {
        alert(
          `Sucesso! Notificação enviada.\n🚀 Sucesso: ${data.sent}\n❌ Falhas: ${data.failed}\n🚫 Sem Token/Negado: ${data.noTokenOrDenied || 0}`
        );

        if (document.getElementById("push-title")) document.getElementById("push-title").value = "";
        if (document.getElementById("push-message")) document.getElementById("push-message").value = "";

        const titleCount = document.getElementById("push-title-count");
        if (titleCount) {
          titleCount.textContent = "0";
          titleCount.style.color = "";
          titleCount.style.fontWeight = "normal";
        }

        const messageCount = document.getElementById("push-message-count");
        if (messageCount) {
          messageCount.textContent = "0";
          messageCount.style.color = "";
          messageCount.style.fontWeight = "normal";
        }

        carregarCampanhasGestao();
      } else {
        const errorMsg = data.message || data.error || "Erro ao enviar notificação.";
        if (r.status === 429) alert("Limite atingido. Você só pode enviar 2 notificações por minuto.");
        else alert(errorMsg);
      }
    } catch (e) {
      console.error("Notificacoes.SendErro", e);
      alert("Erro de conexão ao enviar notificação.");
    } finally {
      btnSend.disabled = false;
      btnSend.innerHTML = originalText;
    }
  }

  async function carregarHistoricoMe() {
    const listEl = document.getElementById("lista-notificacoes-recebidas");
    if (!listEl || isLoadingMe) return;

    try {
      isLoadingMe = true;
      listEl.innerHTML =
        '<p style="text-align:center; padding:40px; color:#666;">⌛ Carregando suas notificações...</p>';

      const r = await window.Api.apiFetch("/api/push/history/me");
      const data = await r.json().catch(() => ({}));

      if (r.ok) {
        renderizarNotificacoesRecebidas(data.notifications || []);
      } else {
        const msg = data.message || data.error || "Erro ao carregar notificações.";
        listEl.innerHTML = `
          <div style="color:#e74c3c; padding:30px; text-align:center; background:#fff5f5; border-radius:8px; border:1px solid #ffcccc;">
            <p style="font-weight:bold; margin-bottom:5px;">⚠️ ${msg}</p>
            ${data.requestId ? `<small style="color:#666;">Solicitação: ${data.requestId}</small>` : ""}
          </div>`;
      }
    } catch (e) {
      console.error("Notificacoes.HistoricoMeErro", e);
      listEl.innerHTML = `<p style="color:#e74c3c; padding:20px; text-align:center;">❌ Erro de conexão ao carregar notificações.</p>`;
    } finally {
      isLoadingMe = false;
    }
  }

  function renderizarNotificacoesRecebidas(lista) {
    const container = document.getElementById("lista-notificacoes-recebidas");
    if (!container) return;

    if (!lista.length) {
      container.innerHTML = `<p style="text-align:center; padding:40px; color:#999;">Nenhuma notificação recebida.</p>`;
      return;
    }

    const safeEscape = (v) => (window.Utils?.escapeHTML ? window.Utils.escapeHTML(v) : String(v || ""));
    const seenIds = JSON.parse(localStorage.getItem("notif_seen_ids") || "[]");

    container.innerHTML = lista
      .map((n) => {
        const date = formatarData(n.created_at);
        const viewed = seenIds.includes(n.id);

        return `
          <div class="history-card" style="border-left-color: ${viewed ? "#ccc" : "#27ae60"}; cursor: pointer; position: relative;" onclick="Notificacoes.abrirDetalhe('${n.id}')">
            ${!viewed ? '<span class="badge badge-warning" style="position:absolute; top:10px; right:10px; font-size:0.6rem;">NOVA</span>' : ""}
            <div class="history-header">
              <span class="history-date">${date}</span>
            </div>
            ${n.title ? `<div class="history-title" style="color:#003366;">${safeEscape(n.title)}</div>` : ""}
            <div class="history-body" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${safeEscape(
              n.body
            )}</div>
          </div>`;
      })
      .join("");

    window._receivedNotifications = lista;
  }

  function abrirDetalhe(id) {
    const n = (window._receivedNotifications || []).find((x) => x.id === id);
    if (!n) return;

    const seenIds = JSON.parse(localStorage.getItem("notif_seen_ids") || "[]");
    if (!seenIds.includes(id)) {
      seenIds.push(id);
      localStorage.setItem("notif_seen_ids", JSON.stringify(seenIds.slice(-100)));
      renderizarNotificacoesRecebidas(window._receivedNotifications);
    }

    const modal = document.getElementById("modal-generic");
    const tituloEl = document.getElementById("modal-generic-titulo");
    const corpoEl = document.getElementById("modal-generic-corpo");
    if (!modal || !tituloEl || !corpoEl) return;

    tituloEl.textContent = "Notificação";
    const safeEscape = (v) => (window.Utils?.escapeHTML ? window.Utils.escapeHTML(v) : String(v || ""));

    corpoEl.innerHTML = `
      <div style="padding:10px;">
        <h3 style="color:#003366; margin-bottom:10px;">${safeEscape(n.title || "Informativo")}</h3>
        <p style="font-size:0.8rem; color:#888; margin-bottom:20px;">Enviado em: ${formatarData(n.created_at)}</p>
        <div style="white-space: pre-wrap; line-height:1.6; color:#333; font-size:1.1rem; background:#f9f9f9; padding:20px; border-radius:12px;">${safeEscape(
          n.body
        )}</div>
        <div style="text-align:center; margin-top:30px;">
          <button class="btn btn-primary" onclick="Utils.fecharModal('modal-generic')">Fechar</button>
        </div>
      </div>`;

    modal.style.display = "flex";
    if (window.Utils?.lockScroll) window.Utils.lockScroll();
  }

  async function carregarCampanhasGestao() {
    const listEl = document.getElementById("push-history-list");
    if (!listEl || isLoadingGestao) return;

    try {
      isLoadingGestao = true;
      listEl.innerHTML = '<p style="padding:15px; color:#666;">⌛ Carregando campanhas...</p>';

      const url = isShowingArchived ? "/api/push/campaigns?includeArchived=1" : "/api/push/campaigns";
      const r = await window.Api.apiFetch(url);
      const data = await r.json().catch(() => ({}));

      if (r.ok) {
        historyCache = data.campaigns || [];
        renderizarHistorico(listEl);
      } else {
        let msg = data.message || data.error || "Erro ao carregar histórico de campanhas.";
        if (r.status === 403) msg = "Sem permissão para acessar notificações de gestão.";

        listEl.innerHTML = `
          <div style="color:#e74c3c; padding:15px; background:#fff5f5; border-radius:8px; border:1px solid #ffcccc;">
            <p style="font-weight:bold; margin-bottom:5px;">⚠️ ${msg}</p>
            ${data.requestId ? `<small style="color:#666;">Solicitação: ${data.requestId}</small>` : ""}
          </div>`;
      }
    } catch (e) {
      console.error("Notificacoes.CampanhasErro", e);
      listEl.innerHTML = `<p style="color:#e74c3c; padding:10px;">❌ Erro de conexão ao carregar histórico de gestão.</p>`;
    } finally {
      isLoadingGestao = false;
    }
  }

  function renderizarHistorico(container) {
    if (!historyCache.length) {
      container.innerHTML = `<p>Nenhum envio realizado ainda.</p>`;
      return;
    }

    const safeEscape = (v) => (window.Utils?.escapeHTML ? window.Utils.escapeHTML(v) : String(v || ""));

    let html = historyCache
      .map((c) => {
        const data = formatarData(c.created_at);
        const statusClass = c.status === "SENT" ? "status-sent" : "status-failed";
        const statusLabel = c.status === "SENT" ? "Enviado" : "Falhou";

        let displayTargetValue = c.target_value;

        if (c.target_type === "FILIADO" && c.target_value) {
          let parsed = null;
          if (typeof c.target_value === "object") parsed = c.target_value;
          else {
            try { parsed = JSON.parse(c.target_value); } catch (_) { parsed = null; }
          }

          if (parsed && typeof parsed === "object") {
            displayTargetValue = `${parsed.nome || ""} (${window.Formatters?.formatCpf(parsed.cpf || "") || parsed.cpf || ""})`;
            if (displayTargetValue.trim() === "()") displayTargetValue = parsed.id || c.target_value;
          }
        }

        const targetLabel = c.target_type + (displayTargetValue ? `: ${displayTargetValue}` : "");

        return `
          <div class="history-card">
            <div class="history-header">
              <span class="history-date">${data}</span>
              <span class="history-status ${statusClass}">${statusLabel}</span>
            </div>
            <div class="history-author">Por: ${safeEscape(c.autor_nome || "Sistema")} | Destino: ${safeEscape(targetLabel)}</div>
            ${c.title ? `<div class="history-title">${safeEscape(c.title)}</div>` : ""}
            <div class="history-body" style="white-space: pre-wrap;">${safeEscape(c.body)}</div>
            <div class="history-results">
              <span title="Sucesso">🚀 ${c.result?.sent || 0}</span>
              <span title="Falhas">❌ ${c.result?.failed || 0}</span>
              <span title="Sem Token ou Negado">🚫 ${c.result?.noTokenOrDenied || 0}</span>
            </div>
          </div>`;
      })
      .join("");

    if (!isShowingArchived && historyCache.length >= 5) {
      html += `
        <div style="text-align: center; margin-top: 15px;">
          <button id="btn-show-archived" class="btn btn-outline btn-sm">Visualizar anteriores</button>
        </div>`;
    } else if (isShowingArchived) {
      html += `
        <div style="text-align: center; margin-top: 15px;">
          <button id="btn-hide-archived" class="btn btn-outline btn-sm">Ver apenas recentes</button>
        </div>`;
    }

    container.innerHTML = html;

    const btnShow = document.getElementById("btn-show-archived");
    if (btnShow) btnShow.onclick = () => { isShowingArchived = true; carregarCampanhasGestao(); };

    const btnHide = document.getElementById("btn-hide-archived");
    if (btnHide) btnHide.onclick = () => { isShowingArchived = false; carregarCampanhasGestao(); };
  }

  function formatarData(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleString("pt-BR");
  }

  window.Notificacoes = {
    inicializarNotificacoes,
    carregarCampanhasGestao,
    carregarHistoricoMe,
    abrirDetalhe,
  };
})(typeof window !== "undefined" ? window : this);
