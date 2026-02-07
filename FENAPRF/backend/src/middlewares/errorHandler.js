const { v4: uuidv4 } = require('uuid');
const log = require('../utils/log');

module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  const requestId = req.requestId || uuidv4().split('-')[0];

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

  // Log estruturado
  log.error("GLOBAL_ERROR_HANDLER", {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    payload: sanitizeBody(req.body),
    errorMessage: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code
  });

  // Log explícito no console para o Render (conforme solicitado)
  console.error(`[ERR][${requestId}] ${req.method} ${req.originalUrl}: ${err?.stack || err}`);

  if (status === 500) {
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      requestId: requestId
    });
  }

  res.status(status).json({
    error: err.code || "ERROR",
    message: err.message,
    requestId: requestId
  });
};
