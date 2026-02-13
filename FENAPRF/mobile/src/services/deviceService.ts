// FENAPRF - deviceService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './apiService';
import { logger } from '../infra/logger';
import { API_BASE_URL } from '../config/env';
import { getStableDeviceId } from '../utils/deviceId';

/**
 * Obtém o token de push do Expo para este dispositivo.
 */
async function obterExpoPushToken(): Promise<{ token: string | null; platform: string; permission: string }> {
  if (!Device.isDevice) {
    return { token: null, platform: `EMULATOR_${Platform.OS}`, permission: 'undetermined' };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return { token: null, platform: Platform.OS, permission: finalStatus };
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: expoToken.data, platform: Platform.OS, permission: finalStatus };
  } catch (error: any) {
    logger.error('Push.Token.Error', error);
    return { token: null, platform: Platform.OS, permission: finalStatus };
  }
}

/**
 * Obtém um identificador único para o dispositivo (alias para utility).
 */
export async function getDeviceId(): Promise<string> {
    return await getStableDeviceId();
}

/**
 * Registra o dispositivo no backend para receber notificações push.
 */
export async function registrarDispositivoParaPush(): Promise<void> {
  const endpoint = '/api/push/register';
  try {
    const { token, platform, permission } = await obterExpoPushToken();
    const deviceId = await getDeviceId();

    if (!token && permission !== 'denied') return;

    await api.post(endpoint, {
      expoPushToken: token,
      platform,
      deviceId,
      permissionStatus: permission
    });

  } catch (e: any) {
    logger.warn('Push.RegisterDevice.FAIL', {
      errorMessage: e.message,
      status: e.response?.status
    });
  }
}
