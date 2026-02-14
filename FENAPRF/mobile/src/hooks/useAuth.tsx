import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import api from '../services/apiService';
import { registrarDispositivoParaPush } from '../services/deviceService';
import { ENABLE_PUSH } from '../config/features';

import type { AuthContextData, Sessao } from '../types/auth';
import type { User } from '../types/user';

import {
  carregarSessao,
  salvarSessao,
  limparSessao,
  carregarBiometriaHabilitada,
  definirBiometriaHabilitada,
  carregarRefreshToken,
} from '../services/storageService';

const AuthContext = createContext<AuthContextData | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [biometriaHabilitada, setBiometriaHabilitada] = useState(false);
  const [bloqueadoPorBiometria, setBloqueadoPorBiometria] = useState(false);

  const appState = useRef(AppState.currentState);
  const backgroundTimestamp = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (backgroundTimestamp.current && Date.now() - backgroundTimestamp.current > 60000) {
          if (token && biometriaHabilitada) {
            setBloqueadoPorBiometria(true);
          }
        }
        backgroundTimestamp.current = null;
      } else if (nextAppState.match(/inactive|background/)) {
        backgroundTimestamp.current = Date.now();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [token, biometriaHabilitada]);

  useEffect(() => {
    async function loadSession() {
      try {
        const sessao = await carregarSessao();
        const bio = await carregarBiometriaHabilitada();

        setBiometriaHabilitada(bio);

        if (sessao?.token) {
          setToken(sessao.token);
          if (sessao.user) {
              setUser(sessao.user);
          }

          try {
            // O interceptor de resposta cuidará do refresh se o token estiver expirado.
            // Se a biometria estiver ativa, o refresh disparará o prompt biométrico.
            const { data: userAtualizado } = await api.get('/api/users/me');
            setUser(userAtualizado);

            const rt = await carregarRefreshToken();
            await salvarSessao({
                token: sessao.token,
                refreshToken: rt || '',
                user: userAtualizado
            });

            if (ENABLE_PUSH) {
              registrarDispositivoParaPush().catch(() => {});
            }

            // No boot, se biometria ativa, bloqueamos a tela para garantir privacidade
            if (bio) {
              setBloqueadoPorBiometria(true);
            }
          } catch (error: any) {
            console.error('[Auth.loadSession.error]', error.message);

            // Se for erro de rede, não deslogamos para evitar quedas acidentais
            const isNetworkError = !error.response && !!error.request;
            const isCriticalError = error.response?.status === 401 || error.response?.status === 403;

            if (isCriticalError && !isNetworkError) {
                logger.warn('[Auth.loadSession] Erro crítico na sessão inicial. Limpando.');
                setToken(null);
                setUser(null);
                await limparSessao();
            } else {
                logger.info('[Auth.loadSession] Erro não crítico ou de rede. Mantendo sessão local.');
            }
          }
        }
      } finally {
        setCarregando(false);
      }
    }

    loadSession();
  }, []);

  async function setSessao(novoToken: string, novoRefreshToken: string, novoUser: User) {
    setToken(novoToken);
    setUser(novoUser);
    setBloqueadoPorBiometria(false);
    await salvarSessao({ token: novoToken, refreshToken: novoRefreshToken, user: novoUser });

    if (ENABLE_PUSH) {
      registrarDispositivoParaPush().catch(() => {});
    }
  }

  async function refreshUser() {
    try {
        const { data: userAtualizado } = await api.get('/api/users/me');
        setUser(userAtualizado);

        const sessao = await carregarSessao();
        if (sessao) {
            await salvarSessao({
                ...sessao,
                user: userAtualizado
            });
        }
    } catch (error: any) {
        console.error('[Auth.refreshUser.error]', error.message);
    }
  }

  async function logout(removerBiometria = false) {
    await limparSessao(!removerBiometria);
    setToken(null);
    setUser(null);

    if (removerBiometria) {
      setBiometriaHabilitada(false);
    }

    setBloqueadoPorBiometria(false);

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => key.startsWith('users_cache_'));
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (e) {}
  }

  async function ativarBiometriaNesteAparelho(ativar: boolean) {
    await definirBiometriaHabilitada(ativar);
    setBiometriaHabilitada(ativar);
    if (ativar && token) setBloqueadoPorBiometria(true);
  }

  async function desbloquearComBiometria(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !enrolled) {
        setBloqueadoPorBiometria(false);
        return true;
      }

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autenticação biométrica FENAPRF',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });

      if (res.success) {
        setBloqueadoPorBiometria(false);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  const value = useMemo<AuthContextData>(() => ({
    user,
    token,
    autenticado: !!token,
    carregando,
    biometriaHabilitada,
    bloqueadoPorBiometria,
    setSessao,
    refreshUser,
    logout,
    ativarBiometriaNesteAparelho,
    desbloquearComBiometria,
    setBloqueadoPorBiometria,
  }), [user, token, carregando, biometriaHabilitada, bloqueadoPorBiometria]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextData {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
