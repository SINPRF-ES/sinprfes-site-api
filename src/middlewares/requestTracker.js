const { v4: uuidv4 } = require('uuid');

/**
 * Middleware para rastrear requisições com um RequestId único.
 * Injeta 'requestId' no objeto 'req' para uso em logs.
 */
module.exports = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
