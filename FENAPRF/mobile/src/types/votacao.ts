export interface VotacaoResumo {
  id: string;
  titulo: string;
  status: 'ABERTA' | 'ENCERRADA' | 'AGENDADA';
  abre_em?: string;
  encerra_em?: string;
}

export interface VotacaoOpcao {
  id: string;
  texto: string;
}

export interface VotacaoDetalhe {
  id: string;
  titulo: string;
  descricao: string;
  status: 'ABERTA' | 'ENCERRADA' | 'AGENDADA';
  abre_em?: string;
  encerra_em?: string;
  opcoes: VotacaoOpcao[];
  // se o backend quiser informar se o membro já votou
  ja_votou?: boolean;
}
