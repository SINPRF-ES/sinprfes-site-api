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
 * Normalizes a string to only digits, returning null if the result is empty.
 * @param {string | null | undefined} value The input string.
 * @returns {string | null} Only digits or null.
 */
function onlyDigitsOrNull(value) {
  const digits = onlyDigits(value);
  return digits === '' ? null : digits;
}

/**
 * Normalizes a telephone number string to only digits.
 * @param {string} value The input string.
 * @returns {string} The phone number with only digits.
 */
function normalizeTelefone(value) {
  return onlyDigitsOrNull(value);
}

/**
 * Normalizes a CEP string to only digits.
 * @param {string} value The input string.
 * @returns {string} The CEP with only digits.
 */
function normalizeCep(value) {
  return onlyDigits(value);
}

module.exports = {
  onlyDigits,
  onlyDigitsOrNull,
  formatCpf,
  formatTelefone,
  formatCep,
  normalizeCpf,
  normalizeTelefone,
  normalizeCep,
};
