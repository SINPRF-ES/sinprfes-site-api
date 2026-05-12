// mobile/src/services/deviceService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './apiService';
import { AuthStore } from './authStore';
import { logger } from '../infra/logger';
import { API_BASE_URL, APP_SCOPE } from '../config/env';
import { getExpoProjectId } from '../utils/expoConfig';
import { toError } from '../infra/errorUtils';

const PUSH_REGISTRATION_META_KEY = 'push_registration_meta_v1';

async function shouldRegisterToken(token: string, expoProjectId?: string, force = false): Promise<boolean> {
  if (force) return true;

  try {
    const raw = await AsyncStorage.getItem(PUSH_REGISTRATION_META_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed?.token !== token || parsed?.expoProjectId !== expoProjectId;
  } catch (error) {
    logger.warn('Push info: erro ao ler metadados locais de registro', { error: toError(error).message });
    return true;
  }
}

async function persistRegisteredTokenMeta(token: string, expoProjectId?: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_REGISTRATION_META_KEY, JSON.stringify({ token, expoProjectId, updatedAt: new Date().toISOString() }));
  } catch (error) {
    logger.warn('Push info: erro ao persistir metadados locais de registro', { error: toError(error).message });
  }
}


function maskToken(token: string | null): string {
  if (!token) return 'null';
  if (token.length < 15) return '***';
  return `${token.substring(0, 10)}...${token.slice(-4)}`;
}

/**
 * Obtém o token de push do Expo para este dispositivo.
 */
export async function obterExpoPushToken(): Promise<{ token: string | null; platform: string; permission: string; projectId?: string; expoProjectId?: string; deviceId?: string }> {
  if (!Device.isDevice) {
    logger.info('Push info: Dispositivo físico não detectado (Emulador)');
    return { token: null, platform: `EMULATOR_${Platform.OS}`, permission: 'undetermined' };
  }

  let deviceId = 'unknown';
  try {
    if (Platform.OS === 'android') {
      deviceId = (await Application.getAndroidId()) || 'unknown_android';
    } else if (Platform.OS === 'ios') {
      deviceId = (await Application.getIosIdForVendorAsync()) || 'unknown_ios';
    }
  } catch (err) {
    logger.warn('Push info: Erro ao obter deviceId', { error: toError(err).message });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    logger.warn('Push info: Permissão negada para notificações push', { finalStatus });
    return { token: null, platform: Platform.OS, permission: finalStatus, deviceId };
  }

  const easProjectId = getExpoProjectId();

  if (__DEV__) {
    logger.info('Push info: EAS Project ID resolvido', { easProjectId });
  }

  try {
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId });
    return { token: expoToken.data, platform: Platform.OS, permission: finalStatus, projectId: easProjectId, expoProjectId: easProjectId, deviceId };
  } catch (error: unknown) {
    logger.error('Push info: Erro ao obter o Expo Push Token', toError(error));
    return { token: null, platform: Platform.OS, permission: finalStatus, projectId: easProjectId, expoProjectId: easProjectId, deviceId };
  }
}

/**
 * Registra o dispositivo no backend para receber notificações push.
 */
type PushRegisterResult = {
  success?: boolean;
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  message?: string;
  hint?: string;
  requestId?: string;
  error?: string;
  data?: { error?: string; requestId?: string; [key: string]: unknown };
  status?: unknown;
};

export async function registrarDispositivoParaPush(options?: { force?: boolean }): Promise<PushRegisterResult> {
  // Aguarda inicialização da sessão antes de registrar push (exige token)
  await AuthStore.waitReady();

  const endpoint = '/api/push/register';
  try {
    const { token, platform, permission, projectId, expoProjectId, deviceId } = await obterExpoPushToken();
    const force = !!options?.force;
    const tokenMasked = maskToken(token);

    logger.info('Iniciando registro de dispositivo para push', {
      platform,
      permission,
      projectId,
      expoProjectId,
      deviceId,
      tokenMasked,
      apiUrl: `${API_BASE_URL}${endpoint}`
    });

    if (!token) {
      logger.info('Registro de push cancelado: token não disponível');
      return { ok: false, reason: 'no_token', message: 'Token de push não pôde ser obtido.' };
    }

    const mustRegister = await shouldRegisterToken(token, expoProjectId || projectId, force);
    if (!mustRegister) {
      logger.info('Registro de push ignorado: token/projeto inalterados localmente');
      return { success: true, ok: true, skipped: true, reason: 'unchanged_local' };
    }

    const response = await api.post(endpoint, {
      expoPushToken: token,
      platform,
      permissionStatus: permission,
      projectId: projectId || expoProjectId, // Legacy/EAS Project ID
      appScope: APP_SCOPE,
      expoProjectId: expoProjectId || projectId, // Canonical name requested
      deviceId
    });

    const result = response.data;

    if (result.success && result.ok !== false) {
      logger.info('Dispositivo registrado para notificações push com sucesso', {
        status: response.status,
        success: result.success
      });
    } else {
      logger.warn('Dispositivo registrado com ressalvas no backend', {
        ok: result.ok,
        reason: result.reason,
        message: result.message
      });
    }

    if (result.success && result.ok !== false) {
      await persistRegisteredTokenMeta(token, expoProjectId || projectId);
    }

    return result;

  } catch (e: unknown) {
    const maybeError = e as { response?: { status?: unknown; data?: unknown; headers?: Record<string, unknown> }; message?: string };
    const status = maybeError.response?.status;
    const errorData = maybeError.response?.data;
    const rawRequestId = maybeError.response?.headers?.['x-request-id'];
    const requestId = typeof rawRequestId === 'string' ? rawRequestId : undefined;
    const err = toError(e);

    logger.warn('Falha ao registrar dispositivo para push (best-effort)', {
      errorMessage: err.message,
      status,
      errorData,
      requestId,
      apiUrl: `${API_BASE_URL}${endpoint}`
    });
    // Não relançar o erro para não bloquear o fluxo de login, mas retornar erro para o diagnóstico.
    const data =
      typeof errorData === 'object' && errorData !== null
        ? (errorData as { error?: string; requestId?: string; [key: string]: unknown })
        : undefined;
    return { ok: false, error: err.message, status, data, requestId };
  }
}
