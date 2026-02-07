// src/types/filiado.ts
import { User } from './usuario';

export interface Filiado extends User {
  // Mantemos compatibilidade caso algum código ainda espere "nome" ou campos de dependentes
  nome: string;
  siape?: string | null;
  email1: string;
  email2?: string | null;
  situacao_funcional?: string | null;
}
