const crypto = require('crypto');

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function maskCpf(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return '***';
  return `***${d.slice(3, 9)}**`;
}

function maskCnpj(cnpj) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return '***';
  return `*${d.slice(7, 14)}`;
}

function hashDocument(doc) {
  return crypto.createHash('sha256').update(onlyDigits(doc)).digest('hex');
}

module.exports = {
  onlyDigits,
  maskCpf,
  maskCnpj,
  hashDocument,
  // Mantendo compatibilidade
  hashCpf: hashDocument,
};
