export interface User {
  id: string; // uuid
  cpf?: string;
  name: string;
  email?: string | null;
  password_hash?: string | null;
  token_acesso_temp?: string | null;
  token_expiracao?: string | null;
  perfil_acesso: 'ADMIN' | 'DIRETORIA' | 'COLABORADOR' | 'CONSELHEIRO';
  situacao: string;
  bloqueado?: boolean;
  created_at?: string;
  updated_at?: string;
  ultimo_acesso?: string | null;
  telefone1?: string | null;
  telefone2?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  uf_endereco?: string | null;
  data_nascimento?: string | null;
  sexo?: 'M' | 'F' | null;
  cargo?: string | null;
  cargo_mandato_inicio?: string | null;
  cargo_mandato_fim?: string | null;
  avatar_url?: string | null;
  avatar_public_id?: string | null;
  arquivado_em?: string | null;
  arquivado_motivo?: string | null;
  arquivado_por?: string | null;
  arquivado_por_nome?: string | null;
  desarquivado_em?: string | null;
  desarquivado_motivo?: string | null;
  desarquivado_por?: string | null;
  desarquivado_por_nome?: string | null;
  perfil_acesso2?: string | null;
  cargo2?: string | null;
  uf2?: string | null;

  vinculos?: any[];

  // Campos de compatibilidade
  nome?: string;
  email1?: string;
  email2?: string | null;

  // Otimizações de busca (Bolt ⚡)
  _normalizedNome?: string;
  _onlyDigitsCpf?: string;
}

export type UserProfile = 'ADMIN' | 'DIRETORIA' | 'COLABORADOR' | 'CONSELHEIRO';

export type Usuario = User;
