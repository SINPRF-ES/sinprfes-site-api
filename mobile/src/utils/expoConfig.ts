import Constants from 'expo-constants';
import { logger } from '../infra/logger';

/**
 * Obtém o ID do projeto EAS (Expo Application Services) em runtime.
 * Prioriza Constants.easConfig e depois Constants.expoConfig?.extra?.eas.
 */
export function getExpoProjectId(): string | undefined {
  const easProjectId =
    (Constants.easConfig as any)?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!easProjectId) {
    logger.warn('Push info: ID do projeto Expo não encontrado na configuração (Constants.easConfig ou extra.eas).');
  }

  return easProjectId;
}
