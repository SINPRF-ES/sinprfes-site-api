// src/controllers/pushCampaign.controller.js
const pushCampaignService = require("../services/pushCampaign.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

exports.sendCampaign = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const createdBy = req.user?.id;

  try {
    const { title, body, targetType, targetValue, data } = req.body || {};

    // Validação
    if (!body) {
      return res.status(400).json({ success: false, error: "O corpo da mensagem (body) é obrigatório." });
    }

    // Sanitização de tamanho
    const sanitizedTitle = title ? String(title).substring(0, 60) : null;
    const sanitizedBody = String(body).substring(0, 240);

    const result = await pushCampaignService.sendCampaign({
      title: sanitizedTitle,
      body: sanitizedBody,
      targetType: targetType || 'ALL',
      targetValue,
      data,
      createdBy
    });

    return res.json(result);
  } catch (e) {
    const errorId = uuidv4();
    log.error("PushCampaign.ControllerErro", {
      errorId,
      requestId,
      userId: createdBy,
      error: e.message,
      stack: e.stack
    });

    return res.status(500).json({
      success: false,
      error: "Erro ao processar campanha de push.",
      errorId
    });
  }
};

exports.listCampaigns = async (req, res) => {
  try {
    const campaigns = await pushCampaignService.listCampaigns(20);
    return res.json({ success: true, campaigns });
  } catch (e) {
    log.error("PushCampaign.ListErro", e);
    return res.status(500).json({ success: false, error: "Erro ao listar campanhas." });
  }
};
