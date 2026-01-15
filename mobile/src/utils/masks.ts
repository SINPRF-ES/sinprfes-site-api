// mobile/src/utils/masks.ts

/**
 * Remove todos os caracteres não numéricos de uma string.
 */
export const sanitizeDigits = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Formata uma string de dígitos para o formato de telefone brasileiro.
 * Adapta-se a números de 8 ou 9 dígitos (celular vs. fixo).
 */
export const formatPhone = (value: string): string => {
  if (!value) return '';
  const digits = sanitizeDigits(value);

  if (!digits) return '';

  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

/**
 * Formata uma string de dígitos para o formato de CPF.
 */
export const formatCPF = (value: string): string => {
  const digits = sanitizeDigits(value);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

/**
 * Formata uma string de dígitos para o formato de CEP.
 */
export const formatCEP = (value: string): string => {
  const digits = sanitizeDigits(value);
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
};

/**
 * Formata uma string de dígitos para o formato de data dd/MM/yyyy.
 */
export const formatDate = (value: string): string => {
  const digits = sanitizeDigits(value);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

/**
 * Converte uma data no formato dd/MM/yyyy para o formato ISO yyyy-MM-dd.
 * Retorna null se a data for inválida ou vazia.
 */
export const parseBRToISO = (brDate: string | null | undefined): string | null => {
  if (!brDate) return null;
  const parts = brDate.split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year) || year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Formata com padding (ex: 1 -> "01")
  const monthStr = month.toString().padStart(2, '0');
  const dayStr = day.toString().padStart(2, '0');

  return `${year}-${monthStr}-${dayStr}`;
};

/**
 * Converte uma data ISO (yyyy-MM-dd ou com T/Z) para o formato dd/MM/yyyy.
 * Retorna uma string vazia se a data for inválida ou vazia.
 */
export const formatISOToBR = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';

  // Pega apenas a parte da data, ignorando o T/Z
  const datePart = isoDate.split('T')[0];
  const parts = datePart.split('-');

  if (parts.length !== 3) return '';

  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  return `${day}/${month}/${year}`;
};
