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
 * Limiter para Filie-se (formulário público)
 * Protege contra abuso e spam de cadastros.
 */
const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // limite de 5 envios por IP
  message: { error: 'Limite de envios atingido. Se precisar de ajuda, entre em contato com o sindicato.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  passwordResetLimiter,
  publicFormLimiter
};
