// mobile/src/infra/logger.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const LOGS_KEY = '@app_logs';
const MAX_LOGS = 200;

// Correlation ID por sessão
const SESSION_ID = Math.random().toString(36).substring(2, 10).toUpperCase();

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  stack?: string;
  sessionId: string;
  platform: string;
  version: string;
}

const sanitizeMeta = (meta?: Record<string, any>): Record<string, any> | undefined => {
  if (!meta) return undefined;
  const sanitized = { ...meta };
  const sensitiveKeys = ['cpf', 'telefone', 'telefone1', 'telefone2', 'token', 'authorization', 'password', 'email', 'senha'];

  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      const val = String(sanitized[key]);
      if (val.length > 4) {
        sanitized[key] = `***${val.slice(-2)} (masked)`;
      } else {
        sanitized[key] = '*** (masked)';
      }
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeMeta(sanitized[key]);
    }
  });
  return sanitized;
};

const log = async (level: LogLevel, message: string, meta?: Record<string, unknown>, error?: Error): Promise<void> => {
  const sanitizedMeta = sanitizeMeta(meta);

  const newLogEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta: sanitizedMeta,
    stack: error?.stack,
    sessionId: SESSION_ID,
    platform: Platform.OS,
    version: Constants.expoConfig?.version || '1.0.0',
  };

  // Em ambiente de desenvolvimento, o erro já será impresso pelo errorHandling.ts.
  // Evitamos chamar console.error() aqui para não criar um loop.

  try {
    const existingLogsJson = await AsyncStorage.getItem(LOGS_KEY);
    const existingLogs: LogEntry[] = existingLogsJson ? JSON.parse(existingLogsJson) : [];

    // Mantém a lista de logs com um tamanho máximo
    const updatedLogs = [newLogEntry, ...existingLogs].slice(0, MAX_LOGS);

    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(updatedLogs));
  } catch (e) {
    console.error('Failed to save log to AsyncStorage:', e);
  }
};

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('INFO', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('WARN', message, meta),
  error: (message: string, error?: Error, meta?: Record<string, unknown>) => log('ERROR', message, meta, error),
};

/**
 * Helper unificado para log de erros com contexto.
 * @param context Nome da tela ou ação onde o erro ocorreu
 * @param err O objeto de erro capturado
 * @param meta Dados adicionais para depuração (evitar PII)
 */
export const logError = (context: string, err: any, meta?: Record<string, unknown>) => {
  const message = `[${context}] ${err?.message || 'Unknown Error'}`;
  logger.error(message, err instanceof Error ? err : new Error(String(err)), meta);
};

export const getLogs = async (): Promise<LogEntry[]> => {
  try {
    const logsJson = await AsyncStorage.getItem(LOGS_KEY);
    return logsJson ? JSON.parse(logsJson) : [];
  } catch (e) {
    console.error('Failed to retrieve logs from AsyncStorage:', e);
    return [];
  }
};

export const getLogsAsText = async (): Promise<string> => {
    const logs = await getLogs();
    return logs.map(log =>
      `[${log.timestamp}] [${log.level}] [SID:${log.sessionId}] [${log.platform}] ${log.message}` +
      (log.meta ? `\n  Meta: ${JSON.stringify(log.meta)}` : '') +
      (log.stack ? `\n  Stack: ${log.stack}` : '')
    ).join('\n\n');
};


export const clearLogs = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(LOGS_KEY);
  } catch (e) {
    console.error('Failed to clear logs from AsyncStorage:', e);
  }
};
