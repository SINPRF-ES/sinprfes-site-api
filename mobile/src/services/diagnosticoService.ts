import api from './apiService';
import { logDebug } from '../utils/filiadoUtils';
import { carregarSessao } from './storageService';

export interface LogPayload {
  source: string;
  event: string;
  meta: Record<string, any>;
}

/**
 * Envia logs de diagnóstico do mobile para o backend.
 */
export const enviarLogDiagnostico = async (payload: LogPayload): Promise<void> => {
  try {
    const sessao = await carregarSessao();
    if (!sessao?.token) {
      logDebug('DiagnosticoService.skip', { event: payload.event, reason: 'no_token' });
      return;
    }

    await api.post('/api/diagnostico/log', payload);
    logDebug('DiagnosticoService.success', { event: payload.event });
  } catch (error: any) {
    logDebug('DiagnosticoService.error', {
      event: payload.event,
      message: error.message
    });
    // Não lançamos erro aqui para evitar que falhas no log travem o app
  }
};
