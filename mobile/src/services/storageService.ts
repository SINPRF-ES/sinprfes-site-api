import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Usuario } from '../types/usuario';
import type { Sessao } from '../types/auth';
import { logger } from '../infra/logger';

const TOKEN_KEY = 'sinprf_secure_token';
const REFRESH_TOKEN_KEY = 'sinprf_refresh_token';
const HAS_REFRESH_TOKEN_KEY = '@sinprf/has_refresh_token';
const USER_KEY = '@sinprf/usuario';
const BIOMETRIA_KEY = '@sinprf/biometria_habilitada'; // Legacy AsyncStorage
const BIOMETRIA_SECURE_KEY = 'sinprf_biometria_enabled'; // Novo SecureStore
const BIOMETRIC_CREDENTIAL_KEY = 'sinprf_biometric_token';
const LAST_UPDATE_CHECK_KEY = '@sinprf/last_update_check';

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
  } catch (e) {
    logger.error('[Storage.salvarSessao]', e);
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
  } catch (e) {
    logger.error('[Storage.carregarSessao]', e);
    return null;
  }
}

export async function limparSessao(manterBiometria = true): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(HAS_REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);

    if (!manterBiometria) {
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIAL_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIA_SECURE_KEY);
      await AsyncStorage.removeItem(BIOMETRIA_KEY);
    }
  } catch (e) {
    logger.error('[Storage.limparSessao]', e);
  }
}

export async function carregarTokenBiometrico(): Promise<string | null> {
  return await SecureStore.getItemAsync(BIOMETRIC_CREDENTIAL_KEY);
}

export async function carregarRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (e) {
    logger.error('[Storage.carregarRefreshToken]', e);
    return null;
  }
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
