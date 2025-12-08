// src/utils/format.js

function normalizarCpf(cpf) {
  if (!cpf) return null;
  return cpf.toString().replace(/\D/g, "");
}

/**
 * Normaliza a data enviada pelo usuário.
 * Aceita:
 *  - "dd/mm/aaaa"
 *  - "aaaa-mm-dd"
 * Retorna sempre "aaaa-mm-dd".
 */
function normalizarDataEntrada(data) {
  if (!data) return null;

  // Já está em formato ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return data;
  }

  // Formato brasileiro dd/mm/aaaa
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [d, m, a] = data.split("/");
    return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return data;
}

/**
 * Normaliza a data que vem do banco.
 * Pode vir:
 *  - como Date
 *  - string "dd/mm/aaaa"
 *  - string "aaaa-mm-dd"
 */
function normalizarDataBanco(valor) {
  if (!valor) return null;

  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }

  // dd/mm/aaaa
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    const [d, m, a] = valor.split("/");
    return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // já ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return valor;
  }

  return valor;
}

module.exports = {
  normalizarCpf,
  normalizarDataEntrada,
  normalizarDataBanco,
};
