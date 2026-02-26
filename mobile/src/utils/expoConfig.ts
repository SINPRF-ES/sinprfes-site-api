import Constants from 'expo-constants';
import { logger } from '../infra/logger';

const SINDICATO_EAS_PROJECT_ID = 'c589a042-895e-497e-a61f-a76216580a35';

/**
 * Obtém o ID do projeto EAS (Expo Application Services) em runtime.
 * Prioriza Constants.easConfig e depois Constants.expoConfig?.extra?.eas.
 */
export function getExpoProjectId(): string | undefined {
  const easProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants.easConfig as any)?.projectId;

  if (!easProjectId) {
    logger.error('Push info: ID do projeto Expo não encontrado na configuração. Usando fallback hard-coded para evitar token sem projectId.', {
      fallbackProjectId: SINDICATO_EAS_PROJECT_ID,
    });
    return SINDICATO_EAS_PROJECT_ID;
  }

  return easProjectId;
}
