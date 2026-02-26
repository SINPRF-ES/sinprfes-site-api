import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import api from '../services/apiService';
import { updateAutoScheduler } from '../services/updateAutoScheduler';
import { registrarDispositivoParaPush } from '../services/deviceService';

import type { AuthContextData } from '../types/auth';
import type { Usuario } from '../types/usuario';

import {
  carregarSessao,
  salvarSessao,
  limparSessao,
  carregarBiometriaHabilitada,
  definirBiometriaHabilitada,
  carregarRefreshToken,
} from '../services/storageService';
import { AuthStore } from '../services/authStore';

const AuthContext = createContext<AuthContextData | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [biometriaHabilitada, setBiometriaHabilitada] = useState(false);
  const [bloqueadoPorBiometria, setBloqueadoPorBiometria] = useState(false);

  const appState = useRef(AppState.currentState);
  const backgroundTimestamp = useRef<number | null>(null);
  const lastBiometricRequestAt = useRef<number>(0);
  const isBiometricRequestPending = useRef<boolean>(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App volve para o primeiro plano
        if (backgroundTimestamp.current && Date.now() - backgroundTimestamp.current > 60000) {
          if (token) {
            setBloqueadoPorBiometria(true);
          }
        }
        backgroundTimestamp.current = null;
      } else if (nextAppState.match(/inactive|background/)) {
        // App vai para segundo plano
        backgroundTimestamp.current = Date.now();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [token]);

  useEffect(() => {
    if (token) {
      updateAutoScheduler.start();
    } else {
      updateAutoScheduler.stop();
    }
  }, [token]);

  useEffect(() => {
    // Define callback global para apiService (Logout Unificado)
    (global as any).onSessionExpired = () => {
       console.warn('[Auth.onSessionExpired] Sessão expirada detectada pelo ApiService');
       logout();
    };

    async function loadSession() {
      AuthStore.init();
      try {
        const sessao = await carregarSessao();
        const bio = await carregarBiometriaHabilitada();

        console.log('[Biometria.init]', { enabled: bio, hasToken: !!sessao?.token });
        setBiometriaHabilitada(bio);

        if (sessao?.token) {
          // Define o token para que o interceptor do axios possa usá-lo
          setToken(sessao.token);
        }

        // Marca como pronto após restaurar do storage, permitindo que interceptores sigam
        AuthStore.setReady();

        if (sessao?.token) {
          try {
            // Valida o token e busca os dados do usuário atualizados
            const { data: usuarioAtualizado } = await api.get('/api/filiados/me');
            setUsuario(usuarioAtualizado);

            // Atualiza o usuário no storage
            await salvarSessao({ token: sessao.token, usuario: usuarioAtualizado });

            if (bio) {
              setBloqueadoPorBiometria(true);
            }

            await registrarDispositivoParaPush();
          } catch (error: any) {
            console.error('[Auth.loadSession.error]', error.message);
            // Se o token for inválido (401), o interceptor de resposta já limpou o storage.
            // Aqui limpamos o estado local para forçar redirecionamento para Login.
            setToken(null);
            setUsuario(null);
          }
        }
      } finally {
        setCarregando(false);
        AuthStore.setReady();
      }
    }

    loadSession();
  }, []);

  async function setSessao(novoToken: string, novoUsuario: Usuario, novoRefreshToken?: string) {
    setToken(novoToken);
    setUsuario(novoUsuario);
    setBloqueadoPorBiometria(false);
    await salvarSessao({ token: novoToken, usuario: novoUsuario, refreshToken: novoRefreshToken });
  }

  async function logout(removerBiometria = false) {
    try {
      const refreshToken = await carregarRefreshToken();
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch (e) {
      console.warn('[Auth.logout] Erro ao revogar token no servidor', e);
    }

    await limparSessao(!removerBiometria);
    setToken(null);
    setUsuario(null);

    if (removerBiometria) {
      setBiometriaHabilitada(false);
    }

    setBloqueadoPorBiometria(false);

    // Limpeza adicional de caches específicos de telas
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => key.startsWith('filiados_cache_'));
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (e) {
      // erro, mas não deve bloquear o logout
    }
  }

  async function ativarBiometriaNesteAparelho(ativar: boolean) {
    await definirBiometriaHabilitada(ativar);
    setBiometriaHabilitada(ativar);

    // Se já tem sessão e acabou de ativar, pode bloquear imediatamente:
    if (ativar && token) setBloqueadoPorBiometria(true);
  }

  async function desbloquearComBiometria(): Promise<boolean> {
    if (isBiometricRequestPending.current) {
      console.log('[Biometria.guard] Ignorando pedido: já existe uma solicitação pendente');
      return false;
    }

    const now = Date.now();
    if (now - lastBiometricRequestAt.current < 5000) {
      console.log('[Biometria.guard] Ignorando pedido: intervalo muito curto (< 5s)');
      return false;
    }

    isBiometricRequestPending.current = true;
    try {
      console.log('[Biometria.auth.start]');
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !enrolled) {
        console.warn('[Biometria.auth.skip] Hardware ou Digital não disponíveis');
        setBloqueadoPorBiometria(false);
        return true;
      }

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autenticação biométrica SINPRF/ES',
        cancelLabel: 'Usar senha',
        fallbackLabel: 'Usar senha',
        disableDeviceFallback: false,
      });

      lastBiometricRequestAt.current = Date.now();

      if (res.success) {
        console.log('[Biometria.auth.ok]');
        setBloqueadoPorBiometria(false);
        return true;
      }
      console.log('[Biometria.auth.fail]', res.error);
      return false;
    } catch (e) {
      console.error('[Biometria.auth.error]', e);
      return false;
    } finally {
      isBiometricRequestPending.current = false;
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
    setBloqueadoPorBiometria,
  }), [usuario, token, carregando, biometriaHabilitada, bloqueadoPorBiometria]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextData {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
