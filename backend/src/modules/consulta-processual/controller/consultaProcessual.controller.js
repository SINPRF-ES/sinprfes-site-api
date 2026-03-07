const service = require('../service/consultaProcessual.service');

async function consultarMe(req, res) {
  try {
    const result = await service.consultarPorUsuarioLogado({
      userId: req.user?.id,
      requestId: req.requestId,
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

module.exports = { consultarMe };
