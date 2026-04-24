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

  const SEXO = {
    M: 'M',
    F: 'F'
  };

  // 2. Estado do Cadastro (Gestão do Sistema)
  const ESTADO_CADASTRO = {
    CADASTRO_ATIVO: 'CADASTRO_ATIVO',
    ARQUIVADO: 'ARQUIVADO'
  };

  // 2.1 Situação Sindical (Dimensão Cadastral)
  const SITUACAO_SINDICAL = {
    FILIADO_SINPRF_ES: 'FILIADO_SINPRF_ES',
    FILIADO_OUTRO_SINDICATO: 'FILIADO_OUTRO_SINDICATO',
    NAO_FILIADO: 'NAO_FILIADO',
    DESCONHECIDO: 'DESCONHECIDO'
  };

  const UFS_BRASILEIRAS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO'
  ];

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

  // Whitelist de campos editáveis para o perfil /me (Task A1/B1)
  const ME_EDITABLE_FIELDS_FILIADO = [
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

  const ME_EDITABLE_FIELDS_GESTAO = [
    ...ME_EDITABLE_FIELDS_FILIADO,
    'nome', 'cpf', 'siape', 'sexo', 'data_nascimento', 'situacao',
    'situacao_sindical', 'uf_sindicato_externo'
  ];

  // Mapeamento para labels de exibição (opcional, mas útil para UI)
  const LABELS = {
    [SITUACAO_FUNCIONAL.ATIVO]: 'Ativo',
    [SITUACAO_FUNCIONAL.VETERANO]: 'Veterano',
    [SITUACAO_FUNCIONAL.PENSIONISTA]: 'Pensionista',
    [ESTADO_CADASTRO.CADASTRO_ATIVO]: 'Ativo',
    [ESTADO_CADASTRO.ARQUIVADO]: 'Arquivado',
    [SEXO.M]: '♂️ Masculino',
    [SEXO.F]: '♀️ Feminino'
  };

  const SITUACAO_SINDICAL_LABELS = {
    [SITUACAO_SINDICAL.FILIADO_SINPRF_ES]: 'Filiado ao SINPRF/ES',
    [SITUACAO_SINDICAL.FILIADO_OUTRO_SINDICATO]: 'Filiado a outro sindicato',
    [SITUACAO_SINDICAL.NAO_FILIADO]: 'Não filiado',
    [SITUACAO_SINDICAL.DESCONHECIDO]: 'Desconhecido / pendente de validação'
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
   * Normaliza a Situação Funcional.
   * Mapeia variações como 'ATIVOS', 'APOSENTADO' para os valores canônicos.
   */
  function normalizeSituacaoFuncional(val) {
    const s = slugify(val);
    if (!s) return null; // Sem default "ATIVO" (Canon: suportar "NÃO INFORMADO")

    if (s === 'ATIVO' || s === 'ATIVOS') return SITUACAO_FUNCIONAL.ATIVO;
    if (s === 'VETERANO' || s === 'VETERANOS' || s === 'APOSENTADO' || s === 'APOSENTADOS') return SITUACAO_FUNCIONAL.VETERANO;
    if (s === 'PENSIONISTA' || s === 'PENSIONISTAS') return SITUACAO_FUNCIONAL.PENSIONISTA;

    return null;
  }

  /**
   * Normaliza o Perfil de Acesso.
   */
  function normalizePerfil(val) {
    const s = slugify(val);
    if (PERFIL_ACESSO[s]) return PERFIL_ACESSO[s];
    return PERFIL_ACESSO.FILIADO; // Default seguro
  }

  function isSituacaoSindicalValida(val) {
    return Object.values(SITUACAO_SINDICAL).includes(val);
  }

  function normalizeSituacaoSindical(val, fallback = SITUACAO_SINDICAL.FILIADO_SINPRF_ES) {
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

  function isUfBrasileiraValida(val) {
    if (!val) return false;
    return UFS_BRASILEIRAS.includes(slugify(val));
  }

  function normalizeUfBrasileira(val) {
    const s = slugify(val);
    if (!s) return null;
    return isUfBrasileiraValida(s) ? s : null;
  }

  /**
   * Valida se a UF é permitida para a situação sindical.
   * Centraliza a regra: FILIADO_OUTRO_SINDICATO permite qualquer UF brasileira EXCETO ES.
   * Para as demais situações, a UF deve ser nula.
   */
  function validarUfSindicatoExterno(ufRaw, situacaoSindical) {
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
    if (!s) return null;
    if (s === 'NENHUMA') return 'NENHUMA';

    for (const lot of LOTACOES) {
      if (slugify(lot) === s) return lot;
    }

    // Fallbacks por keyword
    if (s.includes('VIANA')) return "DEL 01 - Viana";
    if (s.includes('SERRA')) return "DEL 02 - Serra";
    if (s.includes('GUARAPARI')) return "DEL 03 - Guarapari";
    if (s.includes('LINHARES')) return "DEL 04 - Linhares";
    if (s.includes('SEDE')) return "SEDE";

    return null; // Removido fallback "SEDE" para exigir escolha explícita
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

  /**
   * Verifica se o perfil informado possui acesso de gestão.
   * Centraliza a regra de negócio para Backend e Frontend.
   */
  function ehPerfilGestao(perfil) {
    const p = normalizePerfil(perfil);
    return [PERFIL_ACESSO.ADMIN, PERFIL_ACESSO.DIRETORIA, PERFIL_ACESSO.FUNCIONARIO].includes(p);
  }

  return {
    SITUACAO_FUNCIONAL,
    SEXO,
    ESTADO_CADASTRO,
    PERFIL_ACESSO,
    SITUACAO_SINDICAL,
    UFS_BRASILEIRAS,
    LOTACOES_REPASSE,
    LOTACOES,
    LABELS,
    SITUACAO_SINDICAL_LABELS,
    normalizeSituacaoFuncional,
    normalizeSexo,
    normalizePerfil,
    normalizeSituacaoSindical,
    normalizeUfBrasileira,
    isUfBrasileiraValida,
    validarUfSindicatoExterno,
    normalizeEstadoCadastro,
    normalizeLotacao,
    normalizeNome,
    ehPerfilGestao,
    isSituacaoSindicalValida,
    slugify,
    ME_EDITABLE_FIELDS_FILIADO,
    ME_EDITABLE_FIELDS_GESTAO
  };
}));
