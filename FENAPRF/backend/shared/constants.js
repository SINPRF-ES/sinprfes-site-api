/**
 * FENAPRF - Constantes do Módulo de Logística
 * Centraliza regras de conflito e cargos para uso no Backend, Web e Mobile.
 *
 * Padrão UMD para compatibilidade total.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LogisticaConstants = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CARGOS_CONSELHO = [
    "Presidente",
    "Vice-Presidente",
    "Delegado Representante",
    "Delegado Substituto",
  ];

  const CONFLICT_GROUPS = [
    ["Presidente", "Vice-Presidente"],
    ["Delegado Representante", "Delegado Substituto"]
  ];

  /**
   * Verifica se dois membros geram alerta de conflito para o mesmo evento.
   * Regra: Mesma UF e cargos equivalentes (ex: Pres + Vice ou DR + DS).
   * @param {string} cargo1
   * @param {string} uf1
   * @param {string} cargo2
   * @param {string} uf2
   * @returns {boolean}
   */
  function checkConflict(cargo1, uf1, cargo2, uf2) {
    if (!uf1 || !uf2 || uf1.trim().toUpperCase() !== uf2.trim().toUpperCase()) return false;
    if (!cargo1 || !cargo2) return false;

    // Normalização básica para comparação
    const c1 = cargo1.trim();
    const c2 = cargo2.trim();

    // Se for o mesmo cargo na mesma UF (Ex: Dois Presidentes)
    if (c1.toUpperCase() === c2.toUpperCase()) return true;

    // Se pertencerem ao mesmo grupo de conflito
    // Compara de forma case-insensitive
    for (const group of CONFLICT_GROUPS) {
      const gUpper = group.map(g => g.toUpperCase());
      if (gUpper.includes(c1.toUpperCase()) && gUpper.includes(c2.toUpperCase())) {
        return true;
      }
    }

    return false;
  }

  return {
    CARGOS_CONSELHO,
    CONFLICT_GROUPS,
    checkConflict
  };
}));
