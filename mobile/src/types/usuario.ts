export interface Usuario {
  id: number;
  cpf: string;
  nome: string;
  perfil_acesso: string;
  permissions?: string[];
  [key: string]: unknown;
}
