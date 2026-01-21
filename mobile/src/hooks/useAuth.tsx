import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import api from '../services/apiService';

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

  const appState = useRef(AppState.currentState);
  const backgroundTimestamp = useRef<number | null>(null);

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
    async function loadSession() {
      try {
        const sessao = await carregarSessao();
        const bio = await carregarBiometriaHabilitada();

        setBiometriaHabilitada(bio);

        if (sessao?.token) {
          // Define o token para que o interceptor do axios possa usá-lo
          setToken(sessao.token);

          try {
            // Valida o token e busca os dados do usuário atualizados
            const { data: usuarioAtualizado } = await api.get('/api/filiados/me');
            setUsuario(usuarioAtualizado);

            // Atualiza o usuário no storage
            await salvarSessao({ token: sessao.token, usuario: usuarioAtualizado });

            if (bio) {
              setBloqueadoPorBiometria(true);
            }
          } catch (error: any) {
            // Se o token for inválido (401), o interceptor de resposta já lida com o logout.
            // Aqui, apenas garantimos que o estado local seja limpo.
            if (error.response?.status === 401) {
              await limparSessao();
              setToken(null);
              setUsuario(null);
            }
            // Outros erros serão apenas logados pelo interceptor
          }
        }
      } finally {
        setCarregando(false);
      }
    }

    loadSession();
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
    setBloqueadoPorBiometria,
  }), [usuario, token, carregando, biometriaHabilitada, bloqueadoPorBiometria]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextData {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
