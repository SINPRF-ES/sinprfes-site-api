export type AssembleiaEstadoFiltro = 'CRIADO' | 'EM_CREDENCIAMENTO' | 'INICIADO' | 'SUSPENSA' | 'ENCERRADO';

export interface Assembleia {
  id: string;
  tipo: 'AGE' | 'AGO' | 'REUNIAO_DELIBERATIVA' | 'REUNIAO_INFORMATIVA' | 'REUNIAO_TEMATICA';
  titulo: string;
  pauta: string;
  estado: AssembleiaEstadoFiltro;
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
  edital_drive_file_id?: string;
  suspensao_motivo?: string;
  data_hora_retorno?: string;
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
    tipo_chamada?: string;
    quorum_total_ativos?: number;
    is_global?: boolean;
  } | null;
  votacaoAtiva: VotacaoItem | null;
  mesa: {
    presidente_user_id?: string;
    presidente_nome?: string;
    vice_presidente_user_id?: string;
    vice_presidente_nome?: string;
    secretario_user_id?: string;
    secretario_nome?: string;
    secretario_2_user_id?: string;
    secretario_2_nome?: string;
  } | null;
  pedidosPalavra: PedidoPalavra[];
  propostas: Proposta[];
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
  user_id: string;
  nome: string;
  voto: 'SIM' | 'NAO' | 'ABSTENCAO';
  registrado_em: string;
}

export interface PedidoPalavra {
  id: string;
  user_id: string;
  user_nome: string;
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
