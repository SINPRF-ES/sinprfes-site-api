export type AssembleiaStatus = 'CRIADA' | 'ABERTA' | 'ENCERRADA';

export interface Assembleia {
  id: string;
  titulo: string;
  tipo: 'AGE' | 'AGO';
  descricao: string;
  status: AssembleiaStatus;
  data_criacao: string;
  data_abertura?: string;
  data_encerramento?: string;
  token_quorum?: string;
  token_expira_em?: string;
  presidente_id?: string;
  secretario_id?: string;
  presidente_nome?: string;
  secretario_nome?: string;
}

export interface AssembleiaEstado {
  assembleia: Assembleia;
  quorumVigente: {
    contagem: number;
    userHasCheckedIn: boolean;
  };
  votacaoAtiva: VotacaoItem | null;
  mesa: {
    presidente: string | null;
    secretario: string | null;
  };
  proximosItens: VotacaoItem[];
}

export interface VotacaoItem {
  id: string;
  assembleia_id: string;
  titulo: string;
  descricao: string;
  aberta_em: string;
  encerra_em: string;
  status: 'ABERTA' | 'ENCERRADA';
  total_sim: number;
  total_nao: number;
  total_abstencao: number;
  userVoted?: boolean;
  userEligible?: boolean;
}

export interface VotoNominal {
  filiado_nome: string;
  opcao: 'SIM' | 'NAO' | 'ABSTENCAO';
  data_voto: string;
}

export interface PedidoPalavra {
  id: string;
  filiado_id: string;
  filiado_nome: string;
  status: 'PENDENTE' | 'EM_FALA' | 'CONCLUIDO' | 'CANCELADO';
  posicao: number;
}

export interface Proposta {
  id: string;
  filiado_id: string;
  filiado_nome: string;
  titulo: string;
  descricao: string;
  status: 'PENDENTE' | 'EM_VOTACAO' | 'APROVADA' | 'REJEITADA' | 'RETIRADA';
  data_criacao: string;
}
