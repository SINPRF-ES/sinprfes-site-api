import type { Usuario } from './usuario';

export interface Sessao {
  token: string;
  refreshToken?: string;
  usuario: Usuario;
}

export interface AuthContextData {
  usuario: Usuario | null;
  token: string | null;

  autenticado: boolean;
  carregando: boolean;

  biometriaHabilitada: boolean;
  bloqueadoPorBiometria: boolean;

  setSessao: (token: string, usuario: Usuario, refreshToken?: string) => Promise<void>;
  logout: (removerBiometria?: boolean) => Promise<void>;

  ativarBiometriaNesteAparelho: (ativar: boolean) => Promise<void>;
  desbloquearComBiometria: () => Promise<boolean>;
  setBloqueadoPorBiometria: (value: boolean) => void;
}
