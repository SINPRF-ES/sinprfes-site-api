// src/utils/format.js

function normalizarCpf(cpf) {
  if (!cpf) return null;
  return cpf.toString().replace(/\D/g, "");
}

function normalizarCep(cep) {
  if (!cep) return null;
  const limpo = cep.toString().replace(/\D/g, "");
  if (limpo === "") return null;
  return limpo.slice(0, 8);
}

/**
 * Aplica máscara de CPF: 000.000.000-00
 */
function formatarCPF(cpf) {
  if (!cpf) return "";
  const limpo = cpf.toString().replace(/\D/g, "");
  if (limpo.length !== 11) return cpf;
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Aplica máscara de Telefone: (00) 00000-0000 ou (00) 0000-0000
 */
function formatarTelefone(tel) {
  if (!tel) return "";
  const limpo = tel.toString().replace(/\D/g, "");
  if (limpo.length === 11) {
    return limpo.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (limpo.length === 10) {
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return tel;
}

/**
 * Formata data ISO (AAAA-MM-DD) para PT-BR (DD/MM/AAAA)
 */
function formatarDataBR(dataStr) {
  if (!dataStr) return "";
  const s = dataStr.toString().trim();
  // Se já estiver no formato DD/MM/AAAA, retorna como está
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  // Se for ISO ou similar (YYYY-MM-DD...)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  }
  return dataStr;
}

/**
 * Escapa caracteres HTML perigosos para prevenir XSS.
 */
function escapeHtml(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = {
  normalizarCpf,
  normalizarCep,
  formatarCPF,
  formatarTelefone,
  formatarDataBR,
  escapeHtml,
  // normalizarDataEntrada e normalizarDataBanco removidas.
};