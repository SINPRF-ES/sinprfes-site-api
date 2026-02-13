import type { User } from './user';

export interface Sessao {
  token: string;
  refreshToken: string;
  user: User;
}

export interface AuthContextData {
  user: User | null;
  token: string | null;

  autenticado: boolean;
  carregando: boolean;

  biometriaHabilitada: boolean;
  bloqueadoPorBiometria: boolean;

  setSessao: (token: string, refreshToken: string, user: User) => Promise<void>;
  logout: (removerBiometria?: boolean) => Promise<void>;

  ativarBiometriaNesteAparelho: (ativar: boolean) => Promise<void>;
  desbloquearComBiometria: () => Promise<boolean>;
  setBloqueadoPorBiometria: (value: boolean) => void;
}
