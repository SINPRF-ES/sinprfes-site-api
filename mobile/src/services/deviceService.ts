// src/services/deviceService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './apiService';
import { logger } from '../infra/logger';

/**
 * Obtém o token de push do Expo para este dispositivo.
 */
async function obterExpoPushToken(): Promise<{ token: string | null; platform: string }> {
  if (!Device.isDevice) {
    console.warn('Push notifications estão disponíveis apenas em dispositivos físicos.');
    return { token: null, platform: `EMULATOR_${Platform.OS}` };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Permissão para notificações push foi negada.');
    return { token: null, platform: Platform.OS };
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      throw new Error('ID do projeto Expo não encontrado na configuração.');
    }
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: expoToken.data, platform: Platform.OS };
  } catch (error) {
    console.error('Erro ao obter o Expo Push Token:', error);
    return { token: null, platform: Platform.OS };
  }
}

/**
 * Registra o dispositivo no backend para receber notificações push.
 */
export async function registrarDispositivoParaPush(): Promise<void> {
  try {
    const { token, platform } = await obterExpoPushToken();
    if (!token) {
      logger.info('Push token não disponível. Registro de push ignorado.');
      return;
    }

    await api.post('/api/push/register', {
      expoPushToken: token,
      platform,
    });

    logger.info('Dispositivo registrado para notificações push com sucesso.');

  } catch (e: any) {
    logger.warn('Falha ao registrar dispositivo para push (best-effort)', {
      errorMessage: e.message,
    });
    // Não relançar o erro para não bloquear o fluxo de login.
  }
}
