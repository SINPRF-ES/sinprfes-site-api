/**
 * Regras canônicas para o campo "parentesco" dos dependentes.
 * Utilizado para manter consistência entre Mobile, Site e Backend.
 */

const PARENTESCO_OPTIONS = [
  { value: 'FILHO_ENTEADO', label: 'Filha(o) / Enteada(o)' },
  { value: 'CONJUGE_COMPANHEIRO', label: 'Cônjuge / Companheira(o)' },
  { value: 'PAI_MAE', label: 'Pai / Mãe' },
  { value: 'IRMAO', label: 'Irmã(o)' },
  { value: 'OUTRO', label: 'Outro' },
];

/**
 * Normaliza um input (value ou label) para um value canônico.
 */
function normalizeParentesco(input) {
  if (!input) return null;

  const normalizedInput = input.trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos

  // Se já for um value válido
  if (PARENTESCO_OPTIONS.some(opt => opt.value === normalizedInput)) {
    return normalizedInput;
  }

  // Mapeamento de labels conhecidos (e variações) para values
  if (normalizedInput.includes('FILHA') || normalizedInput.includes('FILHO') || normalizedInput.includes('ENTEAD')) return 'FILHO_ENTEADO';
  if (normalizedInput.includes('CONJUGE') || normalizedInput.includes('COMPANHEIR')) return 'CONJUGE_COMPANHEIRO';
  if (normalizedInput.includes('PAI') || normalizedInput.includes('MAE')) return 'PAI_MAE';
  if (normalizedInput.includes('IRMA')) return 'IRMAO';

  return 'OUTRO';
}

/**
 * Retorna o label a partir de um value.
 */
function labelFromParentesco(value) {
  const opt = PARENTESCO_OPTIONS.find(o => o.value === value);
  return opt ? opt.label : 'Outro';
}

function isValidParentesco(value) {
  return PARENTESCO_OPTIONS.some(o => o.value === value);
}

// Suporte para Node (CommonJS) e Browser (Global)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PARENTESCO_OPTIONS,
    normalizeParentesco,
    labelFromParentesco,
    isValidParentesco
  };
} else {
  window.ParentescoUtils = {
    PARENTESCO_OPTIONS,
    normalizeParentesco,
    labelFromParentesco,
    isValidParentesco
  };
}
