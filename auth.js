// auth.js
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token não informado.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Aqui preservamos TUDO que veio no token, incluindo perfil_acesso
    req.user = {
      id: payload.id,
      cpf: payload.cpf,
      nome: payload.nome,
      perfil_acesso: payload.perfil_acesso || 'FILIADO',
    };

    // Opcional: log de debug
    // console.log('👤 Usuário autenticado:', req.user);

    next();
  } catch (err) {
    console.error('💥 Erro ao validar token JWT:', err);
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

module.exports = auth;
