// src/services/authStore.ts
import { logger } from '../infra/logger';

/**
 * AuthStore gerencia o estado de inicialização (bootstrap) da autenticação.
 * Isso garante que chamadas protegidas aguardem a restauração da sessão do SecureStore.
 */

let isReady = false;
let resolveReady: (value: void | PromiseLike<void>) => void;
let readyPromise = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

export const AuthStore = {
  /**
   * Indica o início do bootstrap.
   */
  init: () => {
    logger.info('AUTH_BOOTSTRAP_START');
    if (isReady) {
      isReady = false;
      readyPromise = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });
    }
  },

  /**
   * Marca o bootstrap como concluído.
   */
  setReady: () => {
    if (!isReady) {
      isReady = true;
      logger.info('AUTH_BOOTSTRAP_DONE');
      resolveReady();
    }
  },

  /**
   * Retorna se o bootstrap já terminou.
   */
  isReady: () => isReady,

  /**
   * Aguarda a conclusão do bootstrap.
   */
  waitReady: async () => {
    if (isReady) return;
    return readyPromise;
  },

  /**
   * Reset total (útil para testes ou re-inicialização completa).
   */
  reset: () => {
    isReady = false;
    readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
  }
};
