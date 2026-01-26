export const getAssembleiaStatusLabel = (status: string): string => {
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
};

export const getAssembleiaStatusEmoji = (status: string): string => {
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
};
