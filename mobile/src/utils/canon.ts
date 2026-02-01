/**
 * SINPRF-ES - Definições Canônicas do Domínio (Mobile)
 * Centraliza constantes e funções de normalização.
 */

// 1. Situação Funcional (Domínio de Negócio)
export const SITUACAO_FUNCIONAL = {
  ATIVO: 'ATIVO',
  VETERANO: 'VETERANO',
  PENSIONISTA: 'PENSIONISTA'
} as const;

export type SituacaoFuncional = typeof SITUACAO_FUNCIONAL[keyof typeof SITUACAO_FUNCIONAL];

// 2. Estado do Cadastro (Gestão do Sistema)
export const ESTADO_CADASTRO = {
  CADASTRO_ATIVO: 'CADASTRO_ATIVO',
  ARQUIVADO: 'ARQUIVADO'
} as const;

export type EstadoCadastro = typeof ESTADO_CADASTRO[keyof typeof ESTADO_CADASTRO];

// 3. Perfis de Acesso
export const PERFIL_ACESSO = {
  ADMIN: 'ADMIN',
  DIRETORIA: 'DIRETORIA',
  FUNCIONARIO: 'FUNCIONARIO',
  FILIADO: 'FILIADO',
  ORGANIZADOR: 'ORGANIZADOR',
  COMUNICADOR: 'COMUNICADOR'
} as const;

export type PerfilAcesso = typeof PERFIL_ACESSO[keyof typeof PERFIL_ACESSO];

// 4. Lotações Padronizadas
export const LOTACOES_REPASSE = [
  "SEDE",
  "DEL 01 - Viana",
  "DEL 02 - Serra",
  "DEL 03 - Guarapari",
  "DEL 04 - Linhares"
] as const;

export const LOTACOES = [
  ...LOTACOES_REPASSE,
  "NENHUMA"
] as const;

export type Lotacao = typeof LOTACOES[number];

// Mapeamento para labels de exibição
export const LABELS: Record<string, string> = {
  [SITUACAO_FUNCIONAL.ATIVO]: 'Ativo',
  [SITUACAO_FUNCIONAL.VETERANO]: 'Veterano',
  [SITUACAO_FUNCIONAL.PENSIONISTA]: 'Pensionista',
  [ESTADO_CADASTRO.CADASTRO_ATIVO]: 'Ativo',
  [ESTADO_CADASTRO.ARQUIVADO]: 'Arquivado'
};

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
  return PERFIL_ACESSO.FILIADO;
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
 * Normaliza a Lotação.
 */
export function normalizeLotacao(val: string | null | undefined): string {
  const s = slugify(val);
  if (!s || s === 'NENHUMA') return 'NENHUMA';

  for (const lot of LOTACOES) {
    if (slugify(lot) === s) return lot;
  }

  // Fallbacks por keyword
  if (s.includes('VIANA')) return "DEL 01 - Viana";
  if (s.includes('SERRA')) return "DEL 02 - Serra";
  if (s.includes('GUARAPARI')) return "DEL 03 - Guarapari";
  if (s.includes('LINHARES')) return "DEL 04 - Linhares";
  if (s.includes('SEDE')) return "SEDE";

  return 'SEDE'; // Fallback seguro
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
