export interface VotacaoResumo {
  id: number;
  titulo: string;
  status: 'ABERTA' | 'ENCERRADA' | 'AGENDADA';
  abre_em?: string;
  encerra_em?: string;
}

export interface VotacaoOpcao {
  id: number;
  texto: string;
}

export interface VotacaoDetalhe {
  id: number;
  titulo: string;
  descricao: string;
  status: 'ABERTA' | 'ENCERRADA' | 'AGENDADA';
  abre_em?: string;
  encerra_em?: string;
  opcoes: VotacaoOpcao[];
  // se o backend quiser informar se o usuário já votou
  ja_votou?: boolean;
}
