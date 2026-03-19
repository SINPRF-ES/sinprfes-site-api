// src/controllers/pushCampaign.controller.js
const pushCampaignService = require("../services/pushCampaign.service");
const pushService = require("../services/push.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

function normalizeScope(s) {
  return String(s || "").trim().toUpperCase();
}

exports.sendCampaign = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const createdBy = req.user?.id;
  if (!createdBy) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const perfil = req.user?.perfil_acesso || req.user?.perfil || "FILIADO";

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
    const fallbackBody = `Diagnóstico push em ${new Date().toLocaleString('pt-BR')}`;
    const errors = {};

    // Validação
    if (body !== undefined && body !== null && typeof body !== 'string') {
      errors.body = "O corpo da mensagem (body) deve ser uma string.";
    } else if (typeof body === 'string' && body.length > 240) {
      errors.body = "O corpo da mensagem não pode exceder 240 caracteres.";
    }

    if (title !== undefined && title !== null) {
      if (typeof title !== 'string') {
        errors.title = "O título (title) deve ser uma string.";
      } else if (title.length > 60) {
        errors.title = "O título não pode exceder 60 caracteres.";
      }
    }

    const allowedTargetTypes = ['ALL', 'ATIVOS', 'VETERANOS', 'LOTACAO', 'JOGOS', 'FILIADO'];
    if (targetType && !allowedTargetTypes.includes(targetType)) {
      errors.targetType = `Tipo de alvo inválido. Permitidos: ${allowedTargetTypes.join(', ')}`;
    }

    if (Object.keys(errors).length > 0) {
      log.warn("PushCampaign.ValidacaoFalhou", { requestId, userId: createdBy, errors });
      return res.status(400).json({
        success: false,
        message: "Payload inválido: title e body devem ser string não-vazia.",
        errors,
        code: "VALIDATION_ERROR",
        requestId
      });
    }

    // Sanitização de tamanho
    const sanitizedTitle = (title && typeof title === 'string') ? title.trim().substring(0, 60) : null;
    const sanitizedBody = (typeof body === 'string' && body.trim() ? body.trim() : fallbackBody).substring(0, 240);

    // Suporte para 'self' no diagnóstico
    let finalTargetValue = targetValue;
    if (targetType === 'FILIADO' && targetValue === 'self') {
      finalTargetValue = { id: createdBy };
    }

    const result = await pushCampaignService.sendCampaign({
      title: sanitizedTitle,
      body: sanitizedBody,
      targetType: targetType || 'ALL',
      targetValue: finalTargetValue,
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
        code: "FCM_CREDENTIALS_ERROR",
        requestId
      });
    }

    return res.json({ ...result, requestId });
  } catch (e) {
    if (e.statusCode === 400) {
      log.warn("PushCampaign.ControllerErroValidacao", {
        requestId,
        userId: createdBy,
        perfil,
        error: e.message
      });
      return res.status(400).json({
        success: false,
        message: e.message,
        code: "VALIDATION_ERROR",
        requestId
      });
    }

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
      code: "INTERNAL_SERVER_ERROR",
      requestId
    };

    if ((process.env.ASSEMBLEIA_ENV || "dev") === "dev") {
      response.details = e.message;
    }

    return res.status(500).json(response);
  }
};

exports.pushHealth = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  try {
    const scopes = await pushService.getScopesDiagnostics();
    // Procurar pelo scope SINDICATO (canon)
    const sindicatoScope = scopes.find((s) => normalizeScope(s.app_scope) === 'SINDICATO') || { total: 0, valid: 0 };

    const checklist = {
      hasTokens: sindicatoScope.valid > 0,
      token_count_valid: parseInt(sindicatoScope.valid, 10),
      token_count_total: parseInt(sindicatoScope.total, 10),
      missing_project_id: parseInt(sindicatoScope.missing_project_id || 0, 10),
      expoConfigOk: "Unknown (Requires dry-run)",
      notes: [
        "FCM V1 requires a Service Account Key (.json) configured in EAS/Expo Credentials.",
        "Check /api/push/diagnostics/scopes for detailed distribution."
      ]
    };

    log.info("PushCampaign.HealthCheck", { requestId, userId: atorId, validTokens: sindicatoScope.valid });

    return res.json({
      success: true,
      requestId,
      checklist,
      // Fallback/Legacy flat fields to ensure compatibility if needed
      token_count_valid: checklist.token_count_valid,
      missing_project_id: checklist.missing_project_id
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

exports.listMyNotifications = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const perfil = (req.user?.perfil_acesso || "").toUpperCase();
  const lotacao = req.user?.lotacao;
  const situacao = (req.user?.situacao || req.user?.situacao_funcional || "").toUpperCase();

  try {
    const notifications = await pushCampaignService.listMyNotifications({
        userId: atorId, perfil, lotacao, situacao
    });

    log.info("PushCampaign.ListMyNotificationsSucesso", { requestId, userId: atorId, count: notifications.length });

    return res.json({ success: true, notifications, requestId });
  } catch (e) {
    log.error("PushCampaign.ListMyNotificationsErro", {
        requestId,
        userId: atorId,
        error: e.message
    });
    return res.status(500).json({
      success: false,
      message: "Erro ao listar notificações.",
      code: "INTERNAL_SERVER_ERROR",
      requestId
    });
  }
};

exports.listCampaigns = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  if (!atorId) return res.status(401).json({ success: false, message: "Não autenticado", requestId });

  const perfil = req.user?.perfil_acesso || req.user?.perfil || "FILIADO";

  try {
    const includeArchived = req.query?.includeArchived === '1';
    const limit = includeArchived ? 50 : 5;

    const campaigns = await pushCampaignService.listCampaigns(limit);
    log.info("PushCampaign.ListSucesso", { requestId, atorId, count: campaigns.length });
    return res.json({ success: true, campaigns, requestId });
  } catch (e) {
    log.error("PushCampaign.ListErro", {
        requestId,
        userId: atorId,
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
