/**
 * Configurações de Push para isolamento multi-app.
 */
module.exports = {
  APP_SCOPE: 'SINDICATO',
  EXPO_PROJECT_ID: process.env.EXPO_PROJECT_ID || '',
  TOKEN_EXPIRATION_DAYS: 60
};
