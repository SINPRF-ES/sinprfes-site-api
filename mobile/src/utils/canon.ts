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

export const SITUACAO_SINDICAL = {
  FILIADO_SINPRF_ES: 'FILIADO_SINPRF_ES',
  FILIADO_OUTRO_SINDICATO: 'FILIADO_OUTRO_SINDICATO',
  NAO_FILIADO: 'NAO_FILIADO',
  DESCONHECIDO: 'DESCONHECIDO'
} as const;

export type SituacaoSindical = typeof SITUACAO_SINDICAL[keyof typeof SITUACAO_SINDICAL];

export const UFS_BRASILEIRAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
] as const;

export type UfBrasileira = typeof UFS_BRASILEIRAS[number];

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

// Whitelist de campos editáveis para o perfil /me
export const ME_EDITABLE_FIELDS_FILIADO = [
  'telefone1', 'telefone2', 'email1', 'email2', 'lotacao',
  'cep', 'logradouro_bairro', 'numero', 'complemento', 'cidade', 'uf'
];

for (let i = 1; i <= 5; i++) {
  ME_EDITABLE_FIELDS_FILIADO.push(
    `dep${i}_nome`,
    `dep${i}_cpf`,
    `dep${i}_data_nascimento`,
    `dep${i}_parentesco`,
    `dep${i}_parentesco_outro`
  );
}

export const ME_EDITABLE_FIELDS_GESTAO = [
  ...ME_EDITABLE_FIELDS_FILIADO,
  'nome', 'cpf', 'siape', 'sexo', 'data_nascimento', 'situacao',
  'situacao_sindical', 'uf_sindicato_externo'
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

export const SITUACAO_SINDICAL_LABELS: Record<string, string> = {
  [SITUACAO_SINDICAL.FILIADO_SINPRF_ES]: 'Filiado ao SINPRF/ES',
  [SITUACAO_SINDICAL.FILIADO_OUTRO_SINDICATO]: 'Filiado a outro sindicato',
  [SITUACAO_SINDICAL.NAO_FILIADO]: 'Não filiado',
  [SITUACAO_SINDICAL.DESCONHECIDO]: 'Desconhecido / pendente de validação',
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
export function normalizeSituacaoFuncional(val: string | null | undefined): SituacaoFuncional | null {
  const s = slugify(val);
  if (!s) return null;

  if (s === 'ATIVO' || s === 'ATIVOS') return SITUACAO_FUNCIONAL.ATIVO;
  if (s === 'VETERANO' || s === 'VETERANOS' || s === 'APOSENTADO' || s === 'APOSENTADOS') return SITUACAO_FUNCIONAL.VETERANO;
  if (s === 'PENSIONISTA' || s === 'PENSIONISTAS') return SITUACAO_FUNCIONAL.PENSIONISTA;

  return null;
}

/**
 * Normaliza o Perfil de Acesso.
 */
export function normalizePerfil(val: string | null | undefined): PerfilAcesso {
  const s = slugify(val) as any;
  if (Object.values(PERFIL_ACESSO).includes(s)) return s;
  return PERFIL_ACESSO.FILIADO;
}

export function isSituacaoSindicalValida(val: string | null | undefined): val is SituacaoSindical {
  if (!val) return false;
  return Object.values(SITUACAO_SINDICAL).includes(val as SituacaoSindical);
}

export function normalizeSituacaoSindical(
  val: string | null | undefined,
  fallback: SituacaoSindical = SITUACAO_SINDICAL.FILIADO_SINPRF_ES
): SituacaoSindical | null {
  const s = slugify(val);
  if (!s) return fallback;
  if (isSituacaoSindicalValida(s)) return s;

  if (['FILIADO_ES', 'FILIADO_SINPRF', 'FILIADO SINPRF ES', 'FILIADO SINPRF/ES', 'OES'].includes(s)) {
    return SITUACAO_SINDICAL.FILIADO_SINPRF_ES;
  }
  if (['OUTRO_SINDICATO', 'FILIADO_OUTRO', 'FILIADO OUTRO'].includes(s)) {
    return SITUACAO_SINDICAL.FILIADO_OUTRO_SINDICATO;
  }
  if (['NAO FILIADO', 'NÃO FILIADO'].includes(s)) {
    return SITUACAO_SINDICAL.NAO_FILIADO;
  }
  if (['PENDENTE'].includes(s)) {
    return SITUACAO_SINDICAL.DESCONHECIDO;
  }

  return null;
}

export function isUfBrasileiraValida(val: string | null | undefined): val is UfBrasileira {
  if (!val) return false;
  return UFS_BRASILEIRAS.includes(slugify(val) as UfBrasileira);
}

export function normalizeUfBrasileira(val: string | null | undefined): UfBrasileira | null {
  const s = slugify(val);
  if (!s) return null;
  return isUfBrasileiraValida(s) ? (s as UfBrasileira) : null;
}

/**
 * Valida se a UF é permitida para a situação sindical.
 * Centraliza a regra: FILIADO_OUTRO_SINDICATO permite qualquer UF brasileira EXCETO ES.
 * Para as demais situações, a UF deve ser nula.
 */
export function validarUfSindicatoExterno(
  ufRaw: string | null | undefined,
  situacaoSindical: string | null | undefined
): { ok: boolean; value?: string | null; message?: string } {
  const ss = normalizeSituacaoSindical(situacaoSindical, null);

  if (ss !== SITUACAO_SINDICAL.FILIADO_OUTRO_SINDICATO) {
    return { ok: true, value: null };
  }

  if (ufRaw === undefined) {
    return { ok: true, value: undefined };
  }

  if (ufRaw === null || String(ufRaw).trim() === "") {
    return { ok: true, value: null };
  }

  const ufNorm = normalizeUfBrasileira(ufRaw);
  if (!ufNorm) {
    return { ok: false, message: "UF do sindicato externo inválida." };
  }
  if (ufNorm === 'ES') {
    return { ok: false, message: "UF do sindicato externo não pode ser ES para FILIADO_OUTRO_SINDICATO." };
  }

  return { ok: true, value: ufNorm };
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

  return 'SEDE';
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

/**
 * Verifica se o perfil informado possui acesso de gestão.
 */
export function ehPerfilGestao(perfil: string | null | undefined): boolean {
  const p = normalizePerfil(perfil);
  return [PERFIL_ACESSO.ADMIN, PERFIL_ACESSO.DIRETORIA, PERFIL_ACESSO.FUNCIONARIO].includes(p);
}
