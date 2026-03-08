const service = require('../service/consultaProcessual.service');

async function consultarMe(req, res) {
  const mode = req.query.mode || 'personal';
  const perfil = String(req.user?.perfil_acesso || req.user?.perfil || req.user?.role || '').toUpperCase();

  if (mode === 'institutional' && !['ADMIN', 'DIRETORIA'].includes(perfil)) {
    return res.status(403).json({
      ok: false,
      code: 'CONSULTA_PROCESSUAL_INSTITUTIONAL_FORBIDDEN',
      message: 'Consulta institucional restrita para ADMIN e DIRETORIA.',
    });
  }

  try {
    const result = await service.consultarPorUsuarioLogado({
      userId: req.user?.id,
      requestId: req.requestId,
      mode,
      debug: false,
    });

    if (!result.ok) {
      const status = result.code === 'USER_CPF_NOT_AVAILABLE' ? 400 : 503;
      return res.status(status).json(result);
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: 'CONSULTA_PROCESSUAL_INTERNAL_ERROR',
      message: 'Não foi possível realizar a consulta processual no momento.',
    });
  }
}

async function consultarDebugMe(req, res) {
  const mode = req.query.mode || 'personal';
  const perfil = String(req.user?.perfil_acesso || req.user?.perfil || req.user?.role || '').toUpperCase();
  if (!['ADMIN', 'DIRETORIA'].includes(perfil)) {
    return res.status(403).json({
      ok: false,
      code: 'CONSULTA_PROCESSUAL_DEBUG_FORBIDDEN',
      message: 'Rota de diagnóstico restrita para ADMIN e DIRETORIA.',
    });
  }

  try {
    const result = await service.consultarPorUsuarioLogado({
      userId: req.user?.id,
      requestId: req.requestId,
      mode,
      debug: true,
    });

    if (!result.ok) {
      const status = result.code === 'USER_CPF_NOT_AVAILABLE' ? 400 : 503;
      return res.status(status).json(result);
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: 'CONSULTA_PROCESSUAL_INTERNAL_ERROR',
      message: 'Não foi possível realizar a consulta de diagnóstico no momento.',
    });
  }
}

module.exports = { consultarMe, consultarDebugMe };
