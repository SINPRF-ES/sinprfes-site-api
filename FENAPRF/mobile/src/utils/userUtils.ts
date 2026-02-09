// mobile/src/utils/userUtils.ts
import * as Canon from './canon';

/**
 * Normaliza a situação funcional para os valores canônicos: ATIVO, VETERANO, PENSIONISTA.
 * @deprecated FENAPRF não utiliza mais situação funcional. Use apenas para retrocompatibilidade se necessário.
 */
export function normalizeSituacaoFuncional(value?: string | null): string {
  return 'ATIVO';
}

/**
 * Canoniza o ID do user para string numérica.
 */
export function getCanonicalUserId(obj: any): string {
  if (!obj) return '';
  const id = typeof obj === 'object' ? obj.id : obj;
  if (id === undefined || id === null) return '';
  return String(id);
}

/**
 * Alias para getCanonicalUserId.
 */
export function parseCanonicalUserId(id: any): string {
  return getCanonicalUserId(id);
}

/**
 * Roles canônicas do sistema (FENAPRF).
 */
export const ROLES = Canon.PERFIL_ACESSO;

export const CARGOS_CONSELHO = Canon.CARGOS_CONSELHO;
export const CARGOS_DIRETORIA = Canon.CARGOS_DIRETORIA;

export const UFS = Canon.UFS_DETALHADAS
  .map(u => u.sigla)
  .filter(s => s !== 'BR');

export const UF_NOME = Canon.UF_NOME;

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

/**
 * Normaliza o nome do cargo. Re-exportado de Canon.
 */
export const normalizeCargo = Canon.normalizeCargo;

/**
 * Retorna o título formatado do cargo e UF do membro. Re-exportado de Canon.
 */
export const tituloCargoUf = Canon.tituloCargoUf;

/**
 * Retorna a URL da bandeira da UF via IBGE.
 * Se for DIRETORIA ou COLABORADOR, a UF é BR.
 */
export function getBandeiraUF(ufSigla?: string | null, perfil?: string | null): string {
  const p = (perfil || "").toUpperCase();
  let uf = (ufSigla || "").trim().toLowerCase();

  if (p === ROLES.DIRETORIA || p === ROLES.COLABORADOR) {
    uf = "br";
  }

  if (!uf) return "";
  if (uf === "br") return "https://atlasescolar.ibge.gov.br/images/bandeiras/brasil.png";
  if (uf.length !== 2) return "";

  return `https://atlasescolar.ibge.gov.br/images/bandeiras/ufs/${uf}.png`;
}

/**
 * Ordenação completa da lista de membros. Re-exportado de Canon.
 */
export const ordenarMembrosTodos = Canon.ordenarMembrosTodos;
