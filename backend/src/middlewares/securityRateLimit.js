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

/**
 * Limiter para Campanhas de Push
 */
const pushCampaignLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 2, // limite de 2 envios por IP/usuário
  message: { error: 'Limite de envio de notificações atingido (máx 2 por minuto).' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter para Operações Intensivas (Relatórios, Scraping)
 * Protege contra exaustão de recursos e ataques de DoS.
 */
const resourceIntensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // limite de 5 solicitações por IP
  message: { error: 'Limite de solicitações intensivas atingido. Por favor, aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter para Registro de Acessos (Analytics)
 * Protege contra spam e inundação de logs no banco de dados.
 */
const analyticsHitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 60, // limite de 60 registros por IP por hora
  message: { success: false, error: 'Limite de registros atingido.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  passwordResetLimiter,
  publicFormLimiter,
  pushCampaignLimiter,
  resourceIntensiveLimiter,
  analyticsHitLimiter
};
