// src/types/filiado.ts

export interface Filiado {
  id: number;
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
  email?: string | null;
  situacao?: string | null;
  atualizado_em?: string | null;
}
