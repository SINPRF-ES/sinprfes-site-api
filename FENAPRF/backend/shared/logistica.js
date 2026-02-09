/**
 * FENAPRF - Constantes e Lógica do Módulo de Logística
 * Centraliza regras de conflito e tipos de eventos.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./canon'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./canon'));
  } else {
    root.LogisticaConstants = factory(root.Canon);
  }
}(typeof self !== 'undefined' ? self : this, function (Canon) {
  'use strict';

  const STATUS_EVENTO = {
    ATIVO: 'ativo',
    ENCERRADO: 'encerrado'
  };

  const ACOES_AUDITORIA = {
    CRIAR: 'CRIAR',
    ALTERAR: 'ALTERAR',
    CANCELAR: 'CANCELAR'
  };

  const RECURSO_TIPO = {
    EVENTO: 'EVENTO',
    INSCRICAO: 'INSCRICAO'
  };

  // Grupos de conflito baseados nos cargos canônicos
  // Presidência: Presidente + Vice-Presidente
  // Delegacia: Delegado Representante + Delegado Substituto
  const GRUPOS_CONFLITO = [
    {
      nome: 'Presidência',
      cargos: [Canon.CARGOS_CONSELHO[0], Canon.CARGOS_CONSELHO[1]] // Presidente, Vice-Presidente
    },
    {
      nome: 'Delegacia Representante',
      cargos: [Canon.CARGOS_CONSELHO[2], Canon.CARGOS_CONSELHO[3]] // Delegado Representante, Delegado Substituto
    }
  ];

  /**
   * Verifica conflitos em uma lista de inscrições para uma UF.
   * Retorna um objeto com os grupos em conflito e cargos duplicados.
   */
  function verificarConflitosUF(inscricoes) {
    const conflitos = [];
    const cargosPresentes = inscricoes.map(i => i.cargo);

    // 1. Verificar duplicidade de cargos
    const contagemCargos = {};
    cargosPresentes.forEach(c => {
        if (c) {
            contagemCargos[c] = (contagemCargos[c] || 0) + 1;
        }
    });

    Object.keys(contagemCargos).forEach(cargo => {
        if (contagemCargos[cargo] > 1) {
            conflitos.push({
                tipo: 'DUPLICIDADE',
                mensagem: `Mais de um inscrito com o cargo "${cargo}"`,
                cargo
            });
        }
    });

    // 2. Verificar grupos de conflito
    GRUPOS_CONFLITO.forEach(grupo => {
        const cargosNoGrupo = cargosPresentes.filter(c => grupo.cargos.includes(c));
        const cargosUnicosNoGrupo = [...new Set(cargosNoGrupo)];

        if (cargosUnicosNoGrupo.length >= 2) {
            conflitos.push({
                tipo: 'GRUPO',
                mensagem: `Conflito de representação: ${grupo.cargos.join(' + ')}`,
                grupo: grupo.nome,
                cargos: cargosUnicosNoGrupo
            });
        }
    });

    return conflitos;
  }

  return {
    STATUS_EVENTO,
    ACOES_AUDITORIA,
    RECURSO_TIPO,
    GRUPOS_CONFLITO,
    verificarConflitosUF
  };
}));
