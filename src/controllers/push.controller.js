// src/controllers/push.controller.js
const pushService = require("../services/push.service");

function getUserId(req) {
  // Seu middleware auth normalmente seta req.user
  // Vamos blindar: aceitar req.user.id ou req.user.userId
  return req?.user?.id ?? req?.user?.userId ?? null;
}

exports.register = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado (req.user ausente)." });
    }

    const { expoPushToken, deviceId, platform } = req.body || {};
    if (!expoPushToken) {
      return res.status(400).json({ error: "expoPushToken é obrigatório." });
    }

    const result = await pushService.upsertToken({
      userId,
      expoPushToken: String(expoPushToken),
      deviceId: deviceId ? String(deviceId) : null,
      platform: platform ? String(platform) : null,
    });

    return res.json({ ok: true, id: result?.id ?? null });
  } catch (e) {
    console.error("PushRegisterErro:", e);
    return res.status(500).json({
      error: e?.message || "Erro ao registrar push token.",
    });
  }
};

exports.unregister = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado (req.user ausente)." });
    }

    const { expoPushToken } = req.body || {};
    if (!expoPushToken) {
      return res.status(400).json({ error: "expoPushToken é obrigatório." });
    }

    const ok = await pushService.revokeToken({
      userId,
      expoPushToken: String(expoPushToken),
    });

    return res.json({ ok });
  } catch (e) {
    console.error("PushUnregisterErro:", e);
    return res.status(500).json({ error: e?.message || "Erro ao remover push token." });
  }
};

// (Opcional) broadcast manual para diretoria/admin
exports.broadcast = async (req, res) => {
  try {
    const { title, body, data } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ error: "title e body são obrigatórios." });
    }

    const r = await pushService.sendBroadcast({
      title: String(title),
      body: String(body),
      data: data || {},
    });

    return res.json(r);
  } catch (e) {
    console.error("PushBroadcastErro:", e);
    return res.status(500).json({ error: e?.message || "Erro ao enviar broadcast." });
  }
};
