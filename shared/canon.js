/**
 * SINPRF-ES - Definições Canônicas do Domínio
 * Centraliza constantes e funções de normalização para evitar divergências entre
 * Backend, Web Frontend e Mobile.
 *
 * Padrão UMD (Universal Module Definition) para compatibilidade total.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Canon = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 1. Situação Funcional (Domínio de Negócio)
  const SITUACAO_FUNCIONAL = {
    ATIVO: 'ATIVO',
    VETERANO: 'VETERANO',
    PENSIONISTA: 'PENSIONISTA'
  };

  // 2. Estado do Cadastro (Gestão do Sistema)
  const ESTADO_CADASTRO = {
    CADASTRO_ATIVO: 'CADASTRO_ATIVO',
    ARQUIVADO: 'ARQUIVADO'
  };

  // 3. Perfis de Acesso
  const PERFIL_ACESSO = {
    ADMIN: 'ADMIN',
    DIRETORIA: 'DIRETORIA',
    FUNCIONARIO: 'FUNCIONARIO',
    FILIADO: 'FILIADO',
    ORGANIZADOR: 'ORGANIZADOR',
    COMUNICADOR: 'COMUNICADOR'
  };

  // 4. Lotações Padronizadas
  const LOTACOES_REPASSE = [
    "SEDE",
    "DEL 01 - Viana",
    "DEL 02 - Serra",
    "DEL 03 - Guarapari",
    "DEL 04 - Linhares"
  ];

  const LOTACOES = [
    ...LOTACOES_REPASSE,
    "NENHUMA"
  ];

  // Mapeamento para labels de exibição (opcional, mas útil para UI)
  const LABELS = {
    [SITUACAO_FUNCIONAL.ATIVO]: 'Ativo',
    [SITUACAO_FUNCIONAL.VETERANO]: 'Veterano',
    [SITUACAO_FUNCIONAL.PENSIONISTA]: 'Pensionista',
    [ESTADO_CADASTRO.CADASTRO_ATIVO]: 'Ativo',
    [ESTADO_CADASTRO.ARQUIVADO]: 'Arquivado'
  };

  /**
   * Remove acentos e caracteres especiais para comparação robusta.
   */
  function slugify(str) {
    if (typeof str !== 'string') return '';
    return str.trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /**
   * Normaliza a Situação Funcional.
   * Mapeia variações como 'ATIVOS', 'APOSENTADO' para os valores canônicos.
   */
  function normalizeSituacaoFuncional(val) {
    const s = slugify(val);
    if (!s) return SITUACAO_FUNCIONAL.ATIVO; // Default seguro

    if (s === 'ATIVO' || s === 'ATIVOS') return SITUACAO_FUNCIONAL.ATIVO;
    if (s === 'VETERANO' || s === 'VETERANOS' || s === 'APOSENTADO' || s === 'APOSENTADOS') return SITUACAO_FUNCIONAL.VETERANO;
    if (s === 'PENSIONISTA' || s === 'PENSIONISTAS') return SITUACAO_FUNCIONAL.PENSIONISTA;

    return SITUACAO_FUNCIONAL.ATIVO;
  }

  /**
   * Normaliza o Perfil de Acesso.
   */
  function normalizePerfil(val) {
    const s = slugify(val);
    if (PERFIL_ACESSO[s]) return PERFIL_ACESSO[s];
    return PERFIL_ACESSO.FILIADO; // Default seguro
  }

  /**
   * Normaliza o Estado do Cadastro.
   */
  function normalizeEstadoCadastro(val) {
    const s = slugify(val);
    if (s === 'CADASTRO_ATIVO' || s === 'ATIVO') return ESTADO_CADASTRO.CADASTRO_ATIVO;
    if (s === 'ARQUIVADO' || s === 'ARQUIVADOS') return ESTADO_CADASTRO.ARQUIVADO;
    return ESTADO_CADASTRO.CADASTRO_ATIVO;
  }

  /**
   * Normaliza a Lotação.
   * Tenta encontrar a correspondência exata ou via keyword.
   */
  function normalizeLotacao(val) {
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

    return 'SEDE'; // Fallback seguro para garantir compatibilidade com CHECK CONSTRAINT
  }

  return {
    SITUACAO_FUNCIONAL,
    ESTADO_CADASTRO,
    PERFIL_ACESSO,
    LOTACOES_REPASSE,
    LOTACOES,
    LABELS,
    normalizeSituacaoFuncional,
    normalizePerfil,
    normalizeEstadoCadastro,
    normalizeLotacao,
    normalizeNome,
    slugify
  };

  /**
   * Normaliza nomes para Title Case por palavra, preservando hífens e apóstrofos.
   * Regra: JOÃO DA SILVA -> João Da Silva; joÃO -> João
   * @param {string} input - Nome a ser normalizado.
   * @returns {string|null} - Nome normalizado ou null.
   */
  function normalizeNome(input) {
    if (!input || typeof input !== 'string') return input || null;

    // 1) trim + colapsa espaços múltiplos + tudo minúsculo (locale pt-BR)
    const s = input
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("pt-BR");

    // 2) Title Case por "palavra", preservando separadores: espaço, hífen e apóstrofo
    // Regex: início da string OU separador, seguido de um caractere alfabético
    return s.replace(/(^|[ \-'])[a-zà-ÿ]/g, (m) => m.toLocaleUpperCase("pt-BR"));
  }
}));
