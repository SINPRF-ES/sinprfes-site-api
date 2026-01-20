/**
 * Normaliza um texto removendo acentos e convertendo para caixa baixa.
 * Útil para buscas que ignoram acentuação.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
