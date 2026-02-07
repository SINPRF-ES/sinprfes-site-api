// mobile/src/utils/userUtils.ts

/**
 * Normaliza a situação funcional para os valores canônicos: ATIVO, VETERANO, PENSIONISTA.
 * Lida com variações de plural, espaços e caixa alta/baixa.
 */
export function normalizeSituacaoFuncional(value?: string | null): 'ATIVO' | 'VETERANO' | 'PENSIONISTA' | '' {
  if (!value) return '';

  const v = value.trim().toUpperCase();

  if (v === 'VETERANO' || v === 'VETERANOS' || v === 'APOSENTADO' || v === 'APOSENTADOS') return 'VETERANO';
  if (v === 'PENSIONISTA' || v === 'PENSIONISTAS') return 'PENSIONISTA';
  if (v === 'ATIVO' || v === 'ATIVOS') return 'ATIVO';

  return '';
}

/**
 * Canoniza o ID do user para string numérica, garantindo consistência
 * entre o app (que prefere strings) e o backend (que usa INTEGER/SERIAL).
 */
export function getCanonicalUserId(obj: any): string {
  if (!obj) return '';
  // Se for um objeto (user ou user), pega o .id
  const id = typeof obj === 'object' ? obj.id : obj;
  if (id === undefined || id === null) return '';
  return String(id);
}

/**
 * Alias para getCanonicalUserId para expressar intenção de parsear um ID vindo de rota.
 */
export function parseCanonicalUserId(id: any): string {
  return getCanonicalUserId(id);
}

/**
 * Roles canônicas do sistema (FENAPRF).
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  DIRETORIA: 'DIRETORIA',
  COLABORADOR: 'COLABORADOR',
  CONSELHEIRO: 'CONSELHEIRO',
  FUNCIONARIO: 'FUNCIONARIO',
  ORGANIZADOR: 'ORGANIZADOR',
  COMUNICADOR: 'COMUNICADOR',
};

/**
 * Verifica se o perfil tem acesso de gestão (administrativo geral).
 */
export const isGestao = (perfil?: string | null) => {
  if (!perfil) return false;
  const p = perfil.toUpperCase();
  return [ROLES.ADMIN, ROLES.DIRETORIA, ROLES.COLABORADOR].includes(p);
};

/**
 * Verifica se o perfil tem acesso de diretoria (pode criar assembleias, ver logs, etc).
 */
export const isDiretoria = (perfil?: string | null) => {
  if (!perfil) return false;
  const p = perfil.toUpperCase();
  return [ROLES.ADMIN, ROLES.DIRETORIA].includes(p);
};

/**
 * Log de depuração apenas em ambiente de desenvolvimento.
 */
export const logDebug = (tag: string, data: any) => {
  if (__DEV__) {
    console.log(`[DEBUG][${tag}]`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  }
};
