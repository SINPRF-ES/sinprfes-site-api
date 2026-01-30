// src/controllers/pushCampaign.controller.js
const pushCampaignService = require("../services/pushCampaign.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

exports.sendCampaign = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const createdBy = req.user?.id;
  const perfil = req.user?.perfil_acesso || req.user?.perfil || "FILIADO";

  try {
    const { title, body, targetType, targetValue, data } = req.body || {};

    // Validação
    if (!body || String(body).trim().length === 0) {
      return res.status(400).json({ success: false, error: "O corpo da mensagem (body) é obrigatório." });
    }

    // Sanitização de tamanho
    const sanitizedTitle = title ? String(title).trim().substring(0, 60) : null;
    const sanitizedBody = String(body).trim().substring(0, 240);

    const result = await pushCampaignService.sendCampaign({
      title: sanitizedTitle,
      body: sanitizedBody,
      targetType: targetType || 'ALL',
      targetValue,
      data,
      createdBy,
      requestId,
      perfil
    });

    log.info("PushCampaign.ControllerSucesso", {
      requestId,
      userId: createdBy,
      perfil,
      campaignId: result.campaignId,
      sent: result.sent
    });

    return res.json(result);
  } catch (e) {
    const errorId = uuidv4();
    log.error("PushCampaign.ControllerErro", {
      errorId,
      requestId,
      userId: createdBy,
      perfil,
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
  const requestId = req.requestId || uuidv4();
  const createdBy = req.user?.id;
  const perfil = req.user?.perfil_acesso || req.user?.perfil || "FILIADO";

  try {
    const campaigns = await pushCampaignService.listCampaigns(20);
    return res.json({ success: true, campaigns });
  } catch (e) {
    log.error("PushCampaign.ListErro", {
        requestId,
        userId: createdBy,
        perfil,
        error: e.message
    });
    return res.status(500).json({ success: false, error: "Erro ao listar campanhas." });
  }
};
