// shared/format/index.js

/**
 * Remove all non-digit characters from a string.
 * @param {string | null | undefined} value The input string.
 * @returns {string} The string with only digits.
 */
function onlyDigits(value) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }
  return String(value).replace(/\D/g, '');
}

/**
 * Formats a CPF string.
 * Returns the original string if it's not 11 digits long.
 * @param {string} cpf The CPF string.
 * @returns {string} The formatted CPF or the original string.
 */
function formatCpf(cpf) {
  if (!cpf) return '';
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) {
    return cpf; // Returns original value if not a valid CPF length, as per web logic
  }
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formats a telephone number string for 10 or 11 digits.
 * @param {string} phone The phone number string.
 * @returns {string} The formatted phone number or the original digits.
 */
function formatTelefone(phone) {
  if (!phone) return '';
  const digits = onlyDigits(phone);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits; // Return only digits if not 10 or 11, for consistency
}

/**
 * Formats a CEP string.
 * @param {string} cep The CEP string.
 * @returns {string} The formatted CEP or the original string.
 */
function formatCep(cep) {
  if (!cep) return '';
  const digits = onlyDigits(cep);
  if (digits.length !== 8) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Normalizes a CPF string to only digits.
 * @param {string} value The input string.
 * @returns {string} The CPF with only digits.
 */
function normalizeCpf(value) {
  return onlyDigits(value);
}

/**
 * Normalizes a telephone number string to only digits.
 * @param {string} value The input string.
 * @returns {string} The phone number with only digits.
 */
function normalizeTelefone(value) {
  return onlyDigits(value);
}

/**
 * Normalizes a CEP string to only digits.
 * @param {string} value The input string.
 * @returns {string} The CEP with only digits.
 */
function normalizeCep(value) {
  return onlyDigits(value);
}

/**
 * Parses a date string (DD/MM/YYYY or YYYY-MM-DD) to ISO format (YYYY-MM-DD).
 * @param {string} value The input date string.
 * @returns {string | null} The ISO date string or null.
 */
function parseDateToISO(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // Se for ISO ou similar (YYYY-MM-DD...)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  // Se for formato brasileiro DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

module.exports = {
  onlyDigits,
  formatCpf,
  formatTelefone,
  formatCep,
  normalizeCpf,
  normalizeTelefone,
  normalizeCep,
  parseDateToISO,
};
