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

  function normalizePermissions(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean).map((p) => String(p).trim()).filter(Boolean);
    if (typeof raw === "string") return raw.split(/[;,\s]+/).map((p) => String(p).trim()).filter(Boolean);
    if (raw && typeof raw === "object") return Object.entries(raw).filter(([, value]) => !!value).map(([key]) => String(key).trim()).filter(Boolean);
    return [];
  }

  function debugNotif(action, details = {}) {
    if (localStorage.getItem("DEBUG_NOTIF") !== "1") return;
    console.log("[DEBUG_NOTIF][Notificacoes]", { when: new Date().toISOString(), action, ...details });
  }

  const GESTAO_PERFIS = ["ADMIN", "DIRETORIA", "FUNCIONARIO"];
  const filiadoNomeCache = new Map();
  const filiadoNomePending = new Map();

  function mascararCpf(valor) {
    const digits = String(valor || "").replace(/\D+/g, "");
    if (digits.length !== 11) return "***.***.***-**";
    return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
  }

  function formatarValorDestino(value) {
    if (value == null || value === "") return "";
    if (typeof value === "object") {
      if (Array.isArray(value)) return value.join(", ");
      return value.nome || value.id || JSON.stringify(value);
    }
    return String(value);
  }


  function parseTargetValue(raw) {
    if (raw == null) return null;
    if (typeof raw === "object") return raw;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try { return JSON.parse(trimmed); } catch (_) { return trimmed; }
      }
      return trimmed;
    }
    return raw;
  }

  async function resolverNomeFiliado(id) {
    const cacheKey = String(id || "").trim();
    if (!cacheKey) return null;
    if (filiadoNomeCache.has(cacheKey)) return filiadoNomeCache.get(cacheKey);
    if (filiadoNomePending.has(cacheKey)) return filiadoNomePending.get(cacheKey);

    const promise = (async () => {
      try {
        const r = await window.Api.apiFetch(`/api/filiados?q=${encodeURIComponent(cacheKey)}`);
        if (!r.ok) return null;
        const data = await r.json();
        const list = Array.isArray(data?.filiados) ? data.filiados : [];
        const exact = list.find(f => String(f.id) === cacheKey) || list[0];
        const nome = exact?.nome ? String(exact.nome).trim() : null;
        if (nome) filiadoNomeCache.set(cacheKey, nome);
        return nome;
      } catch (_) {
        return null;
      } finally {
        filiadoNomePending.delete(cacheKey);
      }
    })();

    filiadoNomePending.set(cacheKey, promise);
    return promise;
  }

  function formatarDestinoCampanha(c) {
    const type = String(c?.target_type || "ALL").toUpperCase();
    const targetValue = parseTargetValue(c?.target_value);

    if (type !== "FILIADO") {
      const suffixValue = formatarValorDestino(targetValue);
      const suffix = suffixValue ? `: ${suffixValue}` : "";
      return `Destino: ${type}${suffix}`;
    }

    if (targetValue && typeof targetValue === "object" && !Array.isArray(targetValue)) {
      const nome = String(targetValue.nome || "").trim();
      const cpf = String(targetValue.cpf || "").trim();
      if (nome && cpf) return `Destino: FILIADO: ${nome} (CPF: ${mascararCpf(cpf)})`;
      if (nome) return `Destino: FILIADO: ${nome}`;
      if (targetValue.id != null) return `Destino: FILIADO: Filiado #${targetValue.id}`;
    }

    if (typeof targetValue === "string" || typeof targetValue === "number") {
      const idStr = String(targetValue).trim();
      if (filiadoNomeCache.has(idStr)) return `Destino: FILIADO: ${filiadoNomeCache.get(idStr)}`;
      return `Destino: FILIADO: Filiado #${idStr}`;
    }

    return "Destino: FILIADO";
  }

  async function hidratarNomesFiliadosNoHistorico(container) {
    if (!container || !historyCache.length) return;
    const ids = new Set();
    historyCache.forEach((c) => {
      const type = String(c?.target_type || "").toUpperCase();
      if (type !== "FILIADO") return;
      const value = parseTargetValue(c?.target_value);
      if (value && typeof value === "object" && value.id != null && value.nome) {
        filiadoNomeCache.set(String(value.id), String(value.nome));
      }
      if (typeof value === "string" || typeof value === "number") {
        const id = String(value).trim();
        if (id && !filiadoNomeCache.has(id)) ids.add(id);
      } else if (value && typeof value === "object" && value.id != null && !value.nome) {
        const id = String(value.id).trim();
        if (id && !filiadoNomeCache.has(id)) ids.add(id);
      }
    });

    if (!ids.size) return;
    await Promise.all(Array.from(ids).map((id) => resolverNomeFiliado(id)));
    renderizarHistorico(container);
  }


  function resolveContext(arg) {
    const argObj = arg && typeof arg === "object" ? arg : {};
    const argPerfil = typeof argObj.perfil === "string" ? argObj.perfil : "";
    const argPermissions = normalizePermissions(argObj.permissions);
    let cached = {};
    try { cached = window.Utils?.obterUserInfo?.() || {}; } catch (_) {}
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
                <select class="ui-select" id="push-target-type">
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
                <select class="ui-select" id="push-target-lotacao" style="display: none;"></select>
                <div id="push-target-filiado-wrapper" style="display: none;">
                    <input class="ui-input" type="text" id="push-target-filiado-search" placeholder="Buscar por nome ou CPF..." autocomplete="off" />
                    <select class="ui-select" id="push-target-filiado-select" style="margin-top: 5px;"><option value="">Aguardando busca...</option></select>
                </div>
            </div>

            <div class="field-group" style="margin-top: 15px;">
                <label>Título (opcional)</label>
                <input class="ui-input" type="text" id="push-title" maxlength="60" placeholder="Ex: Informativo SINPRF-ES" />
                <small class="char-counter"><span id="push-title-count">0</span>/60</small>
            </div>

            <div class="field-group" style="margin-top: 15px;">
                <label>Mensagem *</label>
                <textarea class="ui-textarea" id="push-message" maxlength="240" rows="4" placeholder="Digite sua mensagem aqui..."></textarea>
                <small class="char-counter"><span id="push-message-count">0</span>/240</small>
            </div>

            <button id="btn-send-push" class="ui-button ui-button-secondary" style="margin-top: 20px;">🚀 Enviar Agora</button>
        </div>

        <div class="history-container" style="margin-top: 40px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
              <h3 style="margin:0;">📜 Histórico de Envios</h3>
              <button id="btn-toggle-push-history" class="ui-button ui-button-secondary" style="padding:8px 12px; font-size:0.85rem;">Visualizar anteriores</button>
            </div>
            <div id="push-history-list" class="history-list" style="margin-top:10px;"><p>Carregando histórico...</p></div>
        </div>
      </div>
    `;
  }

  async function inicializar(arg, permissionsLegacy) {
    const container = document.getElementById("sec-notificacoes");
    if (!container) return;

    const normalizedArg = (arg && typeof arg === "object") ? arg : { perfil: arg, permissions: permissionsLegacy };
    const { perfilEfetivo, permissionsEfetivas } = resolveContext(normalizedArg);
    const forcaPermissaoGestao = permissionsEfetivas.includes("PUSH_GERENCIAR") || permissionsEfetivas.includes("*");
    const ehGestao = GESTAO_PERFIS.includes(perfilEfetivo) || forcaPermissaoGestao;

    if (!ehGestao) {
      container.innerHTML = `<div style="padding:40px; text-align:center; color:#666;"><p>⚠️ Módulo restrito à gestão.</p></div>`;
      return;
    }

    debugNotif("inicializar", { perfilEfetivo, permissionsEfetivas, ehGestao });

    if (!document.getElementById("notificacoes-admin-container")) {
        container.innerHTML = `<p style="text-align:center; padding:40px; color:#666;">⌛ Carregando...</p>`;
        renderAdminTemplate(container);
        _handlersReady = false;
    }

    setupHandlersOnce();
    popularLotacoes();
    await Promise.all([
        carregarCampanhasGestao(),
        verificarSaudePush()
    ]);
  }

  async function verificarSaudePush() {
    const container = document.getElementById("notificacoes-admin-container");
    if (!container) return;

    try {
        const r = await window.Api.apiFetch("/api/push/health");
        if (r.ok) {
            const data = await r.json();
            const checklist = data.checklist || {};
            const valid = parseInt(checklist.token_count_valid || 0, 10);

            if (valid === 0) {
                const alertDiv = document.createElement("div");
                alertDiv.className = "ui-alert ui-alert-warning";
                alertDiv.style.margin = "20px auto";
                alertDiv.style.maxWidth = "600px";
                alertDiv.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:1.5rem;">⚠️</span>
                        <div>
                            <strong>Nenhum token válido para o escopo SINDICATO.</strong><br>
                            A entrega falhará. Peça aos filiados que abram o app para registrar o push corretamente.
                            ${checklist.missing_project_id > 0 ? `<br><small>Detectados ${checklist.missing_project_id} dispositivos com versão antiga/sem ID de projeto.</small>` : ""}
                        </div>
                    </div>
                `;
                container.insertBefore(alertDiv, container.querySelector(".form-container"));
            }
        }
    } catch (e) {
        console.warn("[Notificacoes] Falha ao verificar saúde do push", e);
    }
  }

  async function inicializarNotificacoes(arg) {
    debugNotif("inicializarNotificacoes (orquestrador)", { arg });
    await inicializar(arg);
  }

  function popularLotacoes() {
    const select = document.getElementById("push-target-lotacao");
    if (!select) return;
    const lotacoes = window.Canon?.LOTACOES || ["SEDE", "DEL 01 - Viana", "DEL 02 - Serra", "DEL 03 - Guarapari", "DEL 04 - Linhares", "NENHUMA"];
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
    const btnToggleHistory = document.getElementById("btn-toggle-push-history");

    if (!btnSend || !titleInput || !messageInput || !targetTypeSelect) return;

    if (btnToggleHistory) {
      btnToggleHistory.onclick = async () => {
        isShowingArchived = !isShowingArchived;
        btnToggleHistory.textContent = isShowingArchived ? "Mostrar só 5 recentes" : "Visualizar anteriores";
        await carregarCampanhasGestao();
      };
      btnToggleHistory.textContent = isShowingArchived ? "Mostrar só 5 recentes" : "Visualizar anteriores";
    }

    titleInput.oninput = () => {
      const len = titleInput.value.length;
      const counter = document.getElementById("push-title-count");
      if (counter) {
        counter.textContent = String(len);
        counter.parentElement.classList.toggle("ui-text-danger", len >= 54);
      }
    };

    messageInput.oninput = () => {
      const len = messageInput.value.length;
      const counter = document.getElementById("push-message-count");
      if (counter) {
        counter.textContent = String(len);
        counter.parentElement.classList.toggle("ui-text-danger", len >= 216);
      }
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
        if (filiados.length === 0) select.innerHTML = '<option value="">Nenhum encontrado</option>';
        else select.innerHTML = filiados.map(f => `<option value="${f.id}" data-nome="${safeEscape(f.nome)}" data-cpf="${safeEscape(f.cpf)}">${safeEscape(f.nome)} (CPF: ${safeEscape(f.cpf)})</option>`).join("");
      } else select.innerHTML = '<option value="">Erro na busca</option>';
    } catch (e) { select.innerHTML = '<option value="">Erro na busca</option>'; }
  }

  async function handleSend() {
    const title = (document.getElementById("push-title")?.value || "").trim();
    const body = (document.getElementById("push-message")?.value || "").trim();
    const targetType = document.getElementById("push-target-type")?.value || "ALL";

    if (!body) { alert("A mensagem é obrigatória."); return; }

    let targetValue = null;
    if (targetType === "LOTACAO") targetValue = document.getElementById("push-target-lotacao")?.value || null;
    else if (targetType === "FILIADO") {
      const select = document.getElementById("push-target-filiado-select");
      if (!select || !select.value) { alert("Selecione um filiado."); return; }
      const opt = select.options[select.selectedIndex];
      targetValue = { id: opt.value, nome: opt.dataset.nome, cpf: opt.dataset.cpf };
    }

    if (!confirm("Deseja realmente enviar esta notificação?")) return;

    const btnSend = document.getElementById("btn-send-push");
    const originalText = btnSend.innerHTML;
    try {
      btnSend.disabled = true;
      btnSend.innerHTML = '<span aria-hidden="true" class="ui-spinner"></span> Enviando...';
      btnSend.setAttribute("aria-busy", "true");

      const r = await window.Api.apiFetch("/api/push/campaigns/send", { method: "POST", body: { title: title || null, body, targetType, targetValue } });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        const { sent, failed, noTokenOrDenied, failuresTop, requestId } = data;
        let msg = `Notificação processada.\n🚀 Sucesso: ${sent}\n❌ Falhas: ${failed}\n🚫 Sem Token: ${noTokenOrDenied || 0}`;
        if (failuresTop && failuresTop.length > 0) {
            msg += `\n\nPrincipais erros:\n` + failuresTop.map(f => `- ${f.reason}: ${f.count}`).join('\n');
        }
        alert(msg);

        document.getElementById("push-title").value = "";
        document.getElementById("push-message").value = "";
        carregarCampanhasGestao();
      } else alert(data.message || "Erro ao enviar. ID: " + (data.requestId || "N/A"));
    } catch (e) { alert("Erro de conexão."); }
    finally {
      btnSend.disabled = false;
      btnSend.innerHTML = originalText;
      btnSend.removeAttribute("aria-busy");
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
      if (r.ok) {
        const data = await r.json();
        historyCache = data.campaigns || [];
        renderizarHistorico(listEl);
      } else {
        listEl.innerHTML = `<p style="color:red; padding:15px;">Erro ao carregar histórico.</p>`;
      }
    } catch (e) { listEl.innerHTML = `<p style="color:red; padding:15px;">Erro de conexão.</p>`; }
    finally { isLoadingGestao = false; }
  }

  function renderizarHistorico(container) {
    if (!historyCache.length) { container.innerHTML = `<p>Nenhum envio realizado ainda.</p>`; return; }
    const safeEscape = (v) => (window.Utils?.escapeHTML ? window.Utils.escapeHTML(v) : String(v || ""));
    let html = historyCache.map(c => {
      const data = formatarData(c.created_at);
      const targetLabel = formatarDestinoCampanha(c).replace(/^Destino:\s*/i, "");
      const authorName = c.autor_nome ? String(c.autor_nome).trim() : "Sistema";
      const status = String(c.status || "ENVIADO").toUpperCase();
      const result = c.result || {};
      const sent = Number(result.sent || 0);
      const failed = Number(result.failed || 0);
      const noTokenOrDenied = Number(result.noTokenOrDenied || 0);
      const failures = result.failuresTop && result.failuresTop.length > 0
        ? ` <span title="${safeEscape(result.failuresTop.map(f => `${f.reason}: ${f.count}`).join(', '))}">⚠️</span>`
        : "";
      const requestId = result.requestId || c.requestId || "";
      const detalhes = [];
      if (result.failuresTop && result.failuresTop.length) {
        detalhes.push(`Falhas: ${result.failuresTop.map(f => `${f.reason}: ${f.count}`).join(' | ')}`);
      }
      if (requestId) {
        detalhes.push(`requestId: ${requestId}`);
      }
      const detailsHtml = detalhes.length
        ? `<details style="margin-top:8px;"><summary style="cursor:pointer; color:#666; font-size:0.85rem;">Detalhes técnicos</summary><div style="margin-top:6px; font-size:0.8rem; color:#777; white-space:pre-wrap;">${safeEscape(detalhes.join('\n'))}</div></details>`
        : "";

      return `
          <div class="history-card" style="background:#fff; border:1px solid #eee; border-radius:10px; padding:15px; margin-bottom:10px; border-left:4px solid #003366;">
            <div class="history-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
                <span class="history-date" style="font-size:0.8rem; color:#888;">${data}</span>
                <span class="history-status" style="font-size:0.95rem; font-weight:bold; color:${status === 'SENT' || status === 'ENVIADO' ? '#2ecc71' : '#666'};">${status === 'SENT' ? 'ENVIADO' : safeEscape(status)}</span>
            </div>
            <div class="history-author" style="font-size:0.95rem; color:#555; margin-bottom:8px;">Por: ${safeEscape(authorName)} | Destino: ${safeEscape(targetLabel)}</div>
            ${c.title ? `<div class="history-title" style="font-weight:bold; font-size:1.1rem; color:#003366; margin-bottom:4px;">${safeEscape(c.title)}</div>` : ""}
            <div class="history-body" style="white-space: pre-wrap; font-size:1.05rem; color:#333; margin-bottom:8px;">${safeEscape(c.body)}</div>
            <div class="history-result" style="font-size:1.05rem; font-weight:bold; color:#555;">🚀 ${sent} &nbsp; ❌ ${failed} &nbsp; 🚫 ${noTokenOrDenied}${failures}</div>
            ${detailsHtml}
          </div>`;
    }).join("");
    container.innerHTML = html;
    hidratarNomesFiliadosNoHistorico(container);
  }

  function formatarData(isoStr) { if (!isoStr) return ""; return new Date(isoStr).toLocaleString("pt-BR"); }

  window.Notificacoes = { inicializar, inicializarNotificacoes, carregarCampanhasGestao };
})(typeof window !== "undefined" ? window : this);
