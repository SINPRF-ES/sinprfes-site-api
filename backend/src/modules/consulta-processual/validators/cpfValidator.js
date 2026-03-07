const { onlyDigits } = require('../utils/consultaProcessualSecurity');

function sanitizeAndValidateCpf(cpfRaw) {
  const cpf = onlyDigits(cpfRaw);
  if (!cpf || cpf.length !== 11) {
    return { ok: false, cpf: null };
  }
  return { ok: true, cpf };
}

module.exports = { sanitizeAndValidateCpf };
