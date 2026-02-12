// src/controllers/push.controller.js
const pushService = require("../services/push.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");
const { parseUuid } = require("../utils/format");

function getUserId(req) {
  // FENAPRF: O ID do usuário logado é extraído do middleware de autenticação.
  // Deve ser um UUIDv7 válido conforme os padrões do projeto.
  const id = req?.user?.id ?? req?.user?.userId ?? null;
  return parseUuid(id);
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

  try {
    log.info("PushRegisterIniciado", {
      requestId,
      method: req.method,
      route: req.originalUrl,
      userId,
      platform,
      permissionStatus,
      expoPushTokenMasked: maskToken(expoPushToken),
      bodyKeys
    });

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Membro não identificado ou sessão inválida (UUID esperado).",
        requestId
      });
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
    log.error("PushRegisterErro", {
      requestId,
      userId,
      error: e.message,
      stack: e.stack
    });

    if (e.message === "ExpoPushToken inválido.") {
      return res.status(400).json({ success: false, error: e.message, requestId });
    }

    return res.status(500).json({
      success: false,
      error: "Erro ao registrar push token.",
      requestId
    });
  }
};

exports.unregister = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const userId = getUserId(req);
  const { expoPushToken } = req.body || {};

  try {
    log.info("PushUnregisterIniciado", {
      requestId,
      userId,
      expoPushTokenMasked: maskToken(expoPushToken)
    });

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Membro não identificado ou sessão inválida (UUID esperado).",
        requestId
      });
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
    log.error("PushUnregisterErro", {
      requestId,
      userId,
      error: e.message,
      stack: e.stack
    });
    return res.status(500).json({ success: false, error: "Erro ao remover push token.", requestId });
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
    log.error("PushBroadcastErro", {
      requestId,
      error: e.message,
      stack: e.stack
    });
    return res.status(500).json({ success: false, error: "Erro ao enviar broadcast.", requestId });
  }
};
