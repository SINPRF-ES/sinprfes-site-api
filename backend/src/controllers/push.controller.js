// src/controllers/push.controller.js
const pushService = require("../services/push.service");
const pushConfig = require("../config/push.config");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

function normalizeScope(s) {
  return String(s || "").trim().toUpperCase();
}

function maskToken(token) {
  if (!token || typeof token !== 'string') return "invalid-token";
  if (token.length < 15) return "***";
  return `${token.substring(0, 10)}...${token.slice(-4)}`;
}

exports.register = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  if (!atorId) {
    return res.status(401).json({ success: false, error: "Usuário não autenticado (req.user ausente).", requestId });
  }

  const { expoPushToken, deviceId, platform, permissionStatus, projectId, appScope, expoProjectId } = req.body || {};
  const bodyKeys = req.body ? Object.keys(req.body) : [];

  try {
    log.info("PushRegisterIniciado", {
      requestId,
      method: req.method,
      route: req.originalUrl,
      atorId,
      platform,
      permissionStatus,
      projectId,
      appScope,
      expoProjectId,
      expoPushTokenMasked: maskToken(expoPushToken),
      bodyKeys
    });

    // Hard safety: Rejeitar se appScope diferente do repo
    if (appScope && normalizeScope(appScope) !== normalizeScope(pushConfig.APP_SCOPE)) {
      log.warn("PushRegisterScopeMismatch", { requestId, atorId, appScope, expected: pushConfig.APP_SCOPE });
      return res.status(400).json({ success: false, error: "App Scope mismatch.", requestId });
    }

    const finalAppScope = normalizeScope(appScope || pushConfig.APP_SCOPE);
    const finalProjectId = expoProjectId || projectId || null;

    // Se negou, registramos mesmo sem token
    if (permissionStatus === 'denied' && !expoPushToken) {
        await pushService.upsertToken({
            userId: atorId,
            expoPushToken: null,
            deviceId: deviceId ? String(deviceId) : null,
            platform: platform ? String(platform) : null,
            permissionStatus,
            projectId: finalProjectId ? String(finalProjectId) : null,
            appScope: finalAppScope,
            expoProjectId: finalProjectId ? String(finalProjectId) : null
        });
        return res.json({ success: true, message: "Status de permissão negado registrado.", requestId });
    }

    if (!expoPushToken) {
      return res.status(400).json({ success: false, error: "expoPushToken é obrigatório.", requestId });
    }

    // Isolamento: Desativar tokens de outros scopes para este usuário
    await pushService.deactivateMismatchedScopeTokens(atorId, finalAppScope);

    // Se temos um projectId (EAS), desativamos tokens de outros projetos para este usuário
    if (finalProjectId) {
      await pushService.deactivateOtherProjectTokens(atorId, finalProjectId, finalAppScope);
    }

    const result = await pushService.upsertToken({
      userId: atorId,
      expoPushToken: String(expoPushToken),
      deviceId: deviceId ? String(deviceId) : null,
      platform: platform ? String(platform) : null,
      permissionStatus: permissionStatus || 'granted',
      projectId: finalProjectId ? String(finalProjectId) : null,
      appScope: finalAppScope,
      expoProjectId: finalProjectId ? String(finalProjectId) : null
    });

    // Se o service marcou como desativado por falta de project_id, avisamos o client
    if (result && (result.disabled_reason === 'missing_expo_project_id' || result.disabled_reason === 'missing_project_id')) {
       return res.json({
         success: true,
         ok: false,
         id: result.id,
         reason: result.disabled_reason,
         message: "Token registrado mas desativado por falta de EAS Project ID no backend.",
         hint: "Certifique-se de que o App está enviando o projectId/expoProjectId corretamente.",
         requestId
       });
    }

    return res.json({ success: true, ok: true, id: result?.id ?? null, requestId });
  } catch (e) {
    const errorId = uuidv4();
    log.error("PushRegisterErro", {
      errorId,
      requestId,
      atorId,
      error: e.message,
      stack: e.stack
    });

    if (e.message === "ExpoPushToken inválido.") {
      return res.status(400).json({ success: false, error: e.message, requestId });
    }

    return res.status(500).json({
      success: false,
      error: "Erro ao registrar push token.",
      errorId,
      requestId
    });
  }
};

