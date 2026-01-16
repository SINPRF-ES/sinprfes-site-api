// mobile/src/utils/date.ts

/**
 * Converte uma data do formato DD/MM/YYYY para YYYY-MM-DD.
 * Retorna null se a data de entrada for inválida, vazia ou nula.
 * @param dateString A data no formato DD/MM/YYYY.
 * @returns A data no formato YYYY-MM-DD ou null.
 */
export const toISODate = (dateString: string | null | undefined): string | null => {
  if (!dateString) {
    return null;
  }

  const parts = dateString.split('/');
  if (parts.length !== 3) {
    return null;
  }

  const [day, month, year] = parts;
  // Validação básica
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return null;
  }

  // Retorna no formato AAAA-MM-DD
  return `${year}-${month}-${day}`;
};

/**
 * Converte uma data do formato YYYY-MM-DD para DD/MM/YYYY.
 * Retorna uma string vazia se a data de entrada for inválida, vazia ou nula.
 * @param dateString A data no formato YYYY-MM-DD.
 * @returns A data no formato DD/MM/YYYY ou ''.
 */
export const toBrazilianDate = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return '';
  }

  const parts = dateString.split('-');
  if (parts.length !== 3) {
    return dateString; // Retorna o original se não estiver no formato esperado
  }

  const [year, month, day] = parts;
  // Validação básica
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return dateString;
  }

  // Retorna no formato DD/MM/YYYY
  return `${day}/${month}/${year}`;
};
