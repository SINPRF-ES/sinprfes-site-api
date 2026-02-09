/**
 * FENAPRF - Definições Canônicas do Domínio
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

  const SEXO = {
    M: 'M',
    F: 'F'
  };

  // 2. Estado do Cadastro (Gestão do Sistema)
  const ESTADO_CADASTRO = {
    CADASTRO_ATIVO: 'CADASTRO_ATIVO',
    ARQUIVADO: 'ARQUIVADO'
  };

  // 3. Perfis de Acesso (FENAPRF)
  const PERFIL_ACESSO = {
    ADMIN: 'ADMIN',
    DIRETORIA: 'DIRETORIA',
    COLABORADOR: 'COLABORADOR',
    CONSELHEIRO: 'CONSELHEIRO'
  };

  const UFS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  // Mapeamento para labels de exibição (opcional, mas útil para UI)
  const LABELS = {
    [ESTADO_CADASTRO.CADASTRO_ATIVO]: 'Ativo',
    [ESTADO_CADASTRO.ARQUIVADO]: 'Arquivado',
    [SEXO.M]: '♂️ Masculino',
    [SEXO.F]: '♀️ Feminino'
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
   * Normaliza o Sexo.
   */
  function normalizeSexo(val) {
    if (!val) return null;
    const s = slugify(val);
    if (s === 'M' || s === 'MASCULINO') return SEXO.M;
    if (s === 'F' || s === 'FEMININO') return SEXO.F;
    return null;
  }

  /**
   * Normaliza o Perfil de Acesso.
   */
  function normalizePerfil(val) {
    const s = slugify(val);
    if (PERFIL_ACESSO[s]) return PERFIL_ACESSO[s];

    // Mapeamentos de retrocompatibilidade
    if (s === 'FUNCIONARIO' || s === 'ORGANIZADOR' || s === 'COMUNICADOR') return PERFIL_ACESSO.COLABORADOR;
    if (s === 'USER') return PERFIL_ACESSO.CONSELHEIRO;

    return PERFIL_ACESSO.CONSELHEIRO; // Default seguro
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

  return {
    SEXO,
    ESTADO_CADASTRO,
    PERFIL_ACESSO,
    UFS,
    LABELS,
    normalizeSexo,
    normalizePerfil,
    normalizeEstadoCadastro,
    normalizeNome,
    slugify
  };
}));
