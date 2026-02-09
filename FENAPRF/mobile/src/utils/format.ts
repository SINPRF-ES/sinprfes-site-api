/**
 * FENAPRF - Utilitários de Formatação e Máscaras
 */

/**
 * Filtra apenas dígitos de uma string.
 */
export const onlyDigits = (text: string | null | undefined): string => {
  if (!text) return '';
  return String(text).replace(/\D/g, '');
};

/**
 * Remove formatação (dígitos apenas). Alias para onlyDigits.
 */
export const unmask = onlyDigits;

/**
 * Remove acentos e caracteres especiais, converte para minúsculas.
 */
export const normalizeText = (text: string | null | undefined): string => {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

/**
 * Remove acentos e caracteres especiais para comparação robusta (Upper Case).
 */
export function slugify(str: string | null | undefined): string {
  if (!str) return '';
  return str.trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Formata CPF (000.000.000-00).
 */
export const formatCpf = (cpf: string | null | undefined): string => {
  try {
    if (!cpf) return '';
    const digits = onlyDigits(cpf).slice(0, 11);
    if (!digits) return '';

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  } catch (e) {
    return '—';
  }
};

/**
 * Alias para formatCpf.
 */
export const maskCPF = formatCpf;

/**
 * Formata CEP (00000-000).
 */
export const formatCep = (cep: string | null | undefined): string => {
  const digits = onlyDigits(cep).slice(0, 8);
  if (!digits) return '';
  if (digits.length < 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

/**
 * Alias para formatCep.
 */
export const maskCEP = formatCep;

/**
 * Formata Telefone ((00) 00000-0000 ou (00) 0000-0000).
 */
export const formatTelefone = (tel: string | null | undefined): string => {
  if (!tel) return '';
  const digits = onlyDigits(tel).slice(0, 11);
  const len = digits.length;
  if (len === 0) return '';

  if (len === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (len === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (len > 2) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return digits;
};

/**
 * Alias para formatTelefone.
 */
export const maskPhone = formatTelefone;

/**
 * Formata Data para exibição durante digitação (DD/MM/YYYY).
 */
export const formatData = (data: string | null | undefined): string => {
  if (!data) return '';
  const digits = onlyDigits(data).slice(0, 8);
  const len = digits.length;
  if (len === 0) return '';

  if (len <= 2) return digits;
  if (len <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

/**
 * Formata Agência Bancária (0000-0).
 */
export const formatAgencia = (agencia: string | null | undefined): string => {
  const digits = onlyDigits(agencia);
  if (!digits) return '';
  const limited = digits.slice(0, 5);
  if (limited.length < 5) return limited;
  return `${limited.slice(0, 4)}-${limited.slice(4)}`;
};

/**
 * Formata Conta Bancária (00000000-0).
 */
export const formatConta = (conta: string | null | undefined): string => {
  const digits = onlyDigits(conta);
  if (!digits) return '';
  const limited = digits.slice(0, 10);
  if (limited.length < 2) return limited;
  return `${limited.slice(0, -1)}-${limited.slice(-1)}`;
};

/**
 * Normaliza nomes para Title Case por palavra, preservando hífens e apóstrofos.
 */
export function normalizeNome(input?: string | null): string | null {
  if (!input) return null;

  const s = input
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");

  return s.replace(/(^|[ \-'])[a-zà-ÿ]/g, (m) => m.toLocaleUpperCase("pt-BR"));
}

/**
 * Retorna label amigável para status de assembleia.
 */
export const getAssembleiaStatusLabel = (status: string): string => {
  switch (status) {
    case 'CRIADA':
      return 'AGENDADA';
    case 'ABERTA':
      return 'ABERTA';
    case 'EM_CURSO':
      return 'EM ANDAMENTO';
    case 'ENCERRADA':
      return 'ENCERRADA';
    default:
      return status || 'STATUS DESCONHECIDO';
  }
};

/**
 * Retorna emoji para status de assembleia.
 */
export const getAssembleiaStatusEmoji = (status: string): string => {
  switch (status) {
    case 'ABERTA':
      return '🟢 ';
    case 'EM_CURSO':
      return '🟡 ';
    case 'ENCERRADA':
      return '🔴 ';
    case 'CRIADA':
      return '🔵 ';
    default:
      return '⚪ ';
  }
};
