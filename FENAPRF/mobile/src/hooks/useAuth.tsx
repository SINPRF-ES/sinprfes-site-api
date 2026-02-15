import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import api from '../services/apiService';
import { registrarDispositivoParaPush } from '../services/deviceService';
import { ENABLE_PUSH } from '../config/features';
import { refreshSessao, buscarUserLogado } from '../services/authService';
import { logger } from '../infra/logger';

import type { AuthContextData, Sessao } from '../types/auth';
import type { User } from '../types/user';

import {
  carregarSessao,
  salvarSessao,
  clearSession,
  carregarBiometriaHabilitada,
  definirBiometriaHabilitada,
} from '../services/storageService';

const AuthContext = createContext<AuthContextData | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [biometriaHabilitada, setBiometriaHabilitada] = useState(false);
  const [bloqueadoPorBiometria, setBloqueadoPorBiometria] = useState(false);
  const [biometriaValidadaNestaSessao, setBiometriaValidadaNestaSessao] = useState(false);

  const appState = useRef(AppState.currentState);
  const backgroundTimestamp = useRef<number | null>(null);

  const unlockInFlightRef = useRef(false);
  const lastUnlockAtRef = useRef(0);
  const UNLOCK_COOLDOWN = 1500;

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
      setCarregando(true);
      try {
        const bio = await carregarBiometriaHabilitada();
        setBiometriaHabilitada(bio);

        const sessao = await carregarSessao();
        if (!sessao) return;

        // FENAPRF: Define o estado inicial para o navigator saber que existe uma sessão
        setToken(sessao.token);
        setUser(sessao.user);

        if (bio) {
          setBloqueadoPorBiometria(true);
          return;
        }

        // Se não tem biometria, faz refresh silencioso logo no boot
        const result = await refreshSessao(sessao.refreshToken);
        await salvarSessao(result.token, result.refreshToken, result.user);

        api.defaults.headers.common.Authorization = `Bearer ${result.token}`;
        setToken(result.token);
        setUser(result.user);
      } catch (e) {
        await clearSession();
        setToken(null);
        setUser(null);
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
    await salvarSessao(novoToken, novoRefreshToken, novoUser);

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
            await salvarSessao(
                sessao.token,
                sessao.refreshToken,
                userAtualizado
            );
        }
    } catch (error: any) {
        console.error('[Auth.refreshUser.error]', error.message);
    }
  }

  async function logout(removerBiometria = false) {
    await limparSessao(!removerBiometria);
    setToken(null);
    setUser(null);
    setBiometriaValidadaNestaSessao(false);

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
    const now = Date.now();
    if (now - lastUnlockAtRef.current < UNLOCK_COOLDOWN) {
      return true;
    }

    if (unlockInFlightRef.current) {
      return false;
    }

    unlockInFlightRef.current = true;

    try {
      // FENAPRF: Biometria segura - exige autenticação local antes do refresh
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && enrolled) {
        const bioResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirme sua identidade para continuar',
          fallbackLabel: 'Usar senha',
        });

        if (!bioResult.success) {
          return false;
        }
      }

      const sessao = await carregarSessao();
      if (!sessao?.refreshToken) {
        return false;
      }

      const result = await refreshSessao(sessao.refreshToken);

      await salvarSessao(
        result.token,
        result.refreshToken,
        result.user
      );

      api.defaults.headers.common.Authorization = `Bearer ${result.token}`;

      setToken(result.token);
      setUser(result.user);
      setBloqueadoPorBiometria(false);
      setBiometriaValidadaNestaSessao(true);

      lastUnlockAtRef.current = Date.now();

      if (ENABLE_PUSH) {
        registrarDispositivoParaPush().catch(() => {});
      }

      return true;
    } catch (e) {
      await clearSession();
      setToken(null);
      setUser(null);
      return false;
    } finally {
      unlockInFlightRef.current = false;
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
