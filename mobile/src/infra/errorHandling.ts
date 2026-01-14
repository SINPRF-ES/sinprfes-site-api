// mobile/src/infra/errorHandling.ts
import { logger } from './logger';

// Polyfill para unhandledrejection, se necessário
// import 'unhandled-rejection/register';

export const setupGlobalErrorHandling = () => {
  // Captura de erros fatais de JavaScript
  if (ErrorUtils) {
    const defaultHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
      logger.error('Global Error', error, { isFatal });

      // Chama o handler original (que geralmente exibe a tela vermelha)
      if (defaultHandler) {
        defaultHandler(error, isFatal);
      }
    });
  }

  // Captura de promises não tratadas
  // Nota: A disponibilidade e o comportamento podem variar com o motor de JS (Hermes)
  const rejectionHandler = (id: string, error: Error) => {
    logger.error(`Unhandled Promise Rejection: ${id}`, error);
  };

  // Exemplo de como registrar o handler. O método exato pode variar.
  // Se estiver usando o 'unhandled-rejection' polyfill:
  // process.on('unhandledRejection', (reason, promise) => { ... });

  // Para Hermes, a captura pode já ser coberta pelo ErrorUtils.
  // Por simplicidade, vamos interceptar o console.error como fallback.

  // Intercepta console.error para garantir que erros sejam logados
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    try {
        const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
        const error = args.find(arg => arg instanceof Error) as Error | undefined;
        logger.error(`Console Error: ${message}`, error);
    } catch (e) {
        // Evita loop infinito se o próprio logger falhar
    }
    originalConsoleError.apply(console, args);
  };

  logger.info('Global error handling has been set up.');
};
