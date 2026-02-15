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

  const CARGOS_CONSELHO = [
    "Presidente",
    "Vice-Presidente",
    "Delegado Representante",
    "Delegado Substituto",
  ];

  const CARGOS_DIRETORIA = [
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
   * UFs Detalhadas
   */
  const UFS_DETALHADAS = [
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

  /**
   * Filtros da página Membros
   */
  const FILTROS_MEMBROS = [
    { value: "PADRAO", label: "Exibição padrão (Diretoria + Conselheiros por UF)" },
    { value: "DIRETORIA", label: "Apenas Diretoria" },
    { value: "PRESIDENTES", label: "Apenas Presidentes" },
    { value: "VICES", label: "Apenas Vices" },
    { value: "DR", label: "Delegados Representantes (DR)" },
    { value: "DS", label: "Delegados Substitutos (DS)" },
    { value: "UF", label: "Filtrar por UF" },
    { value: "ADMIN_COLAB", label: "Admin/Colaborador" },
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
    if (!val) return null;
    const s = slugify(val);
    if (PERFIL_ACESSO[s]) return PERFIL_ACESSO[s];

    return null;
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

  function normalizeCargo(raw) {
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

  function cargoRankDiretoria(cargo) {
    const c = normalizeCargo(cargo);
    const idx = CARGOS_DIRETORIA.findIndex(x => x.toLowerCase() === String(c || "").toLowerCase());
    return idx === -1 ? 999 : idx;
  }

  function cargoRankConselho(cargo) {
    const c = normalizeCargo(cargo);
    const idx = CARGOS_CONSELHO.findIndex(x => x.toLowerCase() === String(c || "").toLowerCase());
    return idx === -1 ? 999 : idx;
  }

  function byName(a, b) {
    const nameA = a?.name || a?.nome || "";
    const nameB = b?.name || b?.nome || "";
    return String(nameA).localeCompare(String(nameB), "pt-BR", { sensitivity: "base" });
  }

  function ordenarMembrosTodos(membros) {
    if (!Array.isArray(membros)) return [];
    const list = membros.filter(m => !!m);

    const diretoria = list
      .filter(m => String(m?.perfil_acesso || "").toUpperCase() === PERFIL_ACESSO.DIRETORIA)
      .sort((a, b) => {
        const ra = cargoRankDiretoria(a?.cargo);
        const rb = cargoRankDiretoria(b?.cargo);
        if (ra !== rb) return ra - rb;
        return byName(a, b);
      });

    const conselheiros = list
      .filter(m => String(m?.perfil_acesso || "").toUpperCase() === PERFIL_ACESSO.CONSELHEIRO)
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
      .filter(m => ["ADMIN", "COLABORADOR"].includes(String(m?.perfil_acesso || "").toUpperCase()))
      .sort(byName);

    const outros = list
      .filter(m => ![PERFIL_ACESSO.DIRETORIA, PERFIL_ACESSO.CONSELHEIRO, PERFIL_ACESSO.ADMIN, PERFIL_ACESSO.COLABORADOR].includes(String(m?.perfil_acesso || "").toUpperCase()))
      .sort(byName);

    return [...diretoria, ...conselheiros, ...adminColab, ...outros];
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
   * RBAC - Role Based Access Control
   */
  const isGestao = (perfil) => {
    const p = normalizePerfil(perfil);
    return [PERFIL_ACESSO.ADMIN, PERFIL_ACESSO.COLABORADOR, PERFIL_ACESSO.DIRETORIA].includes(p);
  };

  const canManageAdmins = (perfil) => {
    return normalizePerfil(perfil) === PERFIL_ACESSO.ADMIN;
  };

  /**
   * Verifica se o usuário pode indicar membros para a Mesa Diretora da Assembleia.
   * Regra: Exclusiva do Presidente/Vice da FENAPRF (Princípio da Soberania Institucional).
   */
  const canComposeMesa = (user) => {
    if (!user) return false;

    const cargo = (user.cargo || "").trim();
    const cargo2 = (user.cargo2 || "").trim();
    const cargosAutorizados = ["Presidente da FENAPRF", "Vice-Presidente da FENAPRF"];
    return cargosAutorizados.includes(cargo) || cargosAutorizados.includes(cargo2);
  };

  /**
   * Verifica se o usuário pode gerar o Token de Credenciamento Global.
   * Regra: Apenas Presidente, Vice, Diretor de Secretaria ou seu Substituto.
   */
  const canCreateCredenciamentoToken = (user) => {
    if (!user) return false;
    const cargo = (user.cargo || "").trim();
    const cargo2 = (user.cargo2 || "").trim();
    const cargosAutorizados = [
      "Presidente da FENAPRF",
      "Vice-Presidente da FENAPRF",
      "Diretor de Secretaria",
      "Diretor de Secretaria Substituto"
    ];
    return cargosAutorizados.includes(cargo) || cargosAutorizados.includes(cargo2);
  };

  /**
   * Verifica se o usuário é membro do Conselho de Representantes.
   * Regra: Conselheiros + Presidente/Vice da FENAPRF.
   */
  const isCouncilMember = (user) => {
    if (!user) return false;
    const p = normalizePerfil(user.perfil_acesso);

    if (p === PERFIL_ACESSO.CONSELHEIRO) return true;

    if (p === PERFIL_ACESSO.DIRETORIA) {
        const cargo = (user.cargo || "").trim();
        const cargo2 = (user.cargo2 || "").trim();
        const cargosVoto = ["Presidente da FENAPRF", "Vice-Presidente da FENAPRF"];
        return cargosVoto.includes(cargo) || cargosVoto.includes(cargo2);
    }

    return false;
  };

  /**
   * Verifica se o usuário pode realizar Check-in Global (presença no evento).
   * Regra: Diretoria e Conselheiro.
   */
  const canCheckInGlobal = (perfil) => {
    const p = normalizePerfil(perfil);
    return [PERFIL_ACESSO.DIRETORIA, PERFIL_ACESSO.CONSELHEIRO].includes(p);
  };

  /**
   * Verifica se o perfil pode realizar check-in de Quórum/Snapshot.
   * Regra: Apenas Membros do Conselho.
   */
  const canCheckInQuorum = (user) => {
    return isCouncilMember(user);
  };

  /**
   * Verifica se o perfil pode votar em assembleias.
   * Regra: Apenas Membros do Conselho.
   */
  const canVoteAssembleia = (user) => {
    return isCouncilMember(user);
  };

  /**
   * Verifica se o perfil pode criar propostas (encaminhamentos).
   * Regra: Apenas Membros do Conselho.
   */
  const canProposeAssembleia = (user) => {
    return isCouncilMember(user);
  };

  /**
   * Verifica se o perfil pode se inscrever em eventos de logística.
   * Regra: Diretoria e Conselheiros.
   */
  const canRegisterForEvent = (perfil) => {
    const p = normalizePerfil(perfil);
    return [PERFIL_ACESSO.DIRETORIA, PERFIL_ACESSO.CONSELHEIRO].includes(p);
  };

  return {
    SEXO,
    ESTADO_CADASTRO,
    PERFIL_ACESSO,
    UFS,
    CARGOS_CONSELHO,
    CARGOS_DIRETORIA,
    UFS_DETALHADAS,
    FILTROS_MEMBROS,
    LABELS,
    normalizeSexo,
    normalizePerfil,
    normalizeEstadoCadastro,
    normalizeNome,
    slugify,
    normalizeCargo,
    cargoRankDiretoria,
    cargoRankConselho,
    ordenarMembrosTodos,
    isGestao,
    canManageAdmins,
    canComposeMesa,
    canCreateCredenciamentoToken,
    isCouncilMember,
    canCheckInGlobal,
    canCheckInQuorum,
    canVoteAssembleia,
    canProposeAssembleia,
    canRegisterForEvent
  };
}));
