const crypto = require('crypto');

/**
 * Middleware para rastrear requisições com um RequestId único e logar metadados.
 */
module.exports = (req, res, next) => {
  const start = Date.now();

  // Gera requestId (crypto.randomUUID() ou fallback)
  if (!req.requestId) {
    try {
      req.requestId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || crypto.randomUUID();
    } catch (e) {
      req.requestId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || Math.random().toString(36).substring(2, 15);
    }
  }

  res.setHeader('x-request-id', req.requestId);

  // Captura host, origin e outros headers para depuração do Render
  const host = req.headers.host || '-';
  const origin = req.headers.origin || req.headers.referer || '-';
  const userAgent = req.headers['user-agent'] || '-';
  const xForwardedHost = req.headers['x-forwarded-host'] || '-';
  const xForwardedProto = req.headers['x-forwarded-proto'] || '-';

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[REQ][${req.requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms | host: ${host} | origin: ${origin} | ua: ${userAgent} | x-f-host: ${xForwardedHost} | x-f-proto: ${xForwardedProto}`);
  });

  next();
};
