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
  escapeHtml,
  // normalizarDataEntrada e normalizarDataBanco removidas.
};