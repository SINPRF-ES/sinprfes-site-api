// mobile/src/services/deviceService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import api from './apiService';
import { AuthStore } from './authStore';
import { logger } from '../infra/logger';
import { API_BASE_URL, APP_SCOPE } from '../config/env';
import { getExpoProjectId } from '../utils/expoConfig';

function maskToken(token: string | null): string {
  if (!token) return 'null';
  if (token.length < 15) return '***';
  return `${token.substring(0, 10)}...${token.slice(-4)}`;
}

/**
 * Obtém o token de push do Expo para este dispositivo.
 */
export async function obterExpoPushToken(): Promise<{ token: string | null; platform: string; permission: string; projectId?: string; deviceId?: string }> {
  if (!Device.isDevice) {
    logger.info('Push info: Dispositivo físico não detectado (Emulador)');
    return { token: null, platform: `EMULATOR_${Platform.OS}`, permission: 'undetermined' };
  }

  let deviceId = 'unknown';
  try {
    if (Platform.OS === 'android') {
      deviceId = Application.androidId || 'unknown_android';
    } else if (Platform.OS === 'ios') {
      deviceId = (await Application.getIosIdForVendorAsync()) || 'unknown_ios';
    }
  } catch (err) {
    logger.warn('Push info: Erro ao obter deviceId', err);
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
    return { token: expoToken.data, platform: Platform.OS, permission: finalStatus, projectId: easProjectId, deviceId };
  } catch (error: any) {
    logger.error('Push info: Erro ao obter o Expo Push Token', error);
    return { token: null, platform: Platform.OS, permission: finalStatus, projectId: easProjectId, deviceId };
  }
}

/**
 * Registra o dispositivo no backend para receber notificações push.
 */
export async function registrarDispositivoParaPush(): Promise<any> {
  // Aguarda inicialização da sessão antes de registrar push (exige token)
  await AuthStore.waitReady();

  const endpoint = '/api/push/register';
  try {
    const { token, platform, permission, projectId, deviceId } = await obterExpoPushToken();
    const tokenMasked = maskToken(token);

    logger.info('Iniciando registro de dispositivo para push', {
      platform,
      permission,
      projectId,
      deviceId,
      tokenMasked,
      apiUrl: `${API_BASE_URL}${endpoint}`
    });

    if (!token) {
      logger.info('Registro de push cancelado: token não disponível');
      return { ok: false, reason: 'no_token', message: 'Token de push não pôde ser obtido.' };
    }

    const response = await api.post(endpoint, {
      expoPushToken: token,
      platform,
      permissionStatus: permission,
      projectId, // Legacy/EAS Project ID
      appScope: APP_SCOPE,
      expoProjectId: projectId, // Canonical name requested
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

    return result;

  } catch (e: any) {
    const status = e.response?.status;
    const errorData = e.response?.data;
    const requestId = e.response?.headers?.['x-request-id'];

    logger.warn('Falha ao registrar dispositivo para push (best-effort)', {
      errorMessage: e.message,
      status,
      errorData,
      requestId,
      apiUrl: `${API_BASE_URL}${endpoint}`
    });
    // Não relançar o erro para não bloquear o fluxo de login, mas retornar erro para o diagnóstico.
    return { ok: false, error: e.message, status, data: errorData };
  }
}
