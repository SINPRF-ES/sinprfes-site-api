import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

import type { AuthContextData } from '../types/auth';
import type { Usuario } from '../types/usuario';

import {
  carregarSessao,
  salvarSessao,
  limparSessao,
  carregarBiometriaHabilitada,
  definirBiometriaHabilitada,
} from '../services/storageService';

const AuthContext = createContext<AuthContextData | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [biometriaHabilitada, setBiometriaHabilitada] = useState(false);
  const [bloqueadoPorBiometria, setBloqueadoPorBiometria] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sessao = await carregarSessao();
        const bio = await carregarBiometriaHabilitada();

        setBiometriaHabilitada(bio);

        if (sessao?.token && sessao?.usuario) {
          setToken(sessao.token);
          setUsuario(sessao.usuario);

          // Se biometria habilitada, abre bloqueado
          if (bio) setBloqueadoPorBiometria(true);
        }
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  async function setSessao(novoToken: string, novoUsuario: Usuario) {
    setToken(novoToken);
    setUsuario(novoUsuario);
    setBloqueadoPorBiometria(false);
    await salvarSessao({ token: novoToken, usuario: novoUsuario });
  }

  async function logout() {
    await limparSessao();
    setToken(null);
    setUsuario(null);
    setBiometriaHabilitada(false);
    setBloqueadoPorBiometria(false);
  }

  async function ativarBiometriaNesteAparelho(ativar: boolean) {
    await definirBiometriaHabilitada(ativar);
    setBiometriaHabilitada(ativar);

    // Se já tem sessão e acabou de ativar, pode bloquear imediatamente:
    if (ativar && token) setBloqueadoPorBiometria(true);
  }

  async function desbloquearComBiometria(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      // Se não tem biometria configurada, não bloqueia o usuário
      if (!hasHardware || !enrolled) {
        setBloqueadoPorBiometria(false);
        return true;
      }

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirme sua identidade para acessar o SINPRF/ES',
        cancelLabel: 'Cancelar',
      });

      if (res.success) {
        setBloqueadoPorBiometria(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  const value = useMemo<AuthContextData>(() => ({
    usuario,
    token,
    autenticado: !!token,
    carregando,
    biometriaHabilitada,
    bloqueadoPorBiometria,
    setSessao,
    logout,
    ativarBiometriaNesteAparelho,
    desbloquearComBiometria,
  }), [usuario, token, carregando, biometriaHabilitada, bloqueadoPorBiometria]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextData {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
