/**
 * FENAPRF - Utilitários de Usuário e Domínio
 */

export { slugify, normalizeNome } from './format';
import { slugify } from './format';

export const SEXO = {
  M: 'M',
  F: 'F'
} as const;

export type Sexo = typeof SEXO[keyof typeof SEXO];

/**
 * Estado do Cadastro (Gestão do Sistema)
 */
export const ESTADO_CADASTRO = {
  CADASTRO_ATIVO: 'CADASTRO_ATIVO',
  ARQUIVADO: 'ARQUIVADO'
} as const;

export type EstadoCadastro = typeof ESTADO_CADASTRO[keyof typeof ESTADO_CADASTRO];

/**
 * Perfis de Acesso (FENAPRF)
 */
export const PERFIL_ACESSO = {
  ADMIN: 'ADMIN',
  DIRETORIA: 'DIRETORIA',
  COLABORADOR: 'COLABORADOR',
  CONSELHEIRO: 'CONSELHEIRO'
} as const;

export type PerfilAcesso = typeof PERFIL_ACESSO[keyof typeof PERFIL_ACESSO];

/**
 * Alias para PERFIL_ACESSO.
 */
export const ROLES = PERFIL_ACESSO;

/**
 * Mapeamento para labels de exibição.
 */
export const LABELS: Record<string, string> = {
  [ESTADO_CADASTRO.CADASTRO_ATIVO]: 'Ativo',
  [ESTADO_CADASTRO.ARQUIVADO]: 'Arquivado',
  [SEXO.M]: '♂️ Masculino',
  [SEXO.F]: '♀️ Feminino'
};

/**
 * UFs Detalhadas
 */
export const UFS_DETALHADAS = [
  { sigla: "BR", nome: "Brasil"},
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

export const UF_NOME: Record<string, string> = Object.fromEntries(
  UFS_DETALHADAS.map((u) => [u.sigla, u.nome])
);

export const UFS = UFS_DETALHADAS
  .map(u => u.sigla)
  .filter(s => s !== 'BR');

/**
 * Cargos
 */
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
  "Diretor de Relações de Trabalho e Formação Sindical",
  "Diretor de Relações de Trabalho e Formação Sindical Substituto",
  "Diretor Jurídico",
  "Diretor Jurídico Substituto",
  "Diretor de Assuntos Institucionais",
  "Diretor de Assuntos Institucionais Substituto",
  "Diretor de Comunicação e Divulgação",
  "Diretor de Comunicação e Divulgação Substituto",
  "Diretor de Direitos Humanos e Políticas Sociais",
  "Diretor de Direitos Humanos e Políticas Sociais Substituto",
];

/**
 * Filtros da página Membros
 */
export const FILTROS_MEMBROS = [
  { value: "PADRAO", label: "Exibição padrão (Diretoria + Conselheiros por UF)" },
  { value: "DIRETORIA", label: "Apenas Diretoria" },
  { value: "PRESIDENTES", label: "Apenas Presidentes" },
  { value: "VICES", label: "Apenas Vices" },
  { value: "DR", label: "Delegados Representantes (DR)" },
  { value: "DS", label: "Delegados Substitutos (DS)" },
  { value: "UF", label: "Filtrar por UF" },
  { value: "ADMIN_COLAB", label: "Admin/Colaborador" },
];

/**
 * Canoniza o ID do user para UUID string.
 */
export function getCanonicalUserId(obj: any): string {
  if (!obj) return '';
  const id = typeof obj === 'object' ? obj.id : obj;
  if (id === undefined || id === null) return '';
  return String(id);
}

export function parseCanonicalUserId(id: any): string {
  return getCanonicalUserId(id);
}

/**
 * Normaliza o Sexo.
 */
export function normalizeSexo(val: string | null | undefined): Sexo | null {
  if (!val) return null;
  const s = slugify(val);
  if (s === 'M' || s === 'MASCULINO') return SEXO.M;
  if (s === 'F' || s === 'FEMININO') return SEXO.F;
  return null;
}

