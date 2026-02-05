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

  res.status(status).json({
    success: false,
    message: status === 500 ? "Erro interno no servidor." : err.message,
    errorId: errorId,
    requestId: requestId,
    code: err.code || "INTERNAL_ERROR"
  });
};
