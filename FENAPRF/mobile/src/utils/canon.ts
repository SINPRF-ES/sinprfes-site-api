/**
 * FENAPRF - Definições Canônicas do Domínio (Mobile)
 * Centraliza constantes e funções de normalização.
 */

// 1. Situação Funcional (Domínio de Negócio)
export const SITUACAO_FUNCIONAL = {
  ATIVO: 'ATIVO',
  VETERANO: 'VETERANO',
  PENSIONISTA: 'PENSIONISTA'
} as const;

export type SituacaoFuncional = typeof SITUACAO_FUNCIONAL[keyof typeof SITUACAO_FUNCIONAL];

export const SEXO = {
  M: 'M',
  F: 'F'
} as const;

export type Sexo = typeof SEXO[keyof typeof SEXO];

// 2. Estado do Cadastro (Gestão do Sistema)
export const ESTADO_CADASTRO = {
  CADASTRO_ATIVO: 'CADASTRO_ATIVO',
  ARQUIVADO: 'ARQUIVADO'
} as const;

export type EstadoCadastro = typeof ESTADO_CADASTRO[keyof typeof ESTADO_CADASTRO];

// 3. Perfis de Acesso (FENAPRF)
export const PERFIL_ACESSO = {
  ADMIN: 'ADMIN',
  DIRETORIA: 'DIRETORIA',
  COLABORADOR: 'COLABORADOR',
  CONSELHEIRO: 'CONSELHEIRO'
} as const;

export type PerfilAcesso = typeof PERFIL_ACESSO[keyof typeof PERFIL_ACESSO];

export const UF_NOME: Record<string, string> = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
    'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
    'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
    'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
    'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
    'SE': 'Sergipe', 'TO': 'Tocantins', 'BR': 'Brasil'
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

// Mapeamento para labels de exibição
export const LABELS: Record<string, string> = {
  [SITUACAO_FUNCIONAL.ATIVO]: 'Ativo',
  [SITUACAO_FUNCIONAL.VETERANO]: 'Veterano',
  [SITUACAO_FUNCIONAL.PENSIONISTA]: 'Pensionista',
  [ESTADO_CADASTRO.CADASTRO_ATIVO]: 'Ativo',
  [ESTADO_CADASTRO.ARQUIVADO]: 'Arquivado',
  [SEXO.M]: '♂️ Masculino',
  [SEXO.F]: '♀️ Feminino'
};

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
 * Remove acentos e caracteres especiais para comparação robusta.
 */
export function slugify(str: string | null | undefined): string {
  if (!str) return '';
  return str.trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normaliza a Situação Funcional.
 */
export function normalizeSituacaoFuncional(val: string | null | undefined): SituacaoFuncional {
  const s = slugify(val);
  if (!s) return SITUACAO_FUNCIONAL.ATIVO;

  if (s === 'ATIVO' || s === 'ATIVOS') return SITUACAO_FUNCIONAL.ATIVO;
  if (s === 'VETERANO' || s === 'VETERANOS' || s === 'APOSENTADO' || s === 'APOSENTADOS') return SITUACAO_FUNCIONAL.VETERANO;
  if (s === 'PENSIONISTA' || s === 'PENSIONISTAS') return SITUACAO_FUNCIONAL.PENSIONISTA;

  return SITUACAO_FUNCIONAL.ATIVO;
}

/**
 * Normaliza o Perfil de Acesso.
 */
export function normalizePerfil(val: string | null | undefined): PerfilAcesso {
  const s = slugify(val) as any;
  if (Object.values(PERFIL_ACESSO).includes(s)) return s;
  return PERFIL_ACESSO.CONSELHEIRO;
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
 * Normaliza nomes para Title Case por palavra, preservando hífens e apóstrofos.
 * Regra: JOÃO DA SILVA -> João Da Silva; joÃO -> João
 */
export function normalizeNome(input?: string | null): string | null {
  if (!input) return null;

  // 1) trim + colapsa espaços múltiplos + tudo minúsculo (locale pt-BR)
  const s = input
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");

  // 2) Title Case por "palavra", preservando separadores: espaço, hífen e apóstrofo
  return s.replace(/(^|[ \-'])[a-zà-ÿ]/g, (m) => m.toLocaleUpperCase("pt-BR"));
}

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

export function tituloCargoUf({ perfil_acesso, cargo, uf }: { perfil_acesso?: string, cargo?: string, uf?: string }): string {
    const perfil = (perfil_acesso || "").toUpperCase();
    const c = normalizeCargo(cargo);
    const ufSigla = (uf || "").toUpperCase();
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
  return String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR", { sensitivity: "base" });
}

export function ordenarMembros(membros: any[]): any[] {
  const list = Array.isArray(membros) ? [...membros] : [];

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
    .filter((m) => [PERFIL_ACESSO.ADMIN, PERFIL_ACESSO.COLABORADOR].includes(String(m?.perfil_acesso || "").toUpperCase()))
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