/**
 * Normaliza o Perfil de Acesso.
 */
export function normalizePerfil(val: string | null | undefined): PerfilAcesso | null {
  if (!val) return null;
  const s = slugify(val) as any;
  if (Object.values(PERFIL_ACESSO).includes(s)) return s;

  return null;
}

/**
 * Normaliza o Estado do Cadastro.
 */
export function normalizeEstadoCadastro(val: string | null | undefined): EstadoCadastro {
  const s = slugify(val);
  if (s === 'CADASTRO_ATIVO' || s === 'ATIVO') return ESTADO_CADASTRO.CADASTRO_ATIVO;
  if (s === 'ARQUIVADO' || s === 'ARQUIVADOS') return ESTADO_CADASTRO.ARQUIVADO;
  return ESTADO_CADASTRO.CADASTRO_ATIVO;
}

/**
 * Normaliza o nome do cargo.
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
 * Verifica se o perfil tem acesso de gestão (administrativo geral).
 */
export const isGestao = (perfil?: string | null) => {
  if (!perfil) return false;
  const p = perfil.toUpperCase();
  return [ROLES.ADMIN, ROLES.DIRETORIA, ROLES.COLABORADOR].includes(p);
};

/**
 * Verifica se o perfil tem acesso de diretoria.
 */
export const isDiretoria = (perfil?: string | null) => {
  if (!perfil) return false;
  const p = perfil.toUpperCase();
  return [ROLES.ADMIN, ROLES.DIRETORIA].includes(p);
};

/**
 * CANON: Verifica se o usuário pode gerenciar admins.
 */
export const canManageAdmins = (perfil?: string | null) => {
    return (perfil || "").toUpperCase() === ROLES.ADMIN;
};

/**
 * CANON: Verifica se o usuário pode indicar membros para a Mesa Diretora.
 */
export const canComposeMesa = (user: any) => {
    if (!user) return false;
    if (user.perfil_acesso === ROLES.ADMIN) return true;
    const cargosAutorizados = ["Presidente da FENAPRF", "Vice-Presidente da FENAPRF"];
    return cargosAutorizados.includes(user.cargo || "") || cargosAutorizados.includes(user.cargo2 || "");
};

/**
 * CANON: Verifica se o usuário pode gerar Token de Credenciamento Global.
 */
export const canCreateCredenciamentoToken = (user: any) => {
    if (!user) return false;
    const cargosAutorizados = [
        "Presidente da FENAPRF",
        "Vice-Presidente da FENAPRF",
        "Diretor de Secretaria",
        "Diretor de Secretaria Substituto"
    ];
    return cargosAutorizados.includes(user.cargo || "") || cargosAutorizados.includes(user.cargo2 || "");
};

/**
 * CANON: Verifica se o perfil pode se inscrever em eventos.
 */
export const canRegisterForEvent = (perfil?: string | null) => {
    const p = (perfil || "").toUpperCase();
    return p === ROLES.DIRETORIA || p === ROLES.CONSELHEIRO;
};

/**
 * CANON: Verifica se o perfil pode fazer check-in/votar.
 */
export const canCheckInEvent = (perfil?: string | null) => {
    const p = (perfil || "").toUpperCase();
    return p === ROLES.DIRETORIA || p === ROLES.CONSELHEIRO;
};

/**
 * Retorna o título formatado do cargo e UF do membro.
 */
export function tituloCargoUf(m: { perfil_acesso?: string | null, cargo?: string | null, uf?: string | null }): string {
  const perfil = (m.perfil_acesso || "").toUpperCase();
  const c = normalizeCargo(m.cargo);
  const ufSigla = (m.uf || "").toUpperCase();
  const ufNome = UF_NOME[ufSigla] || ufSigla || "—";

  if (perfil === PERFIL_ACESSO.CONSELHEIRO) {
    return c
      ? `${c} do Sindicato de ${ufNome}`
      : `Conselheiro do Sindicato de ${ufNome}`;
  }
  if (perfil === PERFIL_ACESSO.DIRETORIA) return c || "Diretoria";
  if (perfil === PERFIL_ACESSO.COLABORADOR) return "Colaborador";
  if (perfil === PERFIL_ACESSO.ADMIN) return c || "Administrador";
  return c || "Membro";
}

