/**
 * Utilitário para validação e extração segura de UUIDs.
 */

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida se uma string é um UUID v1-v5 válido.
 * @param {string} uuid
 * @returns {boolean}
 */
function isValidUuid(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;
  return uuidRegex.test(uuid);
}

/**
 * Tenta extrair um UUID de um parâmetro de requisição.
 * @param {string} value
 * @returns {string|null} O UUID se válido, null caso contrário.
 */
function parseUuid(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (uuidRegex.test(trimmed)) {
    return trimmed;
  }
  return null;
}

module.exports = {
  isValidUuid,
  parseUuid,
  uuidRegex
};
