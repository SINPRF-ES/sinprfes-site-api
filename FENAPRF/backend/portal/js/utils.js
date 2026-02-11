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
    filterUsers
  };

  let _usersCache = null;

  /**
   * Filtra uma lista de membros com base em uma query de nome ou CPF.
   * Centraliza a lógica de busca para garantir paridade entre módulos.
   */
  function filterUsers(lista, query, options = {}) {
    if (!query || query.length < 2) return lista;

    const termo = normalizeText(query);
    const apenasDigitos = query.replace(/\D/g, "");

    // Regra de segurança: Perfis básicos não buscam por CPF
    const perfil = (options.perfil || "").toUpperCase();
    const canSearchCpf = !perfil || !["CONSELHEIRO"].includes(perfil);

    return (lista || []).filter(f => {
      // Busca por nome (normalizado)
      const nomeNorm = normalizeText(f.nome);
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
      if (r.ok) {
        const d = await r.json();
        _usersCache = d.users || d || [];
      } else {
        console.error("Erro ao carregar cache de membros");
        return [];
      }
    }

    return filterUsers(_usersCache, query);
  }
})(typeof window !== 'undefined' ? window : global);