/**
 * Ordenação da lista de membros (Regra FENAPRF).
 */
export function cargoRankDiretoria(cargo?: string | null): number {
  const c = normalizeCargo(cargo);
  const idx = CARGOS_DIRETORIA.findIndex((x) => x.toLowerCase() === String(c || "").toLowerCase());
  return idx === -1 ? 999 : idx;
}

export function cargoRankConselho(cargo?: string | null): number {
  const c = normalizeCargo(cargo);
  const idx = CARGOS_CONSELHO.findIndex((x) => x.toLowerCase() === String(c || "").toLowerCase());
  return idx === -1 ? 999 : idx;
}

function byName(a: any, b: any): number {
  const nameA = a?.name || a?.nome || "";
  const nameB = b?.name || b?.nome || "";
  return String(nameA).localeCompare(String(nameB), "pt-BR", { sensitivity: "base" });
}

export function ordenarMembrosTodos(membros: any[]): any[] {
  if (!Array.isArray(membros)) return [];
  const list = membros.filter(m => !!m);

  const diretoria = list
    .filter((m) => String(m?.perfil_acesso || "").toUpperCase() === PERFIL_ACESSO.DIRETORIA)
    .sort((a, b) => {
      const ra = cargoRankDiretoria(a?.cargo);
      const rb = cargoRankDiretoria(b?.cargo);
      if (ra !== rb) return ra - rb;
      return byName(a, b);
    });

  const conselheiros = list
    .filter((m) => String(m?.perfil_acesso || "").toUpperCase() === PERFIL_ACESSO.CONSELHEIRO)
    .sort((a, b) => {
      const ufa = String(a?.uf || "").toUpperCase();
      const ufb = String(b?.uf || "").toUpperCase();
      if (ufa !== ufb) return ufa.localeCompare(ufb, "pt-BR");
      const ra = cargoRankConselho(a?.cargo);
      const rb = cargoRankConselho(b?.cargo);
      if (ra !== rb) return ra - rb;
      return byName(a, b);
    });

  const adminColab = list
    .filter((m) => ["ADMIN", "COLABORADOR"].includes(String(m?.perfil_acesso || "").toUpperCase()))
    .sort(byName);

  const outros = list
    .filter(
      (m) =>
        ![PERFIL_ACESSO.DIRETORIA, PERFIL_ACESSO.CONSELHEIRO, PERFIL_ACESSO.ADMIN, PERFIL_ACESSO.COLABORADOR].includes(
          String(m?.perfil_acesso || "").toUpperCase()
        )
    )
    .sort(byName);

  return [...diretoria, ...conselheiros, ...adminColab, ...outros];
}

/**
 * Retorna a URL da bandeira da UF via IBGE ou FlagCDN.
 */
export function getBandeiraUF(ufSigla?: string | null, perfil?: string | null): string {
  const p = (perfil || "").toUpperCase();
  let uf = (ufSigla || "").trim().toLowerCase();

  // Perfis nacionais usam a bandeira do Brasil
  if (p === PERFIL_ACESSO.DIRETORIA || p === PERFIL_ACESSO.COLABORADOR || p === PERFIL_ACESSO.ADMIN) {
    uf = "br";
  }

  if (!uf) return "";

  if (uf === "br") return "https://flagcdn.com/w160/br.png";
  if (uf.length !== 2) return "";

  return `https://atlasescolar.ibge.gov.br/images/bandeiras/ufs/${uf}.png`;
}

/**
 * Log de depuração apenas em ambiente de desenvolvimento.
 */
export const logDebug = (tag: string, data: any) => {
  if (__DEV__) {
    console.log(`[DEBUG][${tag}]`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  }
};
