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
  return `***${d.slice(5, 12)}**`;
}

function maskDocument(doc) {
  const d = onlyDigits(doc);
  if (d.length === 11) return maskCpf(d);
  if (d.length === 14) return maskCnpj(d);
  return '***';
}

function hashDocument(doc) {
  return crypto.createHash('sha256').update(onlyDigits(doc)).digest('hex');
}

module.exports = {
  onlyDigits,
  maskCpf,
  maskCnpj,
  maskDocument,
  hashDocument,
  hashCpf: hashDocument, // Alias for backward compatibility if needed
};
