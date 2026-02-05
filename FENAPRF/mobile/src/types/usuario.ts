export interface Usuario {
  id: number;
  cpf: string;
  nome: string;
  perfil_acesso: string;
  [key: string]: unknown;
}
