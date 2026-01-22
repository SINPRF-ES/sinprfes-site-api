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

module.exports = {
  normalizarCpf,
  normalizarCep,
  // normalizarDataEntrada e normalizarDataBanco removidas.
};