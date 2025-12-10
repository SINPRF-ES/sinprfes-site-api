// src/utils/log.js

/**
 * Utilitário de Log Estruturado (JSON)
 * Facilita a leitura em plataformas como Render, Railway, Datadog, etc.
 */

const log = {
  /**
   * Log de Informação (Sucesso, Fluxo normal)
   * @param {string} message - Mensagem curta do evento
   * @param {object} meta - Dados adicionais (ex: { userId: 1, action: 'LOGIN' })
   */
  info: (message, meta = {}) => {
    console.log(
      JSON.stringify({
        level: "INFO",
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      })
    );
  },

  /**
   * Log de Erro (Exceções, Falhas)
   * @param {string} message - Mensagem curta do erro
   * @param {object|Error} errorOrMeta - Objeto de erro ou metadados
   */
  error: (message, errorOrMeta = {}) => {
    let meta = {};

    // Se passou um objeto Error nativo, extrai stack e message
    if (errorOrMeta instanceof Error) {
      meta = {
        errorMessage: errorOrMeta.message,
        stack: errorOrMeta.stack,
      };
    } else {
      meta = errorOrMeta;
    }

    console.error(
      JSON.stringify({
        level: "ERROR",
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      })
    );
  },

  /**
   * Log de Alerta (Situações inesperadas mas não críticas)
   */
  warn: (message, meta = {}) => {
    console.warn(
      JSON.stringify({
        level: "WARN",
        timestamp: new Date().toISOString(),
        message,
        ...meta,
      })
    );
  },
};

module.exports = log;