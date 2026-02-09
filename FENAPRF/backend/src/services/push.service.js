// src/services/push.service.js
const { Expo } = require("expo-server-sdk");
const pool = require("../config/db");
const { isUuid } = require("../utils/format");

const expo = new Expo();

async function upsertToken({ userId, expoPushToken, deviceId, platform, permissionStatus }) {
  const userIdInt = isUuid(userId) ? null : parseInt(userId, 10);
  const userIdUuid = isUuid(userId) ? userId : null;

  // Se for negado, podemos não ter o token, mas registramos o status se tivermos userId
  if (permissionStatus === 'denied' && !expoPushToken) {
    // Apenas log de interesse para saber que o membro negou
    // Nota: Futuramente podemos persistir o status 'denied' vinculado ao user_id_uuid + device_id
    return { status: 'denied_recorded' };
  }

  if (expoPushToken && !Expo.isExpoPushToken(expoPushToken)) {
    throw new Error("ExpoPushToken inválido.");
  }

  const sql = `
    INSERT INTO push_tokens (user_id, user_id_uuid, expo_push_token, device_id, platform, last_seen, revoked_at, permission_status)
    VALUES ($1, $2, $3, $4, $5, NOW(), NULL, $6)
    ON CONFLICT (expo_push_token)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      user_id_uuid = EXCLUDED.user_id_uuid,
      device_id = EXCLUDED.device_id,
      platform = EXCLUDED.platform,
      last_seen = NOW(),
      revoked_at = NULL,
      permission_status = EXCLUDED.permission_status
    RETURNING id;
  `;

  const r = await pool.query(sql, [
    userIdInt,
    userIdUuid,
    expoPushToken,
    deviceId || null,
    platform || null,
    permissionStatus || 'granted'
  ]);

  return r.rows[0] || null;
}

async function revokeToken({ userId, expoPushToken }) {
  const userIdInt = isUuid(userId) ? null : parseInt(userId, 10);
  const userIdUuid = isUuid(userId) ? userId : null;

  const sql = `
    UPDATE push_tokens
    SET revoked_at = NOW(), last_seen = NOW()
    WHERE (user_id = $1 OR user_id_uuid = $2) AND expo_push_token = $3
    RETURNING id;
  `;

  const r = await pool.query(sql, [userIdInt, userIdUuid, expoPushToken]);
  return r.rowCount > 0;
}

async function listActiveTokens(limit = 10000) {
  const sql = `
    SELECT expo_push_token
    FROM push_tokens
    WHERE revoked_at IS NULL AND expo_push_token IS NOT NULL
    ORDER BY last_seen DESC
    LIMIT $1;
  `;

  const { rows } = await pool.query(sql, [limit]);
  return rows.map((r) => r.expo_push_token).filter(Boolean);
}

/**
 * Resolve destinatários com base no targetType e targetValue
 */
async function resolvePushTargets(targetType, targetValue) {
  let sql = "";
  let params = [];

  switch (targetType) {
    case 'UF':
      sql = `
        SELECT pt.expo_push_token
        FROM push_tokens pt
        JOIN users f ON (pt.user_id_uuid = f.id)
        WHERE pt.revoked_at IS NULL AND f.uf = $1
      `;
      params = [targetValue];
      break;
    case 'JOGOS':
      // Exemplo: inscritos em qualquer modalidade dos jogos
      sql = `
        SELECT DISTINCT pt.expo_push_token
        FROM push_tokens pt
        JOIN pre_inscricoes_jogos ij ON (pt.user_id_uuid = ij.user_id)
        WHERE pt.revoked_at IS NULL
      `;
      break;
    case 'USER': {
      const targetId = (typeof targetValue === 'object' && targetValue !== null) ? targetValue.id : targetValue;
      const targetIsUuid = isUuid(targetId);
      sql = `
        SELECT pt.expo_push_token
        FROM push_tokens pt
        WHERE pt.revoked_at IS NULL AND (${targetIsUuid ? 'pt.user_id_uuid' : 'pt.user_id'} = $1)
      `;
      params = [targetId];
      break;
    }
    case 'ALL':
    default:
      sql = `
        SELECT pt.expo_push_token
        FROM push_tokens pt
        WHERE pt.revoked_at IS NULL AND pt.expo_push_token IS NOT NULL
      `;
      break;
  }

  const { rows } = await pool.query(sql, params);
  return rows.map(r => r.expo_push_token).filter(Boolean);
}

/**
 * Conta quantos users no público alvo NÃO possuem token ou negaram
 */
async function countNoTokenTargets(targetType, targetValue) {
  let sql = "";
  let params = [];

  // Subquery para users que casam com o critério
  let usersSql = "";
  switch (targetType) {
    case 'UF':
      usersSql = "SELECT id FROM users WHERE uf = $1";
      params = [targetValue];
      break;
    case 'USER': {
      const targetIdCount = (typeof targetValue === 'object' && targetValue !== null) ? targetValue.id : targetValue;
      usersSql = "SELECT id FROM users WHERE id = $1";
      params = [targetIdCount];
      break;
    }
    case 'ALL':
    default:
      usersSql = "SELECT id FROM users";
      break;
  }

  sql = `
    SELECT COUNT(*) as count
    FROM (${usersSql}) f
    LEFT JOIN push_tokens pt ON (f.id = pt.user_id_uuid) AND pt.revoked_at IS NULL
    WHERE pt.id IS NULL OR pt.permission_status = 'denied'
  `;

  const { rows } = await pool.query(sql, params);
  return parseInt(rows[0].count, 10) || 0;
}

async function revokeSpecificToken(expoPushToken) {
    const sql = `UPDATE push_tokens SET revoked_at = NOW() WHERE expo_push_token = $1`;
    await pool.query(sql, [expoPushToken]);
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
  listActiveTokens,
  sendBroadcast,
  resolvePushTargets,
  countNoTokenTargets,
  revokeSpecificToken
};
