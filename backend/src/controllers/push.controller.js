// src/controllers/push.controller.js
const pushService = require("../services/push.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

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

  const { expoPushToken, deviceId, platform, permissionStatus } = req.body || {};
  const bodyKeys = req.body ? Object.keys(req.body) : [];

  try {
    log.info("PushRegisterIniciado", {
      requestId,
      method: req.method,
      route: req.originalUrl,
      atorId,
      platform,
      permissionStatus,
      expoPushTokenMasked: maskToken(expoPushToken),
      bodyKeys
    });

    // Se negou, registramos mesmo sem token
    if (permissionStatus === 'denied' && !expoPushToken) {
        await pushService.upsertToken({
            userId: atorId,
            expoPushToken: null,
            deviceId: deviceId ? String(deviceId) : null,
            platform: platform ? String(platform) : null,
            permissionStatus
        });
        return res.json({ success: true, message: "Status de permissão negado registrado.", requestId });
    }

    if (!expoPushToken) {
      return res.status(400).json({ success: false, error: "expoPushToken é obrigatório.", requestId });
    }

    const result = await pushService.upsertToken({
      userId: atorId,
      expoPushToken: String(expoPushToken),
      deviceId: deviceId ? String(deviceId) : null,
      platform: platform ? String(platform) : null,
      permissionStatus: permissionStatus || 'granted'
    });

    return res.json({ success: true, id: result?.id ?? null, requestId });
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
