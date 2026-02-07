import type { User } from './user';

export interface Sessao {
  token: string;
  user: User;
}

export interface AuthContextData {
  user: User | null;
  token: string | null;

  autenticado: boolean;
  carregando: boolean;

  biometriaHabilitada: boolean;
  bloqueadoPorBiometria: boolean;

  setSessao: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;

  ativarBiometriaNesteAparelho: (ativar: boolean) => Promise<void>;
  desbloquearComBiometria: () => Promise<boolean>;
  setBloqueadoPorBiometria: (value: boolean) => void;
}
