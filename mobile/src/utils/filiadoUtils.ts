// mobile/src/utils/filiadoUtils.ts

/**
 * Normaliza a situação funcional para os valores canônicos: ATIVO, VETERANO, PENSIONISTA.
 * Lida com variações de plural, espaços e caixa alta/baixa.
 */
export function normalizeSituacaoFuncional(value?: string | null): 'ATIVO' | 'VETERANO' | 'PENSIONISTA' | '' {
  if (!value) return '';

  const v = value.trim().toUpperCase();

  if (v === 'VETERANO' || v === 'VETERANOS') return 'VETERANO';
  if (v === 'PENSIONISTA' || v === 'PENSIONISTAS') return 'PENSIONISTA';
  if (v === 'ATIVO' || v === 'ATIVOS') return 'ATIVO';

  return '';
}

/**
 * Retorna o ID do filiado de forma canônica (string).
 * Aceita o objeto filiado ou o próprio id.
 */
export function getCanonicalFiliadoId(filiado: any): string {
  if (!filiado) return '';
  const id = typeof filiado === 'object' ? (filiado.id || filiado.filiado_id) : filiado;
  return id ? String(id) : '';
}

/**
 * Converte um ID canônico (string) para o formato esperado pelo backend (number).
 */
export function parseCanonicalFiliadoId(id: string | number): number {
  if (!id) return 0;
  const parsed = parseInt(String(id), 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Log de depuração apenas em ambiente de desenvolvimento.
 */
export const logDebug = (tag: string, data: any) => {
  if (__DEV__) {
    console.log(`[DEBUG][${tag}]`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  }
};
