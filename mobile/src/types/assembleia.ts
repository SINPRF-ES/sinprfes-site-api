export type AssembleiaEstadoFiltro = 'CRIADA' | 'ABERTA' | 'ENCERRADA';

export interface Assembleia {
  id: string;
  tipo: 'AGE' | 'AGO';
  titulo: string;
  pauta: string;
  estado: AssembleiaEstadoFiltro | 'EM_CURSO';
  criado_em: string;
  aberta_em?: string;
  encerrada_em?: string;
  criado_por: string;
  data_evento?: string;
  hora_primeira_chamada?: string;
  hora_segunda_chamada?: string;
  data_hora_inicio?: string;
  edital_url?: string;
  edital_public_id?: string;
  edital_resource_type?: string;
  edital_type?: string;
  edital_format?: string;
}

export interface AssembleiaEstado {
  assembleia: Assembleia;
  quorumVigente: {
    id: string;
    token: string;
    total: number;
    quorum_necessario: number;
    userHasCheckedIn: boolean;
    presentes?: any[];
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
  status: 'ATIVA' | 'ENCERRADA' | 'AGUARDANDO' | 'RETIRADA';
  duracao_segundos: number;
  contagem?: {
    SIM: number;
    NAO: number;
    ABSTENCAO: number;
    total: number;
  };
  votos?: VotoNominal[];
  userVoted?: boolean;
  userEligible?: boolean;
  user_eligibility?: {
    elegivel: boolean;
    motivo: string | null;
    jaVotou: boolean;
  };
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
