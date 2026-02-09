// FENAPRF - deviceService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
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
  logger.info('Push.Init', { isDevice: Device.isDevice });

  if (!Device.isDevice) {
    logger.info('Push.Init: Dispositivo físico não detectado (Emulador)');
    return { token: null, platform: `EMULATOR_${Platform.OS}`, permission: 'undetermined' };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  logger.info('Push.Permission', { status: finalStatus });

  if (finalStatus !== 'granted') {
    return { token: null, platform: Platform.OS, permission: finalStatus };
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      throw new Error('ID do projeto Expo não encontrado na configuração.');
    }
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });

    logger.info('Push.Token', { token: maskToken(expoToken.data) });

    return { token: expoToken.data, platform: Platform.OS, permission: finalStatus };
  } catch (error: any) {
    logger.error('Push.Token.Error', error);
    return { token: null, platform: Platform.OS, permission: finalStatus };
  }
}

/**
 * Obtém um identificador único para o dispositivo.
 */
export async function getDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      return (Application as any).androidId || null;
    } else if (Platform.OS === 'ios') {
      return await Application.getIosIdForVendorAsync();
    }
    return null;
  } catch (error) {
    logger.error('Erro ao obter Device ID', error);
    return null;
  }
}

/**
 * Registra o dispositivo no backend para receber notificações push.
 */
export async function registrarDispositivoParaPush(): Promise<void> {
  const endpoint = '/api/push/register';
  try {
    const { token, platform, permission } = await obterExpoPushToken();

    if (!token) {
      logger.info('Push.RegisterDevice.Skip: token não disponível');
      return;
    }

    const response = await api.post(endpoint, {
      expoPushToken: token,
      platform,
    });

    logger.info('Push.RegisterDevice.OK', {
        status: response.status,
        success: response.data?.success
    });

  } catch (e: any) {
    logger.warn('Push.RegisterDevice.FAIL', {
      errorMessage: e.message,
      status: e.response?.status,
      apiUrl: `${API_BASE_URL}${endpoint}`
    });
  }
}
