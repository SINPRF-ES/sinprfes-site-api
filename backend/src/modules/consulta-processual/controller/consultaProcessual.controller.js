const service = require('../service/consultaProcessual.service');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');

function getPerfil(req) {
  return String(req.user?.perfil_acesso || req.user?.perfil || req.user?.role || '').toUpperCase();
}

function canUseInstitutionalMode(req) {
  const cfg = getConsultaProcessualConfig();
  if (cfg.institutionalPublicVisible) return true;
  const perfil = getPerfil(req);
  return ['ADMIN', 'DIRETORIA'].includes(perfil);
}

async function consultarMe(req, res) {
  const mode = req.query.mode === 'institutional' ? 'institutional' : 'personal';

  if (mode === 'institutional' && !canUseInstitutionalMode(req)) {
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
      debug: false,
      mode,
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
  const perfil = getPerfil(req);
  if (!['ADMIN', 'DIRETORIA'].includes(perfil)) {
    return res.status(403).json({
      ok: false,
      code: 'CONSULTA_PROCESSUAL_DEBUG_FORBIDDEN',
      message: 'Rota de diagnóstico restrita para ADMIN e DIRETORIA.',
    });
  }

  const mode = req.query.mode === 'institutional' ? 'institutional' : 'personal';

  try {
    const result = await service.consultarPorUsuarioLogado({
      userId: req.user?.id,
      requestId: req.requestId,
      debug: true,
      mode,
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

module.exports = { consultarMe, consultarDebugMe, canUseInstitutionalMode };
