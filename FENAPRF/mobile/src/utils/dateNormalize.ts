/**
 * Normaliza diferentes formatos de data para o padrão ISO YYYY-MM-DD.
 * Aceita:
 * - YYYY-MM-DD (devolve igual)
 * - YYYY-MM-DDTHH:mm:ss... (corta e devolve YYYY-MM-DD)
 * - DD/MM/YYYY (converte para YYYY-MM-DD)
 * - Objeto Date (converte para YYYY-MM-DD local)
 * - "" / null / undefined (retorna null)
 *
 * @param input Valor da data em diversos formatos
 * @returns String no formato YYYY-MM-DD ou null
 */
export function toIsoDateYYYYMMDD(input: string | Date | null | undefined): string | null {
  if (!input) return null;

  let dateStr = '';

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const year = input.getFullYear();
    const month = String(input.getMonth() + 1).padStart(2, '0');
    const day = String(input.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  dateStr = String(input).trim();
  if (!dateStr) return null;

  // Caso 1: ISO completa ou apenas data (YYYY-MM-DD...)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }

  // Caso 2: Formato brasileiro (DD/MM/YYYY)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Fallback: Tenta dar parse no que sobrar
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // ignore
  }

  return null;
}
