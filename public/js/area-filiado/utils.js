/**
 * Utilitários Compartilhados (Área do Filiado)
 * Carregado como script clássico (window.Utils)
 */

(function (global) {
  if (global.Utils) return;

  const API_BASE = (window.location.hostname === "localhost")
    ? "http://localhost:3000"
    : "https://api.sinprfes.org.br";

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

  function exibirAlertaFlutuante() {
    if (sessionStorage.getItem('fechouAlertaJogos')) return;
    const div = document.createElement('div');
    div.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #e67e22; color: white; padding: 20px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.4); z-index: 9999; max-width: 300px; font-family: sans-serif; border: 2px solid #fff;";
    div.innerHTML = `<button style="position: absolute; top: 5px; right: 8px; background: none; border: none; color: white; font-weight: bold; cursor: pointer;">✕</button><h3 style="margin: 0 0 10px 0; font-size: 1.2rem;">🏆 Jogos 2026</h3><p style="margin: 0 0 15px 0;">Não esqueça sua pré-inscrição!</p><button id="btn-ir-jogos" style="background: white; color: #d35400; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; width: 100%;">Inscrever-se</button>`;
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
    if (!input) return;
    input.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11);
    });
  }

  function aplicarMascaraCEP(input) {
    if (!input) return;
    input.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 8);
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
      const options = global.ParentescoUtils ? global.ParentescoUtils.PARENTESCO_OPTIONS : [];
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
          inputHiddenFinal.value = inputOutro.value.trim();
        } else {
          inputOutro.style.display = 'none';
          inputOutro.value = '';
          inputHiddenFinal.value = selectParentesco.value;
        }
      };
      selectParentesco.addEventListener('change', atualizarParentesco);
      inputOutro.addEventListener('input', atualizarParentesco);

      // Listener para o campo manual atualizar o hidden
      inputOutro.addEventListener('input', () => {
        if (selectParentesco.value === 'OUTRO') {
          inputHiddenFinal.value = inputOutro.value.trim();
        }
      });
      container.appendChild(clone);
    }
  }

  global.Utils = {
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
    gerarCamposDependentes,
    normalizeText
  };
})(typeof window !== 'undefined' ? window : global);
