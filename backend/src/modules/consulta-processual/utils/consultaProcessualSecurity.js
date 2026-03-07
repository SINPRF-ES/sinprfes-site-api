const crypto = require('crypto');

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function maskCpf(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return '***';
  return `***${d.slice(3, 9)}**`;
}

function hashCpf(cpf) {
  return crypto.createHash('sha256').update(onlyDigits(cpf)).digest('hex');
}

module.exports = {
  onlyDigits,
  maskCpf,
  hashCpf,
};