exports.unregister = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  if (!atorId) {
    return res.status(401).json({ success: false, error: "Usuário não autenticado (req.user ausente).", requestId });
  }

  const { expoPushToken } = req.body || {};

  try {
    if (!expoPushToken) {
      return res.status(400).json({ success: false, error: "expoPushToken é obrigatório.", requestId });
    }

    const ok = await pushService.revokeToken({
      userId: atorId,
      expoPushToken: String(expoPushToken),
    });

    return res.json({ success: ok, requestId });
  } catch (e) {
    const errorId = uuidv4();
    log.error("PushUnregisterErro", {
      errorId,
      requestId,
      atorId,
      error: e.message,
      stack: e.stack
    });
    return res.status(500).json({ success: false, error: "Erro ao remover push token.", errorId, requestId });
  }
};

exports.diagnosticsScopes = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  if (!atorId) {
    return res.status(401).json({ success: false, error: "Usuário não autenticado (req.user ausente).", requestId });
  }

  try {
    const scopes = await pushService.getScopesDiagnostics();
    log.info("PushDiagnosticsScopesAcessado", { requestId, atorId });
    return res.json({ success: true, scopes, requestId });
  } catch (e) {
    log.error("PushDiagnosticsScopesErro", { requestId, atorId, error: e.message });
    return res.status(500).json({ success: false, error: "Erro ao carregar diagnóstico de scopes.", requestId });
  }
};

exports.diagnosticsMe = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  if (!atorId) {
    return res.status(401).json({ success: false, error: "Usuário não autenticado.", requestId });
  }

  try {
    const tokens = await pushService.getDiagnostics(atorId);

    const stats = {
        app_scope: pushConfig.APP_SCOPE,
        easProjectId: null,
        token_count_total: tokens.length,
        token_count_valid: 0,
        token_count_disabled_by_reason: {},
        newest_last_seen: null,
        oldest_last_seen: null
    };

    tokens.forEach(t => {
        if (!stats.easProjectId && t.expo_project_id) {
            stats.easProjectId = t.expo_project_id;
        }

        const isValid = !t.revoked_at && !t.disabled_at && !!(t.expo_project_id || t.project_id);
        if (isValid) stats.token_count_valid++;

        if (t.disabled_reason) {
            stats.token_count_disabled_by_reason[t.disabled_reason] = (stats.token_count_disabled_by_reason[t.disabled_reason] || 0) + 1;
        }

        if (!stats.newest_last_seen || new Date(t.last_seen) > new Date(stats.newest_last_seen)) {
            stats.newest_last_seen = t.last_seen;
        }
        if (!stats.oldest_last_seen || new Date(t.last_seen) < new Date(stats.oldest_last_seen)) {
            stats.oldest_last_seen = t.last_seen;
        }
    });

    return res.json({
        success: true,
        requestId,
        ...stats,
        tokens: tokens.map(t => ({
            ...t,
            expo_push_token: maskToken(t.expo_push_token)
        }))
    });
  } catch (e) {
    log.error("PushDiagnosticsMeErro", { requestId, atorId, error: e.message });
    return res.status(500).json({ success: false, error: "Erro ao carregar diagnóstico de push.", requestId });
  }
};

// (Opcional) broadcast manual para diretoria/admin
exports.broadcast = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  if (!atorId) {
    return res.status(401).json({ success: false, error: "Usuário não autenticado (req.user ausente).", requestId });
  }

  try {
    const { title, body, data } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ success: false, error: "title e body são obrigatórios.", requestId });
    }

    const r = await pushService.sendBroadcast({
      title: String(title),
      body: String(body),
      data: data || {},
    });

    return res.json({ success: true, ...r, requestId });
  } catch (e) {
    const errorId = uuidv4();
    log.error("PushBroadcastErro", {
      errorId,
      requestId,
      atorId,
      error: e.message,
      stack: e.stack
    });
    return res.status(500).json({ success: false, error: "Erro ao enviar broadcast.", errorId, requestId });
  }
};
