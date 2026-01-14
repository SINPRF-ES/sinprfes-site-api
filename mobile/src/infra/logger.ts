// mobile/src/infra/logger.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGS_KEY = '@app_logs';
const MAX_LOGS = 200;

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  stack?: string;
}

const log = async (level: LogLevel, message: string, meta?: Record<string, unknown>, error?: Error): Promise<void> => {
  const newLogEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta,
    stack: error?.stack,
  };

  // Em ambiente de desenvolvimento, imprimir no console para depuração
  if (__DEV__) {
    console[level.toLowerCase()]?.(message, { ...meta, stack: error?.stack });
  }

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
      `[${log.timestamp}] [${log.level}] ${log.message}` +
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
