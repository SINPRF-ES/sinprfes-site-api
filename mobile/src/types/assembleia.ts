export type AssembleiaEstadoFiltro = 'CRIADA' | 'ABERTA' | 'ENCERRADA';

export interface Assembleia {
  id: string;
  tipo: 'AGE' | 'AGO';
  titulo: string;
  descricao: string;
  estado: AssembleiaEstadoFiltro;
  criado_em: string;
  aberta_em?: string;
  encerrada_em?: string;
  criado_por: string;
}

export interface AssembleiaEstado {
  assembleia: Assembleia;
  quorumVigente: {
    id: string;
    token: string;
    valido_ate: string;
    total: number;
    userHasCheckedIn: boolean;
  } | null;
  votacaoAtiva: VotacaoItem | null;
  mesa: any[];
  pedidosPalavra: any[];
  propostas: any[];
}

export interface VotacaoItem {
  id: string;
  assembleia_id: string;
  titulo: string;
  descricao: string;
  aberta_em: string;
  encerra_em: string;
  estado: 'AGUARDANDO' | 'EM_CURSO' | 'CONCLUIDA' | 'RETIRADA';
  duracao_minutos: number;
  contagem?: {
    SIM: number;
    NAO: number;
    ABSTENCAO: number;
    total: number;
  };
  votos?: VotoNominal[];
  userVoted?: boolean;
  userEligible?: boolean;
}

export interface VotoNominal {
  filiado_id: string;
  nome: string;
  voto: 'SIM' | 'NAO' | 'ABSTENCAO';
  registrado_em: string;
}

export interface PedidoPalavra {
  id: string;
  filiado_id: string;
  filiado_nome: string;
  estado: 'PENDENTE' | 'EM_FALA' | 'CONCLUIDO' | 'CANCELADO';
  ordem: number;
}

export interface Proposta {
  id: string;
  autor_id: string;
  autor_nome: string;
  titulo: string;
  descricao: string;
  estado: 'PENDENTE' | 'VOTADA' | 'RETIRADA';
  criado_em: string;
}
