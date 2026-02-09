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

export const CARGO_RANK: Record<string, number> = {
  "Presidente da FENAPRF": 1,
  "Vice-Presidente da FENAPRF": 2,
  "Diretor de Secretaria": 3,
  "Diretor de Secretaria Substituto": 4,
  "Diretor de Finanças": 5,
  "Diretor de Finanças Substituto": 6,
  "Diretor de Relações de Trabalho e e Formação Sindical": 7,
  "Diretor de Relações de Trabalho e e Formação Sindical Substituto": 8,
  "Diretor Jurídico": 9,
  "Diretor Jurídico Substituto": 10,
  "Diretor de Assuntos Institucionais": 11,
  "Diretor de Assuntos Institucionais Substituto": 12,
  "Diretor de Comunicação e Divulgação": 13,
  "Diretor de Comunicação e Divulgação Substituto": 14,
  "Diretor de Direitos Humanos e Políticas Sociais": 15,
  "Diretor de Direitos Humanos e Políticas Sociais Substituto": 16,
  "Presidente": 17,
  "Vice-Presidente": 18,
  "Delegado Representante": 19,
  "Delegado Substituto": 20,
};

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export const UF_NOME: Record<string, string> = {
  "AC": "Acre",
  "AL": "Alagoas",
  "AP": "Amapá",
  "AM": "Amazonas",
  "BA": "Bahia",
  "CE": "Ceará",
  "DF": "Distrito Federal",
  "ES": "Espírito Santo",
  "GO": "Goiás",
  "MA": "Maranhão",
  "MT": "Mato Grosso",
  "MS": "Mato Grosso do Sul",
  "MG": "Minas Gerais",
  "PA": "Pará",
  "PB": "Paraíba",
  "PR": "Paraná",
  "PE": "Pernambuco",
  "PI": "Piauí",
  "RJ": "Rio de Janeiro",
  "RN": "Rio Grande do Norte",
  "RS": "Rio Grande do Sul",
  "RO": "Rondônia",
  "RR": "Roraima",
  "SC": "Santa Catarina",
  "SP": "São Paulo",
  "SE": "Sergipe",
  "TO": "Tocantins",
  "BR": "Brasil"
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

/**
 * Normaliza o nome do cargo.
 */
export function normalizeCargo(raw?: string | null) {
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
 * Retorna o título formatado do cargo e UF do membro.
 */
export function tituloCargoUf(m: { perfil_acesso?: string | null, cargo?: string | null, uf?: string | null }) {
  const perfil = (m.perfil_acesso || "").toUpperCase();
  const c = normalizeCargo(m.cargo);
  const ufSigla = (m.uf || "").toUpperCase();
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
 * Ordenação completa da lista de membros.
 * Diretoria no topo (por hierarquia), seguida por Conselheiros (por UF).
 */
export function ordenarMembrosTodos(membros: any[]) {
  if (!membros || !Array.isArray(membros)) return [];

  const list = [...membros];

  const diretoria = list
    .filter((m) => (m?.perfil_acesso || "").toUpperCase() === ROLES.DIRETORIA)
    .sort((a, b) => {
      const ra = CARGO_RANK[a?.cargo || ""] || 999;
      const rb = CARGO_RANK[b?.cargo || ""] || 999;
      if (ra !== rb) return ra - rb;
      return (a?.name || "").localeCompare(b?.name || "");
    });

  const conselheiros = list
    .filter((m) => (m?.perfil_acesso || "").toUpperCase() === ROLES.CONSELHEIRO)
    .sort((a, b) => {
      const ufa = (a?.uf || "ZZ").toUpperCase();
      const ufb = (b?.uf || "ZZ").toUpperCase();
      if (ufa !== ufb) return ufa.localeCompare(ufb);
      const ra = CARGO_RANK[a?.cargo || ""] || 999;
      const rb = CARGO_RANK[b?.cargo || ""] || 999;
      if (ra !== rb) return ra - rb;
      return (a?.name || "").localeCompare(b?.name || "");
    });

  const outros = list
    .filter(
      (m) =>
        ![ROLES.DIRETORIA, ROLES.CONSELHEIRO].includes((m?.perfil_acesso || "").toUpperCase())
    )
    .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));

  return [...diretoria, ...conselheiros, ...outros];
}
