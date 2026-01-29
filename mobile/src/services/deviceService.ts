// mobile/src/services/deviceService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './apiService';
import { logger } from '../infra/logger';
import { API_BASE_URL } from '../config/env';

function maskToken(token: string | null): string {
  if (!token) return 'null';
  if (token.length < 15) return '***';
  return `${token.substring(0, 10)}...${token.slice(-4)}`;
}

/**
 * Obtém o token de push do Expo para este dispositivo.
 */
async function obterExpoPushToken(): Promise<{ token: string | null; platform: string; permission: string }> {
  if (!Device.isDevice) {
    logger.info('Push info: Dispositivo físico não detectado (Emulador)');
    return { token: null, platform: `EMULATOR_${Platform.OS}`, permission: 'undetermined' };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    logger.warn('Push info: Permissão negada para notificações push', { finalStatus });
    return { token: null, platform: Platform.OS, permission: finalStatus };
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      throw new Error('ID do projeto Expo não encontrado na configuração.');
    }
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: expoToken.data, platform: Platform.OS, permission: finalStatus };
  } catch (error: any) {
    logger.error('Push info: Erro ao obter o Expo Push Token', error);
    return { token: null, platform: Platform.OS, permission: finalStatus };
  }
}

/**
 * Registra o dispositivo no backend para receber notificações push.
 */
export async function registrarDispositivoParaPush(): Promise<void> {
  const endpoint = '/api/push/register';
  try {
    const { token, platform, permission } = await obterExpoPushToken();
    const tokenMasked = maskToken(token);

    logger.info('Iniciando registro de dispositivo para push', {
        platform,
        permission,
        tokenMasked,
        apiUrl: `${API_BASE_URL}${endpoint}`
    });

    if (!token) {
      logger.info('Registro de push cancelado: token não disponível');
      return;
    }

    const response = await api.post(endpoint, {
      expoPushToken: token,
      platform,
    });

    logger.info('Dispositivo registrado para notificações push com sucesso', {
        status: response.status,
        success: response.data?.success
    });

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
    // Não relançar o erro para não bloquear o fluxo de login.
  }
}
