const { v4: uuidv4 } = require('uuid');

/**
 * Middleware para rastrear requisições com um RequestId único.
 * Injeta 'requestId' no objeto 'req' para uso em logs.
 */
module.exports = (req, res, next) => {
  // Mantém consistência com o requestId.js se já foi definido
  req.requestId = req.requestId || req.headers['x-correlation-id'] || req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
};
