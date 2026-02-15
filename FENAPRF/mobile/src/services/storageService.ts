import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { logger } from '../infra/logger';

const SESSION_KEY = "fenaprf_session";
const BIOMETRIA_KEY = '@fenaprf/biometria_habilitada';
const BIOMETRIA_SECURE_KEY = 'fenaprf_biometria_enabled';
const LAST_UPDATE_CHECK_KEY = '@fenaprf/last_update_check';

function assertString(name: string, value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`[Storage] ${name} inválido: ${String(value)}`);
  }
}

function safeJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/**
 * Salva a sessão no armazenamento seguro.
 * FENAPRF: Usa JSON.stringify para garantir que apenas strings sejam enviadas ao SecureStore.
 */
export async function salvarSessao(
  token: string,
  refreshToken: string,
  user: any
): Promise<void> {
  try {
    assertString("token", token);
    assertString("refreshToken", refreshToken);

    const payload = {
      token,
      refreshToken,
      user: user ?? null,
      savedAt: Date.now()
    };

    await SecureStore.setItemAsync(
      SESSION_KEY,
      safeJson(payload)
    );
  } catch (e) {
    logger.error('[Storage.salvarSessao]', e);
    throw e;
  }
}

/**
 * Carrega a sessão completa.
 */
export async function carregarSessao(): Promise<any> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
  } catch (e) {
    logger.error('[Storage.carregarSessao]', e);
    return null;
  }
}

/**
 * Limpa a sessão.
 */
export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch (e) {
    logger.error('[Storage.clearSession]', e);
  }
}

/**
 * Legado/Compatibilidade: Limpar sessão com opção de manter biometria.
 */
export async function limparSessao(manterBiometria = true): Promise<void> {
  await clearSession();
  if (!manterBiometria) {
    await SecureStore.deleteItemAsync(BIOMETRIA_SECURE_KEY);
    await AsyncStorage.removeItem(BIOMETRIA_KEY);
  }
}

export async function definirBiometriaHabilitada(valor: boolean): Promise<void> {
  const strValor = valor ? 'true' : 'false';
  await AsyncStorage.setItem(BIOMETRIA_KEY, strValor);
  await SecureStore.setItemAsync(BIOMETRIA_SECURE_KEY, String(strValor));
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

// Mantendo para compatibilidade se necessário, mas useAuth deve migrar para carregarSessao
export async function carregarRefreshToken(): Promise<string | null> {
  const sessao = await carregarSessao();
  return sessao?.refreshToken || null;
}
