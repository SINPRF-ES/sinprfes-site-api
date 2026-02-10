// src/controllers/pushCampaign.controller.js
const pushCampaignService = require("../services/pushCampaign.service");
const pushService = require("../services/push.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

exports.sendCampaign = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const createdBy = req.user?.id;
  const perfil = req.user?.perfil_acesso || req.user?.perfil || "USER";

  const payloadForLog = req.body ? {
    ...req.body,
    title: req.body.title ? (typeof req.body.title === 'string' ? `${req.body.title.substring(0, 10)}...` : req.body.title) : null,
    body: req.body.body ? (typeof req.body.body === 'string' ? `${req.body.body.substring(0, 10)}...` : req.body.body) : null
  } : null;

  const payloadTypes = req.body ? {
    title: typeof req.body.title,
    body: typeof req.body.body,
    targetType: typeof req.body.targetType,
    targetValue: typeof req.body.targetValue,
    data: typeof req.body.data
  } : null;

  log.info("PushCampaign.ControllerIniciado", {
    requestId,
    userId: createdBy,
    perfil,
    payload: payloadForLog,
    types: payloadTypes
  });

  try {
    const { title, body, targetType, targetValue, data } = req.body || {};
    const errors = {};

    // Validação
    if (body === undefined || body === null) {
      errors.body = "O corpo da mensagem (body) é obrigatório.";
    } else if (typeof body !== 'string') {
      errors.body = "O corpo da mensagem (body) deve ser uma string.";
    } else if (body.trim().length === 0) {
      errors.body = "O corpo da mensagem (body) não pode ser vazio.";
    } else if (body.length > 240) {
      errors.body = "O corpo da mensagem não pode exceder 240 caracteres.";
    }

    if (title !== undefined && title !== null) {
      if (typeof title !== 'string') {
        errors.title = "O título (title) deve ser uma string.";
      } else if (title.length > 60) {
        errors.title = "O título não pode exceder 60 caracteres.";
      }
    }

    const allowedTargetTypes = ['ALL', 'UF', 'JOGOS', 'USER'];
    if (targetType && !allowedTargetTypes.includes(targetType)) {
      errors.targetType = `Tipo de alvo inválido. Permitidos: ${allowedTargetTypes.join(', ')}`;
    }

    if (Object.keys(errors).length > 0) {
      log.warn("PushCampaign.ValidacaoFalhou", { requestId, userId: createdBy, errors });
      return res.status(400).json({
        success: false,
        message: "Payload inválido: title e body devem ser string não-vazia.",
        errors,
        code: "VALIDATION_ERROR"
      });
    }

    // Sanitização de tamanho
    const sanitizedTitle = (title && typeof title === 'string') ? title.trim().substring(0, 60) : null;
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
      sent: result.sent,
      hasCredentialError: result.hasCredentialError
    });

    if (result.hasCredentialError && result.sent === 0) {
      return res.status(502).json({
        ...result,
        success: false,
        message: "FCM credentials missing/invalid in Expo project. Configure FCM V1 service account in EAS/Expo credentials.",
        code: "FCM_CREDENTIALS_ERROR"
      });
    }

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

exports.pushHealth = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const userId = req.user?.id;
  const perfil = req.user?.perfil_acesso || req.user?.perfil || "USER";

  try {
    const tokens = await pushService.listActiveTokens(10);
    const hasTokens = tokens.length > 0;

    const checklist = {
      hasTokens,
      tokensCount: tokens.length,
      expoConfigOk: "Unknown (Requires dry-run with real credentials)",
      notes: [
        "FCM V1 requires a Service Account Key (.json) configured in EAS/Expo Credentials.",
        "Check Render logs for 'InvalidCredentials' if sent=0.",
        "Use /api/push/campaigns/send for a real test."
      ]
    };

    log.info("PushCampaign.HealthCheck", { requestId, userId, tokensCount: tokens.length });

    return res.json({
      success: true,
      requestId,
      checklist
    });
  } catch (e) {
    log.error("PushCampaign.HealthError", { requestId, error: e.message });
    return res.status(500).json({
      success: false,
      message: "Erro ao verificar saúde do push.",
      error: e.message
    });
  }
};

exports.listCampaigns = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const createdBy = req.user?.id;
  const perfil = req.user?.perfil_acesso || req.user?.perfil || "USER";

  try {
    const includeArchived = req.query?.includeArchived === '1';
    const limit = includeArchived ? 1000 : 5;

    const campaigns = await pushCampaignService.listCampaigns(limit);
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
