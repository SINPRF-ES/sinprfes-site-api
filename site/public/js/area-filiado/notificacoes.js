/**
 * Módulo de Notificações Push (Página Inicial - Gestão Only)
 */
(function (window) {
  if (window.Notificacoes) return;

  let historyCache = [];
  let isShowingArchived = false;
  let isLoadingGestao = false;

  // Evita duplicar handlers se inicializar múltiplas vezes
  let _handlersReady = false;

  function debugNotif(action, details = {}) {
    if (localStorage.getItem("DEBUG_NOTIF") !== "1") return;
    console.log("[DEBUG_NOTIF][Notificacoes]", {
      when: new Date().toISOString(),
      action,
      ...details,
    });
  }

  const GESTAO_PERFIS = ["ADMIN", "DIRETORIA", "FUNCIONARIO"];

  function resolveContext(arg) {
    const argObj = arg && typeof arg === "object" ? arg : {};
    const argPerfil = typeof argObj.perfil === "string" ? argObj.perfil : "";
    const argPermissions = normalizePermissions(argObj.permissions);

    let cached = {};
    try {
      cached = window.Utils?.obterUserInfo?.() || {};
    } catch (_) {
      cached = {};
    }

    const cachedPerfil = (cached.perfil_acesso || cached.perfil || "").toUpperCase();
    const cachedPermissions = normalizePermissions(cached.permissions);

    const perfilEfetivo = (argPerfil || cachedPerfil || "FILIADO").toUpperCase();
    const permissionsEfetivas = argPermissions.length ? argPermissions : cachedPermissions;

    return { perfilEfetivo, permissionsEfetivas };
  }

  function renderAdminTemplate(container) {
    container.innerHTML = `
      <div id="notificacoes-admin-container">
        <div class="af-standard-header">
            <h2>🚀 Enviar Notificação (Gestão)</h2>
            <p class="section-subtitle">Envie mensagens push para os filiados.</p>
        </div>

        <div class="form-container" style="max-width: 600px; margin: 20px auto 0 auto;">
            <div class="field-group">
                <label>Público de Destino</label>
                <select id="push-target-type">
                    <option value="ALL">Todos os filiados com app</option>
                    <option value="ATIVOS">Apenas ATIVOS</option>
                    <option value="VETERANOS">Veteranos / Pensionistas</option>
                    <option value="LOTACAO">Por Lotação (somente ativos)</option>
                    <option value="JOGOS">Inscritos nos Jogos</option>
                    <option value="FILIADO">Especificar um Filiado</option>
                </select>
            </div>

            <div id="push-target-value-container" class="field-group" style="margin-top: 15px; display: none;">
                <label id="push-target-value-label">Valor do Filtro</label>

                <select id="push-target-lotacao" style="display: none;">
                    <!-- Populando via popularLotacoes() -->
                </select>

                <div id="push-target-filiado-wrapper" style="display: none;">
                    <input type="text" id="push-target-filiado-search" placeholder="Buscar por nome ou CPF..." inputmode="search" autocomplete="off" />
                    <select id="push-target-filiado-select" style="margin-top: 5px;">
                        <option value="">Aguardando busca...</option>
                    </select>
                </div>
            </div>

            <div class="field-group" style="margin-top: 15px;">
                <label>Título (opcional)</label>
                <input type="text" id="push-title" maxlength="60" placeholder="Ex: Informativo SINPRF-ES" />
                <small class="char-counter"><span id="push-title-count">0</span>/60</small>
            </div>

            <div class="field-group" style="margin-top: 15px;">
                <label>Mensagem *</label>
                <textarea id="push-message" maxlength="240" rows="4" placeholder="Digite sua mensagem aqui..."></textarea>
                <small class="char-counter"><span id="push-message-count">0</span>/240</small>
            </div>

            <button id="btn-send-push" class="btn btn-primary" style="margin-top: 20px;">
                🚀 Enviar Agora
            </button>
        </div>

        <div class="history-container" style="margin-top: 40px;">
            <h3>📜 Histórico de Envios</h3>
            <div id="push-history-list" class="history-list">
                <p>Carregando histórico...</p>
            </div>
        </div>
      </div>

      <div id="notificacoes-membro-container" style="display:none"></div>
    `;
  }

  function renderMembroTemplate(container) {
    container.innerHTML = `
      <div id="notificacoes-admin-container" style="display:none"></div>
      <div id="notificacoes-membro-container">
        <div class="af-standard-header">
            <h2>📢 Minhas Notificações</h2>
            <p class="section-subtitle">Acompanhe os comunicados enviados para você.</p>
        </div>
        <div id="lista-notificacoes-recebidas" class="history-list">
            <p style="text-align:center; padding:40px; color:#666;">Carregando notificações...</p>
        </div>
      </div>
    `;
  }

  function applyMode(ehGestao) {
    const adminContainer = document.getElementById("notificacoes-admin-container");
    const membroContainer = document.getElementById("notificacoes-membro-container");
    if (!adminContainer || !membroContainer) return;

    adminContainer.style.display = ehGestao ? "block" : "none";
    membroContainer.style.display = ehGestao ? "none" : "block";
  }

  function setupHandlersOnce() {
    if (_handlersReady) return;
    setupHandlers();
    _handlersReady = true;
  }

  async function inicializar(arg, permissionsLegacy) {
    const container = document.getElementById("sec-notificacoes");
    if (!container) return;

    const normalizedArg = (arg && typeof arg === "object") ? arg : { perfil: arg, permissions: permissionsLegacy };
    const { perfilEfetivo, permissionsEfetivas } = resolveContext(normalizedArg);
    const forcaPermissaoGestao = permissionsEfetivas.includes("PUSH_GERENCIAR") || permissionsEfetivas.includes("*");
    const ehGestao = GESTAO_PERFIS.includes(perfilEfetivo) || forcaPermissaoGestao;

    debugNotif("inicializar", { perfilEfetivo, permissionsEfetivas, ehGestao });

    const desiredMode = ehGestao ? "gestao" : "membro";
    const adminContainerAtual = document.getElementById("notificacoes-admin-container");
    const membroContainerAtual = document.getElementById("notificacoes-membro-container");
    const precisaRenderizar =
      _currentSyncMode !== desiredMode ||
      !adminContainerAtual ||
      !membroContainerAtual;

    if (precisaRenderizar) {
      if (ehGestao) renderAdminTemplate(container);
      else renderMembroTemplate(container);
      _handlersReady = false;
      _currentSyncMode = desiredMode;
    }

    applyMode(ehGestao);

    if (ehGestao) {
      setupHandlersOnce();
      popularLotacoes();
      await carregarCampanhasGestao();
      return;
    }

    await carregarHistoricoMe();
  }

  async function inicializarNotificacoes(arg) {
    debugNotif("inicializarNotificacoes (orquestrador)", { arg });
    await inicializar(arg);
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

  function setupHandlersOnce() {
    if (_handlersReady) return;
    setupHandlers();
    _handlersReady = true;
  }

  function setupHandlers() {
    const btnSend = document.getElementById("btn-send-push");
    const titleInput = document.getElementById("push-title");
    const messageInput = document.getElementById("push-message");
    const targetTypeSelect = document.getElementById("push-target-type");
    const filiadoSearchInput = document.getElementById("push-target-filiado-search");

    if (!btnSend || !titleInput || !messageInput || !targetTypeSelect) {
      console.error("[Notificacoes] Falha ao localizar elementos do formulário para setupHandlers.");
      return;
    }

    titleInput.oninput = () => {
      const len = titleInput.value.length;
      const counter = document.getElementById("push-title-count");
      if (!counter) return;
      counter.textContent = String(len);
      counter.style.color = len > 54 ? "#e74c3c" : "";
      counter.style.fontWeight = len > 54 ? "bold" : "normal";
    };

    messageInput.oninput = () => {
      const len = messageInput.value.length;
      const counter = document.getElementById("push-message-count");
      if (!counter) return;
      counter.textContent = String(len);
      counter.style.color = len > 216 ? "#e74c3c" : "";
      counter.style.fontWeight = len > 216 ? "bold" : "normal";
    };

    btnSend.onclick = handleSend;
    targetTypeSelect.onchange = handleTargetTypeChange;

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
    inicializar,
    inicializarNotificacoes,
    carregarCampanhasGestao,
    carregarHistoricoMe,
    abrirDetalhe,
  };
})(typeof window !== "undefined" ? window : this);
