// mobile/src/utils/userUtils.ts
import { normalizeSituacaoFuncional } from './canon';

export { normalizeSituacaoFuncional };

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
};

export const CARGOS_CONSELHO = [
  "Presidente",
  "Vice-Presidente",
  "Delegado Representante",
  "Delegado Substituto",
];

export const CARGOS_DIRETORIA = [
  "Presidente da FENAPRF",
  "Vice-Presidente da FENAPRF",
  "Diretor de Secretaria",
  "Diretor de Secretaria Substituto",
  "Diretor de Finanças",
  "Diretor de Finanças Substituto",
  "Diretor de Relações de Trabalho e e Formação Sindical",
  "Diretor de Relações de Trabalho e e Formação Sindical Substituto",
  "Diretor Jurídico",
  "Diretor Jurídico Substituto",
  "Diretor de Assuntos Institucionais",
  "Diretor de Assuntos Institucionais Substituto",
  "Diretor de Comunicação e Divulgação",
  "Diretor de Comunicação e Divulgação Substituto",
  "Diretor de Direitos Humanos e Políticas Sociais",
  "Diretor de Direitos Humanos e Políticas Sociais Substituto",
];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export const UF_NOME: Record<string, string> = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
    'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
    'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
    'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
    'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
    'SE': 'Sergipe', 'TO': 'Tocantins', 'BR': 'Brasil'
};

const ROLE_RANK: Record<string, number> = {
  [ROLES.ADMIN]: 100,
  [ROLES.DIRETORIA]: 80,
  [ROLES.COLABORADOR]: 60,
  [ROLES.CONSELHEIRO]: 40,
};

/**
 * Normaliza o cargo para exibição.
 */
export function normalizeCargo(raw?: string | null): string {
  const s = (raw || "").toString().trim();
  if (!s) return "";
  const lower = s.toLowerCase();

  const map = new Map([
    ["presidente", "Presidente"],
    ["vice-presidente", "Vice-Presidente"],
    ["delegado representante", "Delegado Representante"],
    ["delegado substituto", "Delegado Substituto"],
  ]);

  return map.get(lower) || s;
}

/**
 * Retorna o título formatado do cargo com a UF.
 */
export function tituloCargoUf({ perfil_acesso, cargo, uf }: { perfil_acesso?: string, cargo?: string, uf?: string }): string {
    const perfil = (perfil_acesso || "").toUpperCase();
    const c = normalizeCargo(cargo);
    const ufSigla = (uf || "").toUpperCase();
    const ufNome = UF_NOME[ufSigla] || ufSigla || "—";

    if (perfil === ROLES.CONSELHEIRO) {
      return c
        ? `${c} do Sindicato de ${ufNome}`
        : `Conselheiro do Sindicato de ${ufNome}`;
    }
    if (perfil === ROLES.DIRETORIA) return c || "Diretoria";
    if (perfil === ROLES.COLABORADOR) return "Colaborador";
    if (perfil === ROLES.ADMIN) return c || "Administrador";
    return c || "Membro";
}

/**
 * Verifica se o perfil tem acesso de gestão (administrativo geral).
 */
export const isGestao = (perfil?: string | null) => {
  if (!perfil) return false;
  const p = perfil.toUpperCase();
  return [ROLES.ADMIN, ROLES.DIRETORIA, ROLES.COLABORADOR].includes(p);
};

/**
 * Verifica se o ator pode editar o alvo com base na hierarquia.
 */
export const podeEditarPerfil = (perfilAtor?: string | null, perfilAlvo?: string | null) => {
  if (!perfilAtor) return false;
  const pAtor = perfilAtor.toUpperCase();
  const pAlvo = (perfilAlvo || 'CONSELHEIRO').toUpperCase();

  const ehAdminAtor = pAtor === ROLES.ADMIN;
  if (ehAdminAtor) return true; // Admin edita tudo

  if (!isGestao(pAtor)) return false; // Não gestão não edita ninguém (exceto a si mesmo, tratado na Screen)

  // Gestão edita entre si e abaixo
  const rankAtor = ROLE_RANK[pAtor] || 0;
  const rankAlvo = ROLE_RANK[pAlvo] || 0;
  return rankAtor >= rankAlvo;
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
 * Retorna a URL da bandeira da UF via IBGE.
 * Se for DIRETORIA ou COLABORADOR, a UF é BR.
 */
export function getBandeiraUF(ufSigla?: string | null, perfil?: string | null): string {
  const p = (perfil || "").toUpperCase();
  let uf = (ufSigla || "").trim().toLowerCase();

  if (p === ROLES.DIRETORIA || p === ROLES.COLABORADOR || p === ROLES.ADMIN) {
    uf = "br";
  }

  if (!uf) uf = "br";
  if (uf === "br") return "https://atlasescolar.ibge.gov.br/images/bandeiras/brasil.png";
  if (uf.length !== 2) return "";

  return `https://atlasescolar.ibge.gov.br/images/bandeiras/ufs/${uf}.png`;
}
