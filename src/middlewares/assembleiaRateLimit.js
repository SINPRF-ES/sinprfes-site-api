const rateLimit = require('express-rate-limit');

const assemblyCommandLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs for commands
  message: { error: 'Muitas solicitações. Por favor, aguarde um minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const checkinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // stricter for check-in
  message: { error: 'Muitas tentativas de check-in. Por favor, aguarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const stateLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 20, // soft limit for state fetching
  message: { error: 'Muitas solicitações de estado. Por favor, aguarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  assemblyCommandLimiter,
  checkinLimiter,
  stateLimiter
};
