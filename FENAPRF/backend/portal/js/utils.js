/**
 * Utilitários Compartilhados (Página Inicial)
 * Carregado como script clássico (window.Utils)
 */

(function (global) {
  if (global.Utils) return;

  const API_BASE = (window.location.hostname === "localhost")
    ? "http://localhost:3000"
    : "https://fenaprf-sistema.onrender.com";

  window.Api = window.Api || {};

  function obterToken() {
    return localStorage.getItem("token");
  }

  function obterUserInfo() {
    try {
      return JSON.parse(localStorage.getItem("userInfo") || "{}");
    } catch (e) {
      return {};
    }
  }

  if (!window.Api.apiFetch) {
    window.Api.apiFetch = async function apiFetch(url, options = {}) {
      const token = obterToken();
      if (!token) {
        window.location.href = "/login.html";
        return;
      }

      const headers = new Headers(options.headers || {});
      headers.set("Authorization", `Bearer ${token}`);

      const isFormData = (typeof FormData !== "undefined") && (options.body instanceof FormData);
      if (options.body && !isFormData && typeof options.body === "object") {
        const isBlob = (typeof Blob !== "undefined") && (options.body instanceof Blob);
        const isArrayBuffer = (typeof ArrayBuffer !== "undefined") && (options.body instanceof ArrayBuffer);
        if (!isBlob && !isArrayBuffer) {
          if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
          options.body = JSON.stringify(options.body);
        }
      }

      const finalUrl = (url && url.startsWith('/')) ? (API_BASE + url) : url;

      // FENAPRF: Ensure cache is handled correctly if needed, but fetch usually does it.
      const response = await fetch(finalUrl, { ...options, headers });

      if (response.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        localStorage.removeItem("token");
        localStorage.removeItem("userInfo");
        localStorage.removeItem("perfil_acesso");
        window.location.href = "/login.html";
        throw new Error("Sessão expirada");
      }

      return response;
    };
  }

  function aplicarMascaraTelefone(input) {
    if (!input) return;
    function formatar(raw) {
      let v = String(raw || "").replace(/\D/g, "").slice(0, 11);
      if (v.length === 0) return "";
      if (v.length <= 2) return `(${v}`;
      if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
      if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
      return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
    }
    input.value = formatar(input.value);
    input.addEventListener("input", (e) => {
      e.target.value = formatar(e.target.value);
    });
  }

  function formatarTelefoneTexto(v) {
    if (global.Formatters) return global.Formatters.formatTelefone(v) || "-";
    if (!v) return "-";
    v = String(v).replace(/\D/g, "");
    if (v.length === 11) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    if (v.length === 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    return v;
  }

  function formatarCPF(cpf) {
    if (global.Formatters) return global.Formatters.formatCpf(cpf);
    if (!cpf) return "";
    const only = String(cpf).replace(/\D/g, "");
    if (only.length !== 11) return cpf;
    return only.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  function formatarCEP(cep) {
    if (global.Formatters) return global.Formatters.formatCep(cep);
    if (!cep) return "";
    const only = String(cep).replace(/\D/g, "");
    if (only.length !== 8) return cep;
    return only.replace(/(\d{5})(\d{3})/, "$1-$2");
  }

  function normalizeText(str) {
    if (!str) return "";
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function normalizarTextoBusca(valor) {
    return normalizeText(valor);
  }

  /**
   * Escapa caracteres HTML para prevenir XSS.
   */
  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function aplicarMascaraAgencia(input) {
    if (!input) return;
    input.maxLength = 6;
    input.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 5) v = v.slice(0, 5);
      if (v.length > 4) v = v.replace(/^(\d{4})(\d)/, "$1-$2");
      e.target.value = v;
    });
  }

  function aplicarMascaraConta(input) {
    if (!input) return;
    input.maxLength = 15;
    input.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 1) v = v.replace(/^(\d+)(\d{1})$/, "$1-$2");
      e.target.value = v;
    });
  }

  function aplicarMascaraCPF(input) {
    if (!input || input._hasCpfMask) return;

    const formatar = (val) => {
      if (global.Formatters && global.Formatters.formatCpfLive) {
        return global.Formatters.formatCpfLive(val);
      }
      let v = val.replace(/\D/g, "").slice(0, 11);
      if (v.length <= 3) return v;
      if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
      if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
      return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
    };

    const handler = (e) => {
      const el = e.target;
      const start = el.selectionStart;
      const oldLen = el.value.length;
      el.value = formatar(el.value);
      const newLen = el.value.length;

      // Ajuste básico de cursor para evitar pulos ao digitar no meio
      if (start !== null && start < oldLen) {
        el.setSelectionRange(start + (newLen - oldLen), start + (newLen - oldLen));
      }
    };

    input.addEventListener("input", handler);
    if (input.value) input.value = formatar(input.value);
    input._hasCpfMask = true;
  }

  function aplicarMascaraCEP(input) {
    if (!input) return;
    const formatar = (val) => {
      let v = val.replace(/\D/g, "").slice(0, 8);
      if (v.length <= 5) return v;
      return `${v.slice(0, 5)}-${v.slice(5)}`;
    };
    if (input.value) input.value = formatar(input.value);
    input.addEventListener("input", (e) => {
      e.target.value = formatar(e.target.value);
    });
  }

  function aplicarMascaraData(input) {
    if (!input) return;
    input.maxLength = 10; // DD/MM/AAAA
    const formatar = (val) => {
      let v = val.replace(/\D/g, "").slice(0, 8);
      if (v.length <= 2) return v;
      if (v.length <= 4) return `${v.slice(0, 2)}/${v.slice(2)}`;
      return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
    };
    if (input.value) input.value = formatar(input.value);
    input.addEventListener("input", (e) => {
      e.target.value = formatar(e.target.value);
    });
  }

  /**
   * Retorna o SVG de um ícone para substituir o Font Awesome (CSP compliance).
   */
  function getIcon(name, options = {}) {
    const size = options.size || 16;
    const color = options.color || 'currentColor';
    const className = options.class || '';

    const icons = {
      'ellipsis-v': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="${color}" class="${className}" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>`,
      'chevron-right': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="${color}" class="${className}" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>`,
      'pencil-alt': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="${color}" class="${className}" xmlns="http://www.w3.org/2000/svg"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>`,
      'envelope': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="${color}" class="${className}" xmlns="http://www.w3.org/2000/svg"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383l-4.758 2.855L15 11.114V5.383zm-.034 6.878L9.271 8.82 8 9.583 6.728 8.82l-5.694 3.44A1 1 0 0 0 2 13h12a1 1 0 0 0 .272-.039zM1 11.114l4.758-2.876L1 5.383v5.731z"/></svg>`,
      'map-marker-alt': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="${color}" class="${className}" xmlns="http://www.w3.org/2000/svg"><path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>`,
      'user': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="${color}" class="${className}" xmlns="http://www.w3.org/2000/svg"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/></svg>`,
      'paper-plane': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="${color}" class="${className}" xmlns="http://www.w3.org/2000/svg"><path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11zM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493z"/></svg>`,
      'spinner': `<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="${color}" class="${className} af-spin" xmlns="http://www.w3.org/2000/svg"><path d="M304 48c0 26.51-21.49 48-48 48s-48-21.49-48-48 21.49-48 48-48 48 21.49 48 48zm-48 368c-26.51 0-48 21.49-48 48s21.49 48 48 48 48-21.49 48-48-21.49-48-48-48zm208-160c-26.51 0-48 21.49-48 48s21.49 48 48 48 48-21.49 48-48-21.49-48-48-48zM96 256c0-26.51-21.49-48-48-48S0 229.49 0 256s21.49 48 48 48 48-21.49 48-48zm407.39-122.39c-18.75-18.75-49.15-18.75-67.9 0s-18.75 49.15 0 67.9 49.15 18.75 67.9 0 18.75-49.15 0-67.9zM116.51 327.59c-18.75-18.75-49.15-18.75-67.9 0s-18.75 49.15 0 67.9 49.15 18.75 67.9 0 18.75-49.15 0-67.9zm278.98 0c-18.75-18.75-49.15-18.75-67.9 0s-18.75 49.15 0 67.9 49.15 18.75 67.9 0 18.75-49.15 0-67.9zM116.51 116.51c-18.75-18.75-49.15-18.75-67.9 0s-18.75 49.15 0 67.9 49.15 18.75 67.9 0 18.75-49.15 0-67.9z"/></svg>`,
      'times-circle': `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="${color}" class="${className}" xmlns="http://www.w3.org/2000/svg"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 1 0 0 16z"/><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>`
    };
    return icons[name] || '';
  }

  global.Utils = {
    obterToken,
    obterUserInfo,
    apiFetch: window.Api.apiFetch,
    aplicarMascaraTelefone,
    formatarTelefoneTexto,
    formatarCPF,
    normalizarTextoBusca,
    aplicarMascaraAgencia,
    aplicarMascaraConta,
    aplicarMascaraCPF,
    aplicarMascaraCEP,
    formatarCEP,
    aplicarMascaraData,
    normalizeText,
    escapeHTML,
    searchUsers,
    filterUsers,
    getIcon,
    abrirModalGenerico,
    fecharModalGenerico,
    isGestao,
    canManageAdmins,
    canComposeMesa,
    canCreateCredenciamentoToken,
    canRegisterForEvent,
    canCheckInEvent
  };

  const PERFIL_ACESSO = {
    ADMIN: 'ADMIN',
    DIRETORIA: 'DIRETORIA',
    COLABORADOR: 'COLABORADOR',
    CONSELHEIRO: 'CONSELHEIRO'
  };

  /**
   * CANON RBAC Helpers
   */
  function isGestao(perfil) {
    const p = (perfil || "").toUpperCase();
    return [PERFIL_ACESSO.ADMIN, PERFIL_ACESSO.COLABORADOR, PERFIL_ACESSO.DIRETORIA].includes(p);
  }

  function canManageAdmins(perfil) {
    return (perfil || "").toUpperCase() === PERFIL_ACESSO.ADMIN;
  }

  function canComposeMesa(user) {
    if (!user) return false;
    if ((user.perfil_acesso || "").toUpperCase() === PERFIL_ACESSO.ADMIN) return true;
    const cargosAutorizados = ["Presidente da FENAPRF", "Vice-Presidente da FENAPRF"];
    return cargosAutorizados.includes(user.cargo || "") || cargosAutorizados.includes(user.cargo2 || "");
  }

  function canCreateCredenciamentoToken(user) {
    if (!user) return false;
    const cargosAutorizados = [
      "Presidente da FENAPRF",
      "Vice-Presidente da FENAPRF",
      "Diretor de Secretaria",
      "Diretor de Secretaria Substituto"
    ];
    return cargosAutorizados.includes(user.cargo || "") || cargosAutorizados.includes(user.cargo2 || "");
  }

  function canRegisterForEvent(perfil) {
    const p = (perfil || "").toUpperCase();
    return p === PERFIL_ACESSO.DIRETORIA || p === PERFIL_ACESSO.CONSELHEIRO;
  }

  function canCheckInEvent(perfil) {
    const p = (perfil || "").toUpperCase();
    return p === PERFIL_ACESSO.DIRETORIA || p === PERFIL_ACESSO.CONSELHEIRO;
  }

  function abrirModalGenerico(titulo, html) {
    const modal = document.getElementById("modal-generic");
    const titEl = document.getElementById("modal-generic-titulo");
    const corpoEl = document.getElementById("modal-generic-corpo");

    if (!modal || !titEl || !corpoEl) return;

    titEl.innerText = titulo;
    corpoEl.innerHTML = html;
    modal.classList.add("active");
    modal.style.display = "flex";

    // Setup close listeners for this instance
    const closeBtn = modal.querySelector(".modal-close");
    if (closeBtn) {
        closeBtn.onclick = fecharModalGenerico;
    }
  }

  function fecharModalGenerico() {
    const modal = document.getElementById("modal-generic");
    if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
    }
  }

  // Global close listener for [data-close]
  document.addEventListener('click', (e) => {
    if (e.target.matches('.modal-close') || e.target.closest('.modal-close')) {
      const modalId = (e.target.dataset.close || e.target.closest('.modal-close').dataset.close);
      if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
          modal.classList.remove("active");
          modal.style.display = "none";
        }
      }
    }
  });

  // Global avatar fallback handler
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && (e.target.classList.contains('avatar-mini') || e.target.classList.contains('me-avatar-img'))) {
        e.target.src = '/img/avatar-placeholder.png';
    }
  }, true);

  let _usersCache = null;

  /**
   * Filtra uma lista de membros com base em uma query de nome ou CPF.
   * Centraliza a lógica de busca para garantir paridade entre módulos.
   */
  function filterUsers(lista, query, options = {}) {
    if (!query || query.length < 2) return lista;

    const termo = normalizeText(query);
    const apenasDigitos = query.replace(/\D/g, "");

    // FENAPRF: CPF search allowed for everyone per latest requirement
    const canSearchCpf = true;

    return (lista || []).filter(f => {
      // Busca por nome (normalizado) - Accent-insensitive / Case-insensitive (Wide Search)
      const nomeParaBusca = f.name || f.nome || "";
      const nomeNorm = normalizeText(nomeParaBusca);
      const matchesNome = nomeNorm.includes(termo);

      // Busca por CPF (apenas dígitos)
      let matchesCpf = false;
      if (canSearchCpf) {
          const cpfDigits = (f.cpf || "").replace(/\D/g, "");
          matchesCpf = apenasDigitos && cpfDigits.includes(apenasDigitos);
      }

      return matchesNome || matchesCpf;
    });
  }

  /**
   * Busca unificada de membros (Frontend).
   * Carrega todos os membros uma vez e filtra localmente para garantir
   * paridade entre as telas de Membros e Relatórios.
   */
  async function searchUsers(query, options = {}) {
    if (!_usersCache || options.forceRefresh) {
      const r = await global.Utils.apiFetch('/api/users');
      if (r.ok || r.status === 304) {
        if (r.status !== 304) {
            const d = await r.json();
            _usersCache = d.users || d || [];
        }
      } else {
        console.error("Erro ao carregar cache de membros", r.status);
        return [];
      }
    }

    return filterUsers(_usersCache, query);
  }
})(typeof window !== 'undefined' ? window : global);
