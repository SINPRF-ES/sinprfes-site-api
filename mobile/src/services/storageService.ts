import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Usuario } from '../types/usuario';
import type { Sessao } from '../types/auth';

const TOKEN_KEY = '@sinprf/token';
const USER_KEY = '@sinprf/usuario';
const BIOMETRIA_KEY = '@sinprf/biometria_habilitada';

export async function salvarSessao(sessao: Sessao): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, sessao.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(sessao.usuario));
}

export async function carregarSessao(): Promise<Sessao | null> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const userJson = await AsyncStorage.getItem(USER_KEY);

  if (!token || !userJson) return null;

  const usuario = JSON.parse(userJson) as Usuario;
  return { token, usuario };
}

export async function limparSessao(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function definirBiometriaHabilitada(valor: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIA_KEY, valor ? 'true' : 'false');
}

export async function carregarBiometriaHabilitada(): Promise<boolean> {
  const v = await AsyncStorage.getItem(BIOMETRIA_KEY);
  return v === 'true';
}
