/**
 * Utilitários para o módulo de Assembleias (Web)
 * Sincronizado com mobile/src/utils/assembleiaLabels.ts
 */

(function (global) {
  const AssembleiaUtils = {
    getStatusLabel: function (status) {
      const States = global.Canon ? global.Canon.ASSEMBLEIA_ESTADOS : {
        CRIADO: 'CRIADO',
        EM_CREDENCIAMENTO: 'EM_CREDENCIAMENTO',
        INICIADO: 'INICIADO',
        SUSPENSA: 'SUSPENSA',
        ENCERRADO: 'ENCERRADO'
      };

      switch (status) {
        case States.CRIADO:
          return 'Agendada';
        case States.EM_CREDENCIAMENTO:
          return 'Em credenciamento';
        case States.INICIADO:
          return 'Em andamento';
        case States.SUSPENSA:
          return 'Suspensa';
        case States.ENCERRADO:
          return 'Encerrada';
        default:
          return status || 'STATUS DESCONHECIDO';
      }
    },

    getStatusBadgeClass: function (status) {
      const States = global.Canon ? global.Canon.ASSEMBLEIA_ESTADOS : {
        CRIADO: 'CRIADO',
        EM_CREDENCIAMENTO: 'EM_CREDENCIAMENTO',
        INICIADO: 'INICIADO',
        SUSPENSA: 'SUSPENSA',
        ENCERRADO: 'ENCERRADO'
      };

      switch (status) {
        case States.EM_CREDENCIAMENTO:
          return 'badge-success';
        case States.INICIADO:
          return 'badge-warning';
        case States.SUSPENSA:
          return 'badge-secondary';
        case States.ENCERRADO:
          return 'badge-danger';
        case States.CRIADO:
          return 'badge-info';
        default:
          return 'badge-secondary';
      }
    },

    getStatusEmoji: function (status) {
      const States = global.Canon ? global.Canon.ASSEMBLEIA_ESTADOS : {
        CRIADO: 'CRIADO',
        EM_CREDENCIAMENTO: 'EM_CREDENCIAMENTO',
        INICIADO: 'INICIADO',
        SUSPENSA: 'SUSPENSA',
        ENCERRADO: 'ENCERRADO'
      };

      switch (status) {
        case States.EM_CREDENCIAMENTO:
          return '🟢 ';
        case States.INICIADO:
          return '🟡 ';
        case States.SUSPENSA:
          return '⏸️ ';
        case States.ENCERRADO:
          return '🔴 ';
        case States.CRIADO:
          return '🔵 ';
        default:
          return '⚪ ';
      }
    },

    formatDateTime: function (dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString('pt-BR');
    }
  };

  global.AssembleiaUtils = AssembleiaUtils;
})(typeof window !== 'undefined' ? window : global);
