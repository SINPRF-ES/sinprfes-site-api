// src/controllers/repasse.controller.js
const repasseService = require("../services/repasse.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

async function getRepasseAno(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const data = await repasseService.getRepasseAno(year);

    log.info("RepasseGetAnoSucesso", { requestId, atorId, year });

    res.json({ success: true, ...data, requestId });
  } catch (err) {
    log.error("RepasseGetAnoErro", { requestId, atorId, error: err.message });
    res.status(500).json({ success: false, message: err.message, requestId });
  }
}

async function updateRepasseMes(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const { year, month, perCapita, localidades } = req.body;

    if (!year || !month || perCapita === undefined || !Array.isArray(localidades)) {
      return res.status(400).json({ success: false, message: "Dados incompletos.", requestId });
    }

    await repasseService.updateRepasseMes(year, month, perCapita, localidades);

    log.info("RepasseUpdateMesSucesso", { requestId, atorId, year, month });

    res.json({ success: true, message: "Dados atualizados com sucesso.", requestId });
  } catch (err) {
    log.error("RepasseUpdateMesErro", { requestId, atorId, error: err.message });
    res.status(500).json({ success: false, message: err.message, requestId });
  }
}

async function listarResponsaveis(req, res) {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const { lotacao } = req.query;
    const responsaveis = await repasseService.listarResponsaveis(lotacao);

    log.info("RepasseListarResponsaveisSucesso", { requestId, atorId, lotacao });

    res.json({ success: true, responsaveis, requestId });
  } catch (err) {
    log.error("RepasseListarResponsaveisErro", { requestId, atorId, error: err.message });
    res.status(500).json({ success: false, message: err.message, requestId });
  }
}

module.exports = {
  getRepasseAno,
  updateRepasseMes,
  listarResponsaveis
};
