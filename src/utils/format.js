// src/utils/format.js

function normalizarCpf(cpf) {
  if (!cpf) return null;
  return cpf.toString().replace(/\D/g, "");
}

module.exports = {
  normalizarCpf,
  // normalizarDataEntrada e normalizarDataBanco removidas.
};