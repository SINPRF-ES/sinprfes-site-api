// FENAPRF/mobile/src/utils/emoji.ts

/**
 * Mapeamento canônico de emojis usados no app.
 * A regra é: todo emoji deve ser Unicode (string) e renderizado via <Text>.
 * NUNCA usar bibliotecas de ícones (MaterialCommunityIcons/Ionicons) para emojis.
 */
export const EMOJIS = {
  HOME: '🏠',
  MEUS_DADOS: '👤',
  MEMBROS: '👥',
  PUBLICACOES: '📚',
  LOGISTICA: '📦',
  JOGOS: '🏆',
  VOTACOES: '🗳️',
  ESTATUTO: '⚖️',
  SEGURANCA: '🛡️',
  ATUALIZACOES: '🔄',
  RELATORIOS: '📊',
  NOTIFICACOES: '📢',
  NOVO_MEMBRO: '➕',
  DIAGNOSTICO: '🧪',
  GESTAO: '🛠️',
  SAIR: '🚪',
  FECHAR: '🔒',
  SALVAR: '💾',
  EDITAR: '📝',
  EXCLUIR: '🗑️',
  ALERTA: '⚠️',
  CONCLUIDO: '✅',
  CALENDARIO: '📅',
  DOCUMENTO: '📄',
  TELEFONE: '📞',
  EMAIL: '📧',
  MAPA: '📍',
};

export default EMOJIS;
