// auth.js
const jwt = require('jsonwebtoken');

// Middleware que verifica o token JWT
function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token não informado.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload terá: { id, cpf, nome, iat, exp }
    req.user = {
      id: payload.id,
      cpf: payload.cpf,
      nome: payload.nome,
    };
    next();
  } catch (err) {
    console.error('Erro ao verificar JWT:', err.message);
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

module.exports = auth;
