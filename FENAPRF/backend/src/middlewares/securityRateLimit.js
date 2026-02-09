const rateLimit = require('express-rate-limit');

/**
 * Limiter para Login e 2FA
 * Protege contra ataques de força bruta.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // limite de 10 tentativas por IP
  message: { error: 'Muitas tentativas de login. Por favor, tente novamente após 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter para Recuperação de Senha
 * Protege contra email bombing e spam.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutos
  max: 3, // limite de 3 solicitações por IP
  message: { error: 'Muitas solicitações de recuperação de senha. Verifique seu e-mail ou tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter para Campanhas de Push
 */
const pushCampaignLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 2, // limite de 2 envios por IP/membro
  message: { error: 'Limite de envio de notificações atingido (máx 2 por minuto).' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  passwordResetLimiter,
  pushCampaignLimiter
};
