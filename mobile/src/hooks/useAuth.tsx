import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    async function loadSession() {
      try {
        const sessao = await carregarSessao();
        const bio = await carregarBiometriaHabilitada();

        console.log('[Biometria.init]', { enabled: bio, hasToken: !!sessao?.token });
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
            console.error('[Auth.loadSession.error]', error.message);
            // Se o token for inválido (401), o interceptor de resposta já lida com o logout.
            // Aqui, apenas garantimos o estado local seja limpo.
            if (error.response?.status === 401) {
              await limparSessao();
              setToken(null);
              setUsuario(null);
            }
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
    // IMPORTANTE: Logout NÃO deve desativar a biometria se o usuário quiser manter a preferência
    // No entanto, sem token o login por biometria não funcionará.
    // Para simplificar e seguir a regra de segurança, mantemos a flag conforme o storage.
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
