// src/services/push.service.js
const { Expo } = require("expo-server-sdk");
const pool = require("../config/db");

const expo = new Expo();

async function upsertToken({ userId, expoPushToken, deviceId, platform }) {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    throw new Error("ExpoPushToken inválido.");
  }

  const sql = `
    INSERT INTO push_tokens (user_id, expo_push_token, device_id, platform, last_seen, revoked_at)
    VALUES ($1, $2, $3, $4, NOW(), NULL)
    ON CONFLICT (expo_push_token)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      device_id = EXCLUDED.device_id,
      platform = EXCLUDED.platform,
      last_seen = NOW(),
      revoked_at = NULL
    RETURNING id;
  `;

  const r = await pool.query(sql, [
    userId,
    expoPushToken,
    deviceId || null,
    platform || null,
  ]);

  return r.rows[0] || null;
}

async function revokeToken({ userId, expoPushToken }) {
  const sql = `
    UPDATE push_tokens
    SET revoked_at = NOW(), last_seen = NOW()
    WHERE user_id = $1 AND expo_push_token = $2
    RETURNING id;
  `;

  const r = await pool.query(sql, [userId, expoPushToken]);
  return r.rowCount > 0;
}

async function listActiveTokens(limit = 10000) {
  const sql = `
    SELECT expo_push_token
    FROM push_tokens
    WHERE revoked_at IS NULL
    ORDER BY last_seen DESC
    LIMIT $1;
  `;

  const { rows } = await pool.query(sql, [limit]);
  return rows.map((r) => r.expo_push_token).filter(Boolean);
}

async function sendBroadcast({ title, body, data }) {
  const tokens = await listActiveTokens();
  if (!tokens.length) return { sent: 0 };

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: data || {},
    priority: "high",
  }));

  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;

  for (const chunk of chunks) {
    // eslint-disable-next-line no-await-in-loop
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    sent += tickets.length;
  }

  return { sent };
}

module.exports = {
  upsertToken,
  revokeToken,
  sendBroadcast,
};
