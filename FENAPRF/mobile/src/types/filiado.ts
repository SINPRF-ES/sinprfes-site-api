// src/types/filiado.ts

export interface Filiado {
  id: string; // UUID
  nome: string;
  sexo?: 'M' | 'F' | null;
  cpf: string;
  siape?: string | null;
  perfil_acesso: string;
  situacao: string;
  situacao_funcional?: string; // Algumas rotas devolvem situacao_funcional
  avatar_url?: string | null;

  // Contato
  telefone1: string;
  telefone2?: string | null;
  email1: string;
  email2?: string | null;

  // Endereço
  cep?: string | null;
  logradouro_bairro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  cidade?: string | null;
  uf?: string | null;

  // Lotação
  lotacao?: string | null;

  // Dependentes
  dep1_nome?: string | null;
  dep1_cpf?: string | null;
  dep1_data_nascimento?: string | null;
  dep1_parentesco?: string | null;

  dep2_nome?: string | null;
  dep2_cpf?: string | null;
  dep2_data_nascimento?: string | null;
  dep2_parentesco?: string | null;

  dep3_nome?: string | null;
  dep3_cpf?: string | null;
  dep3_data_nascimento?: string | null;
  dep3_parentesco?: string | null;

  dep4_nome?: string | null;
  dep4_cpf?: string | null;
  dep4_data_nascimento?: string | null;
  dep4_parentesco?: string | null;

  dep5_nome?: string | null;
  dep5_cpf?: string | null;
  dep5_data_nascimento?: string | null;
  dep5_parentesco?: string | null;

  // Campos de controle
  data_nascimento?: string | null;
  atualizado_em?: string | null;
  arquivado_em?: string | null;
  arquivado_motivo?: string | null;
  arquivado_por?: string | null;
  arquivado_por_nome?: string | null;

  // Para permitir acesso dinâmico a campos de dependentes
  [key: string]: any;

  // Otimizações de busca (Bolt ⚡)
  _normalizedNome?: string;
  _onlyDigitsCpf?: string;
}
