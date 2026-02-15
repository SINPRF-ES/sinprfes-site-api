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
  const [biometriaValidadaNestaSessao, setBiometriaValidadaNestaSessao] = useState(false);

  const appState = useRef(AppState.currentState);
  const backgroundTimestamp = useRef<number | null>(null);

  const unlockInFlightRef = useRef(false);
  const lastUnlockAtRef = useRef<number>(0);
  const LAST_UNLOCK_COOLDOWN_MS = 1500;

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
        const sessao = await carregarSessao();
        const bio = await carregarBiometriaHabilitada();

        logger.info('[Auth.loadSession] Iniciando...', {
            hasAccessToken: !!sessao?.token,
            hasUser: !!sessao?.user,
            biometriaHabilitada: bio
        });

        setBiometriaHabilitada(bio);

        // Se não há nada salvo, encerra
        if (!sessao?.token) {
          await logout();
          return;
        }

        setToken(sessao.token);
        if (sessao.user) setUser(sessao.user);

        // Se biometria habilitada: manter bloqueado e esperar destravar (não chama /me com token velho!)
        if (bio) {
          logger.info('[Auth.loadSession] Sessão encontrada, mas biometria ativa. Bloqueando UI.');
          setBloqueadoPorBiometria(true);
          return;
        }

        // Sem biometria: refresh silencioso na largada
        const rt = await carregarRefreshToken();
        if (!rt) {
          await logout();
          return;
        }

        try {
          logger.info('[Auth.loadSession] Fazendo refresh silencioso...');
          const { token: newAT, refreshToken: newRT } = await refreshSessao(rt);
          api.defaults.headers.common.Authorization = `Bearer ${newAT}`;

          const userAtualizado = await buscarUserLogado(newAT);
          await setSessao(newAT, newRT, userAtualizado);
        } catch (refreshErr) {
          logger.error('[Auth.loadSession] Erro no refresh inicial. Limpando sessão.');
          await logout();
        }
      } catch (e) {
        logger.error('[Auth.loadSession] Erro fatal no boot.', e);
        await logout();
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
    // Anti-loop rápido (cooldown)
    const now = Date.now();
    if (now - lastUnlockAtRef.current < LAST_UNLOCK_COOLDOWN_MS) {
      return true;
    }

    // Mutex (anti concorrência)
    if (unlockInFlightRef.current) {
      return false;
    }

    unlockInFlightRef.current = true;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !enrolled) {
        setBloqueadoPorBiometria(false);
        setBiometriaValidadaNestaSessao(true);
        return true;
      }

      // FENAPRF: Ao tentar carregar o Refresh Token, o SO pedirá a biometria se habilitado
      const rt = await carregarRefreshToken();

      if (!rt) {
        return false;
      }

      // REFRESH: pega token NOVO + refreshToken NOVO (rotacionado)
      const { token: newAT, refreshToken: newRT } = await refreshSessao(rt);

      // Persistir sessão imediatamente (importantíssimo por causa da rotação)
      api.defaults.headers.common.Authorization = `Bearer ${newAT}`;
      const userData = await buscarUserLogado(newAT);
      await setSessao(newAT, newRT, userData);

      // Desbloquear UI
      setBloqueadoPorBiometria(false);
      setBiometriaValidadaNestaSessao(true);
      lastUnlockAtRef.current = Date.now();

      if (ENABLE_PUSH) {
        registrarDispositivoParaPush().catch(() => {});
      }

      return true;
    } catch (e) {
      logger.error('[Auth.desbloquearComBiometria] Erro ao desbloquear/refresh', e);
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
