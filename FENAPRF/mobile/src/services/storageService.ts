import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types/user';
import type { Sessao } from '../types/auth';
import { logger } from '../infra/logger';

const TOKEN_KEY = 'fenaprf_secure_token';
const REFRESH_TOKEN_KEY = 'fenaprf_refresh_token';
const USER_KEY = '@fenaprf/user';
const BIOMETRIA_KEY = '@fenaprf/biometria_habilitada';
const BIOMETRIA_SECURE_KEY = 'fenaprf_biometria_enabled';
const LAST_UPDATE_CHECK_KEY = '@fenaprf/last_update_check';

/**
 * Salva a sessão no armazenamento seguro.
 * Se a biometria estiver habilitada, o Refresh Token é salvo com exigência de autenticação.
 */
export async function salvarSessao(sessao: Sessao): Promise<void> {
  try {
    // FENAPRF: Garantir que tudo que vai para SecureStore é string robusta
    const tokenStr = sessao.token ? String(sessao.token) : '';
    const refreshStr = sessao.refreshToken ? String(sessao.refreshToken) : '';

    await SecureStore.setItemAsync(TOKEN_KEY, tokenStr);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(sessao.user));

    const bioEnabled = await carregarBiometriaHabilitada();

    // Refresh Token: Se biometria ativa, exige FaceID/Digital para ler
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshStr, {
      requireAuthentication: bioEnabled
    });

  } catch (e) {
    logger.error('[Storage.salvarSessao]', e);
  }
}

/**
 * Carrega a sessão básica (AccessToken + User).
 * O Refresh Token é carregado sob demanda para evitar prompts desnecessários.
 */
export async function carregarSessao(): Promise<Partial<Sessao> | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const userJson = await AsyncStorage.getItem(USER_KEY);

    if (!token || !userJson) return null;

    try {
      const user = JSON.parse(userJson) as User;
      return { token: String(token), user };
    } catch (parseErr) {
      logger.error('[Storage.carregarSessao] JSON parse error', parseErr);
      return null;
    }
  } catch (e) {
    logger.error('[Storage.carregarSessao]', e);
    return null;
  }
}

/**
 * Tenta carregar o Refresh Token. Se biometria estiver ativa para este item,
 * o sistema operacional mostrará o prompt de autenticação.
 */
export async function carregarRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (e) {
    // Pode falhar se o usuário cancelar a biometria
    logger.warn('[Storage.carregarRefreshToken] Falha ao ler refresh token (possível cancelamento bio)');
    return null;
  }
}

export async function limparSessao(manterBiometria = true): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);

    if (!manterBiometria) {
      await SecureStore.deleteItemAsync(BIOMETRIA_SECURE_KEY);
      await AsyncStorage.removeItem(BIOMETRIA_KEY);
    }
  } catch (e) {
    logger.error('[Storage.limparSessao]', e);
  }
}

export async function definirBiometriaHabilitada(valor: boolean): Promise<void> {
  const strValor = valor ? 'true' : 'false';
  await AsyncStorage.setItem(BIOMETRIA_KEY, strValor);
  await SecureStore.setItemAsync(BIOMETRIA_SECURE_KEY, String(strValor));

  // Re-salva o refresh token com a nova política de segurança
  const rt = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (rt) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, String(rt), {
      requireAuthentication: valor
    });
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
