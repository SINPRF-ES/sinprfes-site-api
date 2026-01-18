/**
 * Regras canônicas para o campo "parentesco" dos dependentes.
 * Utilizado para manter consistência entre Mobile, Site e Backend.
 */

const PARENTESCO_OPTIONS = [
  { code: 'FILHO_ENTEADO', label: 'Filha(o) / enteada(o)' },
  { code: 'CONJUGE_COMPANHEIRO', label: 'Cônjuge / companheira(o)' },
  { code: 'PAI_MAE', label: 'Pai / mãe' },
  { code: 'IRMAO', label: 'Irmã(o)' },
  { code: 'OUTRO', label: 'Outro' },
];

/**
 * Normaliza um input (code ou label) para um code canônico.
 */
function normalizeParentesco(input) {
  if (!input) return 'OUTRO';

  const normalizedInput = input.trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos

  // Se já for um code válido
  if (PARENTESCO_OPTIONS.some(opt => opt.code === normalizedInput)) {
    return normalizedInput;
  }

  // Mapeamento de labels conhecidos (e variações) para codes
  if (normalizedInput.includes('FILHA') || normalizedInput.includes('FILHO') || normalizedInput.includes('ENTEAD')) return 'FILHO_ENTEADO';
  if (normalizedInput.includes('CONJUGE') || normalizedInput.includes('COMPANHEIR')) return 'CONJUGE_COMPANHEIRO';
  if (normalizedInput.includes('PAI') || normalizedInput.includes('MAE')) return 'PAI_MAE';
  if (normalizedInput.includes('IRMA')) return 'IRMAO';

  return 'OUTRO';
}

/**
 * Retorna o label a partir de um code.
 */
function labelFromParentesco(code) {
  const opt = PARENTESCO_OPTIONS.find(o => o.code === code);
  return opt ? opt.label : 'Outro';
}

function isValidParentesco(code) {
  return PARENTESCO_OPTIONS.some(o => o.code === code);
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
  // No browser, expõe como global se necessário, mas aqui apenas definimos
  window.ParentescoUtils = {
    PARENTESCO_OPTIONS,
    normalizeParentesco,
    labelFromParentesco,
    isValidParentesco
  };
}
