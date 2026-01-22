import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Usuario } from '../types/usuario';
import type { Sessao } from '../types/auth';
import { logger } from '../infra/logger';

const TOKEN_KEY = 'sinprf_secure_token'; // No prefix with @ for SecureStore usually
const USER_KEY = '@sinprf/usuario';
const BIOMETRIA_KEY = '@sinprf/biometria_habilitada';

export async function salvarSessao(sessao: Sessao): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, sessao.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(sessao.usuario));
  } catch (e) {
    logger.error('[Storage.salvarSessao]', e);
  }
}

export async function carregarSessao(): Promise<Sessao | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const userJson = await AsyncStorage.getItem(USER_KEY);

    if (!token || !userJson) return null;

    const usuario = JSON.parse(userJson) as Usuario;
    return { token, usuario };
  } catch (e) {
    logger.error('[Storage.carregarSessao]', e);
    return null;
  }
}

export async function limparSessao(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  } catch (e) {
    logger.error('[Storage.limparSessao]', e);
  }
}

export async function definirBiometriaHabilitada(valor: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIA_KEY, valor ? 'true' : 'false');
}

export async function carregarBiometriaHabilitada(): Promise<boolean> {
  const v = await AsyncStorage.getItem(BIOMETRIA_KEY);
  return v === 'true';
}
