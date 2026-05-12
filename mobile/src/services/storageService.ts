import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Usuario } from '../types/usuario';
import type { Sessao } from '../types/auth';
import { logger } from '../infra/logger';
import { toError } from '../infra/errorUtils';

const TOKEN_KEY = 'sinprf_secure_token';
const REFRESH_TOKEN_KEY = 'sinprf_refresh_token';
const HAS_REFRESH_TOKEN_KEY = '@sinprf/has_refresh_token';
const USER_KEY = '@sinprf/usuario';
const BIOMETRIA_KEY = '@sinprf/biometria_habilitada'; // Legacy AsyncStorage
const BIOMETRIA_SECURE_KEY = 'sinprf_biometria_enabled'; // Novo SecureStore
const BIOMETRIC_CREDENTIAL_KEY = 'sinprf_biometric_token';
const LAST_UPDATE_CHECK_KEY = '@sinprf/last_update_check';
const LAST_STRONG_AUTH_AT_KEY = '@sinprf/last_strong_auth_at';

// Single-flight e Cooldown para Biometria (SecureStore)
let pendingRefreshPromise: Promise<string | null> | null = null;
let lastRefreshResult: { token: string | null; timestamp: number } | null = null;
const REFRESH_COOLDOWN_MS = 5000; // 5 segundos

export async function salvarSessao(sessao: Sessao): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, sessao.token);

    if (sessao.refreshToken) {
      // Refresh token sempre guardado com biometria se habilitada, ou no SecureStore padrão
      const bioEnabled = await carregarBiometriaHabilitada();
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, sessao.refreshToken, {
        requireAuthentication: bioEnabled
      });
      await AsyncStorage.setItem(HAS_REFRESH_TOKEN_KEY, 'true');
    }

    await AsyncStorage.setItem(USER_KEY, JSON.stringify(sessao.usuario));

    // Se a biometria estiver habilitada, salvamos também o token persistente (legacy compatibility)
    const bioEnabled = await carregarBiometriaHabilitada();
    if (bioEnabled) {
      await SecureStore.setItemAsync(BIOMETRIC_CREDENTIAL_KEY, sessao.token);
    }
  } catch (e: unknown) {
    logger.error('[Storage.salvarSessao]', toError(e));
  }
}

export async function carregarSessao(): Promise<Sessao | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    // Não carregamos o refreshToken aqui para evitar prompts biométricos desnecessários
    const userJson = await AsyncStorage.getItem(USER_KEY);

    if (!token || !userJson) return null;

    const usuario = JSON.parse(userJson) as Usuario;
    return { token, usuario };
  } catch (e: unknown) {
    logger.error('[Storage.carregarSessao]', toError(e));
    return null;
  }
}

export async function limparSessao(manterBiometria = true): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(HAS_REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(LAST_STRONG_AUTH_AT_KEY);

    if (!manterBiometria) {
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIAL_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIA_SECURE_KEY);
      await AsyncStorage.removeItem(BIOMETRIA_KEY);
    }
  } catch (e: unknown) {
    logger.error('[Storage.limparSessao]', toError(e));
  }
}

export async function salvarLastStrongAuthAt(timestamp = Date.now()): Promise<void> {
  await AsyncStorage.setItem(LAST_STRONG_AUTH_AT_KEY, String(timestamp));
}

export async function carregarLastStrongAuthAt(): Promise<number> {
  const v = await AsyncStorage.getItem(LAST_STRONG_AUTH_AT_KEY);
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function carregarTokenBiometrico(): Promise<string | null> {
  return await SecureStore.getItemAsync(BIOMETRIC_CREDENTIAL_KEY);
}

export function isBiometricPromptCooldownActive(): boolean {
  if (!lastRefreshResult) return false;
  return (Date.now() - lastRefreshResult.timestamp < REFRESH_COOLDOWN_MS);
}

export function isBiometricPromptPending(): boolean {
  return !!pendingRefreshPromise;
}

export async function carregarRefreshToken(): Promise<string | null> {
  const now = Date.now();

  // 1. Se houver um resultado recente em cache (cooldown), retorna ele
  if (lastRefreshResult && (now - lastRefreshResult.timestamp < REFRESH_COOLDOWN_MS)) {
    logger.info('[Storage.carregarRefreshToken] Retornando resultado do cache (cooldown)');
    return lastRefreshResult.token;
  }

  // 2. Se já houver uma solicitação em curso (single-flight), aguarda ela
  if (pendingRefreshPromise) {
    logger.info('[Storage.carregarRefreshToken] Aguardando solicitação pendente (single-flight)');
    return pendingRefreshPromise;
  }

  // 3. Caso contrário, inicia uma nova solicitação
  pendingRefreshPromise = (async () => {
    try {
      const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      lastRefreshResult = { token, timestamp: Date.now() };
      return token;
    } catch (e: unknown) {
      logger.error('[Storage.carregarRefreshToken]', toError(e));
      lastRefreshResult = { token: null, timestamp: Date.now() };
      return null;
    } finally {
      pendingRefreshPromise = null;
    }
  })();

  return pendingRefreshPromise;
}

export async function temRefreshTokenGravado(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(HAS_REFRESH_TOKEN_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function definirBiometriaHabilitada(valor: boolean): Promise<void> {
  const strValor = valor ? 'true' : 'false';
  await AsyncStorage.setItem(BIOMETRIA_KEY, strValor);
  await SecureStore.setItemAsync(BIOMETRIA_SECURE_KEY, strValor);

  if (!valor) {
    await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIAL_KEY);
  } else {
    // Se habilitou, tenta pegar o token atual e salvar como persistente
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      await SecureStore.setItemAsync(BIOMETRIC_CREDENTIAL_KEY, token);
    }
  }
}

export async function carregarBiometriaHabilitada(): Promise<boolean> {
  const vSecure = await SecureStore.getItemAsync(BIOMETRIA_SECURE_KEY);
  if (vSecure !== null) return vSecure === 'true';

  const v = await AsyncStorage.getItem(BIOMETRIA_KEY);
  return v === 'true';
}

export async function salvarUltimoCheckUpdate(): Promise<void> {
  await AsyncStorage.setItem(LAST_UPDATE_CHECK_KEY, Date.now().toString());
}

export async function carregarUltimoCheckUpdate(): Promise<number> {
  const v = await AsyncStorage.getItem(LAST_UPDATE_CHECK_KEY);
  return v ? parseInt(v, 10) : 0;
}
