// src/controllers/push.controller.js
const pushService = require("../services/push.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");
const { isUuid } = require("../utils/format");

function getUserId(req) {
  // Seu middleware auth normalmente seta req.user
  // Vamos blindar: aceitar req.user.id ou req.user.userId
  return req?.user?.id ?? req?.user?.userId ?? null;
}

function maskToken(token) {
  if (!token || typeof token !== 'string') return "invalid-token";
  if (token.length < 15) return "***";
  return `${token.substring(0, 10)}...${token.slice(-4)}`;
}

exports.register = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const userId = getUserId(req);
  const { expoPushToken, deviceId, platform, permissionStatus } = req.body || {};
  const bodyKeys = req.body ? Object.keys(req.body) : [];

  const isInt = (val) => (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val)));
  const userIdType = isUuid(userId) ? 'uuid' : (isInt(userId) ? 'int' : 'invalid');

  try {
    log.info("PushRegisterIniciado", {
      requestId,
      method: req.method,
      route: req.originalUrl,
      userId,
      userId_type: userIdType,
      platform,
      permissionStatus,
      expoPushTokenMasked: maskToken(expoPushToken),
      bodyKeys
    });

    if (!userId) {
      return res.status(401).json({ success: false, error: "Membro não autenticado (req.user ausente)." });
    }

    if (userIdType === 'invalid') {
        return res.status(400).json({ success: false, error: "ID de usuário inválido (deve ser UUID ou Inteiro)." });
    }

    // Se negou, registramos mesmo sem token
    if (permissionStatus === 'denied' && !expoPushToken) {
        await pushService.upsertToken({
            userId,
            expoPushToken: null,
            deviceId: deviceId ? String(deviceId) : null,
            platform: platform ? String(platform) : null,
            permissionStatus
        });
        return res.json({ success: true, message: "Status de permissão negado registrado." });
    }

    if (!expoPushToken) {
      return res.status(400).json({ success: false, error: "expoPushToken é obrigatório." });
    }

    const result = await pushService.upsertToken({
      userId,
      expoPushToken: String(expoPushToken),
      deviceId: deviceId ? String(deviceId) : null,
      platform: platform ? String(platform) : null,
      permissionStatus: permissionStatus || 'granted'
    });

    return res.json({ success: true, id: result?.id ?? null });
  } catch (e) {
    const errorId = uuidv4();
    log.error("PushRegisterErro", {
      errorId,
      requestId,
      userId,
      error: e.message,
      stack: e.stack
    });

    if (e.message === "ExpoPushToken inválido.") {
      return res.status(400).json({ success: false, error: e.message });
    }

    return res.status(500).json({
      success: false,
      error: "Erro ao registrar push token.",
      errorId
    });
  }
};

exports.unregister = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const userId = getUserId(req);
  const { expoPushToken } = req.body || {};

  const isInt = (val) => (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val)));
  const userIdType = isUuid(userId) ? 'uuid' : (isInt(userId) ? 'int' : 'invalid');

  try {
    log.info("PushUnregisterIniciado", {
      requestId,
      userId,
      userId_type: userIdType,
      expoPushTokenMasked: maskToken(expoPushToken)
    });

    if (!userId) {
      return res.status(401).json({ success: false, error: "Membro não autenticado (req.user ausente)." });
    }

    if (userIdType === 'invalid') {
        return res.status(400).json({ success: false, error: "ID de usuário inválido (deve ser UUID ou Inteiro)." });
    }

    if (!expoPushToken) {
      return res.status(400).json({ success: false, error: "expoPushToken é obrigatório." });
    }

    const ok = await pushService.revokeToken({
      userId,
      expoPushToken: String(expoPushToken),
    });

    return res.json({ success: ok });
  } catch (e) {
    const errorId = uuidv4();
    log.error("PushUnregisterErro", {
      errorId,
      requestId,
      userId,
      error: e.message,
      stack: e.stack
    });
    return res.status(500).json({ success: false, error: "Erro ao remover push token.", errorId });
  }
};

// (Opcional) broadcast manual para diretoria/admin
exports.broadcast = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  try {
    const { title, body, data } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ success: false, error: "title e body são obrigatórios." });
    }

    const r = await pushService.sendBroadcast({
      title: String(title),
      body: String(body),
      data: data || {},
    });

    return res.json({ success: true, ...r });
  } catch (e) {
    const errorId = uuidv4();
    log.error("PushBroadcastErro", {
      errorId,
      requestId,
      error: e.message,
      stack: e.stack
    });
    return res.status(500).json({ success: false, error: "Erro ao enviar broadcast.", errorId });
  }
};
