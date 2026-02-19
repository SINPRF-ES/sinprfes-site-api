const { v4: uuidv4 } = require('uuid');
const log = require('../utils/log');

module.exports = (err, req, res, next) => {
  const errorId = uuidv4().split('-')[0]; // UUID curto
  const status = err.status || 500;
  const requestId = req.requestId || errorId;

  // Sanitização do payload (remover senhas, etc)
  const sanitizeBody = (body) => {
    if (!body) return body;
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'senha', 'token', 'cpf'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) sanitized[field] = '********';
    });
    return sanitized;
  };

  log.error("GLOBAL_ERROR_HANDLER", {
    errorId,
    requestId,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    profile: req.user?.perfil_acesso,
    payload: sanitizeBody(req.body),
    errorMessage: err.message,
    stack: err.stack
  });

  // Detecção proativa de vazamento de erro de DB (Postgres/SQL)
  const isDbError = err.code && (String(err.code).startsWith('23') || String(err.code).startsWith('42'));
  const hasLeakRisk = err?.message && (
    err.message.includes("Failing row") ||
    err.message.includes("violates") ||
    err.message.includes("SQLSTATE") ||
    err.message.includes("check constraint") ||
    err.message.includes("duplicate key")
  );

  let finalMessage = err.message;

  if (status === 500 || isDbError || hasLeakRisk) {
    finalMessage = "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.";
  }

  res.status(status).json({
    success: false,
    message: finalMessage,
    errorId: errorId,
    requestId: requestId,
    code: err.code || "INTERNAL_ERROR"
  });
};
