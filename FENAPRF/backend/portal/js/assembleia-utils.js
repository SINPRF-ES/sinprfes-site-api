/**
 * Utilitários para o módulo de Assembleias (Web)
 * Sincronizado com mobile/src/utils/assembleiaLabels.ts
 */

(function (global) {
  const AssembleiaUtils = {
    getStatusLabel: function (status) {
      switch (status) {
        case 'CRIADO':
          return 'Agendada';
        case 'EM_CREDENCIAMENTO':
          return 'Em credenciamento';
        case 'INICIADO':
          return 'Em andamento';
        case 'SUSPENSA':
          return 'Suspensa';
        case 'ENCERRADO':
          return 'Encerrada';
        default:
          return status || 'STATUS DESCONHECIDO';
      }
    },

    getStatusBadgeClass: function (status) {
      switch (status) {
        case 'EM_CREDENCIAMENTO':
          return 'badge-success';
        case 'INICIADO':
          return 'badge-warning';
        case 'SUSPENSA':
          return 'badge-secondary';
        case 'ENCERRADO':
          return 'badge-danger';
        case 'CRIADO':
          return 'badge-info';
        default:
          return 'badge-secondary';
      }
    },

    getStatusEmoji: function (status) {
      switch (status) {
        case 'EM_CREDENCIAMENTO':
          return '🟢 ';
        case 'INICIADO':
          return '🟡 ';
        case 'SUSPENSA':
          return '⏸️ ';
        case 'ENCERRADO':
          return '🔴 ';
        case 'CRIADO':
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
