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

  // Intercepta console.error para garantir que erros sejam logados, evitando loops
  const originalConsoleError = console.error;
  let isHandlingConsoleError = false;

  console.error = (...args: unknown[]) => {
    // Chama o original imediatamente para que o erro apareça no Metro
    originalConsoleError.apply(console, args);

    // Guard para prevenir recursão
    if (isHandlingConsoleError) {
      return;
    }

    isHandlingConsoleError = true;

    try {
      const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
      const error = args.find(arg => arg instanceof Error) as Error | undefined;
      // O logger agora não causa mais recursão, mas o guard é uma boa prática
      logger.error(`Console Error: ${message}`, error);
    } catch (e) {
      // Se o logger falhar, pelo menos o erro original foi impresso
      originalConsoleError('Falha ao registrar log de erro:', e);
    } finally {
      isHandlingConsoleError = false;
    }
  };

  logger.info('Global error handling has been set up.');
};
