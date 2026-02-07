import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types/user';
import type { Sessao } from '../types/auth';
import { logger } from '../infra/logger';

const TOKEN_KEY = 'sinprf_secure_token';
const USER_KEY = '@sinprf/user';
const BIOMETRIA_KEY = '@sinprf/biometria_habilitada'; // Legacy AsyncStorage
const BIOMETRIA_SECURE_KEY = 'sinprf_biometria_enabled'; // Novo SecureStore
const BIOMETRIC_CREDENTIAL_KEY = 'sinprf_biometric_token';
const LAST_UPDATE_CHECK_KEY = '@sinprf/last_update_check';

export async function salvarSessao(sessao: Sessao): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, sessao.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(sessao.user));

    // Se a biometria estiver habilitada, salvamos também o token persistente
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
    const userJson = await AsyncStorage.getItem(USER_KEY);

    if (!token || !userJson) return null;

    const user = JSON.parse(userJson) as User;
    return { token, user };
  } catch (e) {
    logger.error('[Storage.carregarSessao]', e);
    return null;
  }
}

export async function limparSessao(manterBiometria = true): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
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
