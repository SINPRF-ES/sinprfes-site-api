/**
 * Utilitários para o módulo de Assembleias (Web)
 * Sincronizado com mobile/src/utils/assembleiaLabels.ts
 */

(function (global) {
  const AssembleiaUtils = {
    getStatusLabel: function (status) {
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
    },

    getStatusBadgeClass: function (status) {
      switch (status) {
        case 'ABERTA':
          return 'badge-success';
        case 'EM_CURSO':
          return 'badge-warning';
        case 'ENCERRADA':
          return 'badge-danger';
        case 'CRIADA':
          return 'badge-info';
        default:
          return 'badge-secondary';
      }
    },

    getStatusEmoji: function (status) {
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
    },

    formatDateTime: function (dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString('pt-BR');
    }
  };

  global.AssembleiaUtils = AssembleiaUtils;
})(typeof window !== 'undefined' ? window : global);
