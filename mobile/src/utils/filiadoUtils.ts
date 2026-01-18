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
 * Log de depuração apenas em ambiente de desenvolvimento.
 */
export const logDebug = (tag: string, data: any) => {
  if (__DEV__) {
    console.log(`[DEBUG][${tag}]`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  }
};
