export interface Assembleia {
  id: string;
  tipo: 'AGE' | 'AGO' | 'REUNIAO_DELIBERATIVA' | 'REUNIAO_INFORMATIVA' | 'REUNIAO_TEMATICA';
  titulo: string;
  descricao?: string;
  estado: 'CRIADO' | 'EM_CREDENCIAMENTO' | 'INICIADO' | 'SUSPENSA' | 'ENCERRADO' | 'CRIADA' | 'ABERTA' | 'ENCERRADA';
  criado_por: string;
  aberta_em?: string;
  encerrada_em?: string;
  criado_em: string;
}

export interface Quorum {
  id: string;
  assembleia_id: string;
  token: string;
  valido_ate: string;
  total?: number;
  criado_em: string;
}

export interface PedidoPalavra {
  id: string;
  assembleia_id: string;
  user_id: string;
  user_nome?: string;
  estado: 'PENDENTE' | 'EM_FALA' | 'CONCLUIDO' | 'CANCELADO';
  ordem: number;
  criado_em: string;
}

export interface Proposta {
  id: string;
  assembleia_id: string;
  autor_id: string;
  autor_nome?: string;
  titulo: string;
  descricao?: string;
  estado: 'PENDENTE' | 'VOTADA' | 'RETIRADA';
  motivo_retirada?: string;
  criado_em: string;
}

export interface Votacao {
  id: string;
  assembleia_id: string;
  quorum_snapshot_id: string;
  titulo: string;
  descricao?: string;
  estado: 'AGUARDANDO' | 'EM_CURSO' | 'CONCLUIDA' | 'RETIRADA';
  duracao_minutos: number;
  justificativa_retirada?: string;
  aberta_em?: string;
  finalizada_em?: string;
  encerra_em?: string;
  contagem?: VotoContagem;
  votos?: VotoNominal[];
  criado_em: string;
}

export interface VotoNominal {
  user_id: string;
  nome: string;
  voto: 'SIM' | 'NAO' | 'ABSTENCAO';
  registrado_em: string;
}

export interface VotoContagem {
  SIM: number;
  NAO: number;
  ABSTENCAO: number;
  total: number;
}
