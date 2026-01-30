// src/controllers/pushCampaign.controller.js
const pushCampaignService = require("../services/pushCampaign.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

exports.sendCampaign = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const createdBy = req.user?.id;
  const perfil = req.user?.perfil_acesso || req.user?.perfil || "FILIADO";

  log.info("PushCampaign.ControllerIniciado", {
    requestId,
    userId: createdBy,
    perfil,
    payload: req.body ? { ...req.body, body: req.body.body ? "..." : null } : null
  });

  try {
    const { title, body, targetType, targetValue, data } = req.body || {};

    // Validação
    const reportValidationError = (message) => {
      log.warn("PushCampaign.ValidacaoFalhou", { requestId, userId: createdBy, message });
      return res.status(400).json({
        success: false,
        message,
        code: "VALIDATION_ERROR"
      });
    };

    if (body === undefined || body === null) {
      return reportValidationError("O corpo da mensagem (body) é obrigatório.");
    }

    if (typeof body !== 'string') {
      return reportValidationError("O corpo da mensagem (body) deve ser uma string.");
    }

    if (body.trim().length === 0) {
      return reportValidationError("O corpo da mensagem (body) não pode ser vazio.");
    }

    if (title !== undefined && title !== null && typeof title !== 'string') {
      return reportValidationError("O título (title) deve ser uma string.");
    }

    if (title && title.length > 60) {
      return reportValidationError("O título não pode exceder 60 caracteres.");
    }

    if (body.length > 240) {
      return reportValidationError("O corpo da mensagem não pode exceder 240 caracteres.");
    }

    // Sanitização de tamanho
    const sanitizedTitle = title ? title.trim().substring(0, 60) : null;
    const sanitizedBody = body.trim().substring(0, 240);

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

    const response = {
      success: false,
      message: "Erro ao processar campanha de push.",
      errorId,
      code: "INTERNAL_SERVER_ERROR"
    };

    if ((process.env.ASSEMBLEIA_ENV || "dev") === "dev") {
      response.details = e.message;
    }

    return res.status(500).json(response);
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
    return res.status(500).json({
      success: false,
      message: "Erro ao listar campanhas.",
      details: e.message,
      code: "INTERNAL_SERVER_ERROR"
    });
  }
};
