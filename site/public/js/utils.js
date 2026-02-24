/**
 * Utilitários Compartilhados (Página Inicial)
 * Carregado como script clássico (window.Utils)
 */

(function (window) {
  if (window.Utils) return;

  function resolveApiBase() {
    const base =
      window.API_BASE_URL ||
      window.ENV_CONFIG?.API_URL ||
      ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:3000"
        : ""); // Default to empty (relative) on production for site proxy

    return String(base || "").replace(/\/+$/, "");
  }

  window.Api = window.Api || {};
  window.Api.BASE_URL = resolveApiBase();
  window.DEBUG_API = false; // Mudar para true via console para habilitar logs detalhados

  function obterToken() {
    const isFiliadoArea =
      window.location.pathname.includes("area-filiado") ||
      window.location.pathname.includes("area-filiado.html");

    const tokenFiliado = localStorage.getItem("token_filiado");
    const tokenGestao = localStorage.getItem("token_gestao");
    const tokenLegado = localStorage.getItem("token");

    if (isFiliadoArea) {
      return tokenFiliado || tokenLegado;
    }
    return tokenGestao || tokenLegado;
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
      const API_BASE = resolveApiBase();
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

      // 🔎 DEBUG TEMPORÁRIO /me (Instrumentação solicitada para detectar vazamentos)
      if (window.DEBUG_API && String(url).includes("/api/filiados/me") && ["PUT", "PATCH"].includes(options.method)) {
        try {
          const keys = typeof options.body === "string"
            ? Object.keys(JSON.parse(options.body || "{}"))
            : Object.keys(options.body || {});
          console.log("[apiFetch DEBUG /me] keys:", keys.sort());
        } catch (e) {
          // Ignora erro de parse se o body não for JSON
        }
      }

      const response = await fetch(finalUrl, { ...options, headers });

      if (response.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        localStorage.removeItem("token");
        localStorage.removeItem("token_filiado");
        localStorage.removeItem("token_gestao");
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
    if (window.Formatters) return window.Formatters.formatTelefone(v) || "-";
    if (!v) return "-";
    v = String(v).replace(/\D/g, "");
    if (v.length === 11) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    if (v.length === 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
    return v;
  }

  function formatarCPF(cpf) {
    if (window.Formatters) return window.Formatters.formatCpf(cpf);
    if (!cpf) return "";
    const only = String(cpf).replace(/\D/g, "");
    if (only.length !== 11) return cpf;
    return only.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
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
   * Padronizado para uso em templates innerHTML.
   */
  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function exibirAlertaFlutuante() {
    if (sessionStorage.getItem('fechouAlertaJogos')) return;
    const div = document.createElement('div');
    div.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #e67e22; color: white; padding: 20px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.4); z-index: 9999; max-width: 300px; font-family: sans-serif; border: 2px solid #fff;";
    div.innerHTML = `<button aria-label="Fechar" style="position: absolute; top: 5px; right: 8px; background: none; border: none; color: white; font-weight: bold; cursor: pointer;">✕</button><h3 style="margin: 0 0 10px 0; font-size: 1.2rem;">🏆 Jogos 2026</h3><p style="margin: 0 0 15px 0;">Não esqueça sua pré-inscrição!</p><button id="btn-ir-jogos" style="background: white; color: #d35400; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; width: 100%;">Inscrever-se</button>`;
    document.body.appendChild(div);
    div.querySelector('button').addEventListener('click', () => { div.remove(); sessionStorage.setItem('fechouAlertaJogos', 'true'); });
    div.querySelector('#btn-ir-jogos').addEventListener('click', () => {
      const btn = document.querySelector('button[data-target="sec-jogos"]');
      if (btn) btn.click();
      div.remove();
    });
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
      if (window.Formatters && window.Formatters.formatCpfLive) {
        return window.Formatters.formatCpfLive(val);
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

  /** Palette: Inicializa o toggle de "Mostrar Senha" para campos password. */
  function initPasswordToggles() {
    document.querySelectorAll('input[type="password"]:not([data-has-toggle])').forEach(el => {
      const wrap = document.createElement('div');
      wrap.className = 'password-input-wrapper';
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'password-toggle-btn'; btn.innerHTML = '👁️';
      btn.setAttribute('aria-label', 'Mostrar senha');
      btn.setAttribute('title', 'Mostrar senha');
      btn.setAttribute('aria-pressed', 'false');
      btn.onclick = () => {
        const showing = el.type === 'password';
        el.type = showing ? 'text' : 'password';
        btn.innerHTML = showing ? '🙈' : '👁️';
        const label = showing ? 'Ocultar senha' : 'Mostrar senha';
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
        btn.setAttribute('aria-pressed', showing ? 'true' : 'false');
      };
      wrap.appendChild(btn);
      el.dataset.hasToggle = 'true';
    });
  }

  function gerarCamposDependentes(container, prefixoId = '') {
    const template = document.getElementById('template-dependentes');
    if (!template || !container) return;
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const clone = template.content.cloneNode(true);
      clone.querySelector('.dependente-numero').textContent = i;
      const nomePrefixo = prefixoId ? `${prefixoId}-` : '';
      const campos = clone.querySelectorAll('input, label, select');
      campos.forEach(campo => {
        const nomeOriginal = campo.name || '';
        const idOriginal = campo.id || '';
        const forOriginal = campo.htmlFor || '';
        if (nomeOriginal) campo.name = `${nomeOriginal.replace('depN_', `dep${i}_`)}`;
        if (idOriginal) campo.id = `${nomePrefixo}${idOriginal.replace('depN_', `dep${i}_`)}`;
        if (forOriginal) campo.htmlFor = `${nomePrefixo}${forOriginal.replace('depN_', `dep${i}_`)}`;
      });
      const selectParentesco = clone.querySelector(`select[name="dep${i}_parentesco_select"]`);
      const options = window.ParentescoUtils ? window.ParentescoUtils.PARENTESCO_OPTIONS : [];
      selectParentesco.innerHTML = '<option value="" selected disabled>Selecione...</option>';
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        selectParentesco.appendChild(o);
      });
      const inputOutro = clone.querySelector(`input[name="dep${i}_parentesco_outro"]`);
      const inputHiddenFinal = clone.querySelector(`input[name="dep${i}_parentesco"]`);
      const atualizarParentesco = () => {
        if (selectParentesco.value === 'OUTRO') {
          inputOutro.style.display = 'block';
          inputHiddenFinal.value = 'OUTRO';
        } else {
          inputOutro.style.display = 'none';
          inputOutro.value = '';
          inputHiddenFinal.value = selectParentesco.value;
        }
      };
      selectParentesco.addEventListener('change', atualizarParentesco);
      container.appendChild(clone);
    }
  }

  window.Utils = {
    obterToken,
    obterUserInfo,
    apiFetch: window.Api.apiFetch,
    aplicarMascaraTelefone,
    formatarTelefoneTexto,
    formatarCPF,
    normalizarTextoBusca,
    exibirAlertaFlutuante,
    aplicarMascaraAgencia,
    aplicarMascaraConta,
    aplicarMascaraCPF,
    aplicarMascaraCEP,
    aplicarMascaraData,
    gerarCamposDependentes,
    normalizeText,
    escapeHTML,
    searchFiliados,
    filterFiliados,
    lockScroll,
    unlockScroll,
    fecharModal,
    resolveApiBase,
    initPasswordToggles
  };

  function fecharModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
    unlockScroll();
  }

  let scrollPosition = 0;
  function lockScroll() {
    // Only lock if not already locked
    if (document.body.style.position === 'fixed') return;

    scrollPosition = window.pageYOffset;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = '100%';
  }

  function unlockScroll() {
    // Only unlock if it was locked
    if (document.body.style.position !== 'fixed') return;

    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('position');
    document.body.style.removeProperty('top');
    document.body.style.removeProperty('width');
    window.scrollTo(0, scrollPosition);
  }

  let _filiadosCache = null;

  /**
   * Filtra uma lista de filiados com base em uma query de nome ou CPF.
   * Centraliza a lógica de busca para garantir paridade entre módulos.
   */
  function filterFiliados(lista, query, options = {}) {
    if (!query || query.length < 2) return lista;

    const termo = normalizeText(query);
    const apenasDigitos = query.replace(/\D/g, "");

    // Regra de segurança: Perfis básicos não buscam por CPF
    const perfil = (options.perfil || "").toUpperCase();
    const canSearchCpf = !perfil || !["FILIADO", "ORGANIZADOR"].includes(perfil);

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
   * Busca unificada de filiados (Frontend).
   * Carrega todos os filiados uma vez e filtra localmente para garantir
   * paridade entre as telas de Filiados e Relatórios.
   */
  async function searchFiliados(query, options = {}) {
    if (!_filiadosCache || options.forceRefresh) {
      const r = await window.Utils.apiFetch('/api/filiados');
      if (r.ok) {
        const d = await r.json();
        _filiadosCache = d.filiados || d || [];
      } else {
        console.error("Erro ao carregar cache de filiados");
        return [];
      }
    }

    return filterFiliados(_filiadosCache, query);
  }
})(typeof window !== 'undefined' ? window : this);
