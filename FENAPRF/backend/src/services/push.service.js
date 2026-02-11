// src/services/push.service.js
const { Expo } = require("expo-server-sdk");
const pool = require("../config/db");

const expo = new Expo();

async function upsertToken({ userId, expoPushToken, deviceId, platform, permissionStatus }) {
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
    INSERT INTO push_tokens (user_id, expo_push_token, device_id, platform, last_seen, revoked_at, permission_status)
    VALUES ($1, $2, $3, $4, NOW(), NULL, $5)
    ON CONFLICT (expo_push_token)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      device_id = EXCLUDED.device_id,
      platform = EXCLUDED.platform,
      last_seen = NOW(),
      revoked_at = NULL,
      permission_status = EXCLUDED.permission_status
    RETURNING id;
  `;

  const r = await pool.query(sql, [
    userId,
    expoPushToken,
    deviceId || null,
    platform || null,
    permissionStatus || 'granted'
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

  const baseSql = `
    SELECT pt.expo_push_token
    FROM push_tokens pt
    JOIN users f ON pt.user_id = f.id
    WHERE pt.revoked_at IS NULL AND pt.expo_push_token IS NOT NULL
  `;

  switch (targetType) {
    case 'UF':
      sql = `${baseSql} AND f.uf = $1`;
      params = [targetValue];
      break;
    case 'DIRETORIA':
      sql = `${baseSql} AND f.perfil_acesso = 'DIRETORIA'`;
      break;
    case 'PRESIDENTES':
      sql = `${baseSql} AND f.cargo ILIKE 'Presidente%'`;
      break;
    case 'VICES':
      sql = `${baseSql} AND f.cargo ILIKE 'Vice-Presidente%'`;
      break;
    case 'DR':
      sql = `${baseSql} AND f.cargo = 'Delegado Representante'`;
      break;
    case 'DS':
      sql = `${baseSql} AND f.cargo = 'Delegado Substituto'`;
      break;
    case 'ADMIN_COLAB':
      sql = `${baseSql} AND f.perfil_acesso IN ('ADMIN', 'COLABORADOR')`;
      break;
    case 'PADRAO':
      sql = `${baseSql} AND f.perfil_acesso IN ('DIRETORIA', 'CONSELHEIRO')`;
      break;
    case 'USER': {
      let targetIds = [];
      if (Array.isArray(targetValue)) {
        targetIds = targetValue.map(v => (typeof v === 'object' && v !== null) ? v.id : v);
      } else if (typeof targetValue === 'object' && targetValue !== null) {
        // Handle potential object with numeric keys (malformed array) or single user object
        if (targetValue.id) {
          targetIds = [targetValue.id];
        } else {
          targetIds = Object.values(targetValue).map(v => (typeof v === 'object' && v !== null) ? v.id : v).filter(Boolean);
        }
      } else if (targetValue) {
        targetIds = [targetValue];
      }

      if (targetIds.length === 0) {
          sql = "SELECT NULL LIMIT 0";
          break;
      }

      sql = `
        SELECT pt.expo_push_token
        FROM push_tokens pt
        WHERE pt.revoked_at IS NULL AND pt.expo_push_token IS NOT NULL AND pt.user_id = ANY($1)
      `;
      params = [targetIds];
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
    case 'DIRETORIA':
      usersSql = "SELECT id FROM users WHERE perfil_acesso = 'DIRETORIA'";
      break;
    case 'PRESIDENTES':
      usersSql = "SELECT id FROM users WHERE cargo ILIKE 'Presidente%'";
      break;
    case 'VICES':
      usersSql = "SELECT id FROM users WHERE cargo ILIKE 'Vice-Presidente%'";
      break;
    case 'DR':
      usersSql = "SELECT id FROM users WHERE cargo = 'Delegado Representante'";
      break;
    case 'DS':
      usersSql = "SELECT id FROM users WHERE cargo = 'Delegado Substituto'";
      break;
    case 'ADMIN_COLAB':
      usersSql = "SELECT id FROM users WHERE perfil_acesso IN ('ADMIN', 'COLABORADOR')";
      break;
    case 'PADRAO':
      usersSql = "SELECT id FROM users WHERE perfil_acesso IN ('DIRETORIA', 'CONSELHEIRO')";
      break;
    case 'USER': {
      let targetIds = [];
      if (Array.isArray(targetValue)) {
        targetIds = targetValue.map(v => (typeof v === 'object' && v !== null) ? v.id : v);
      } else if (typeof targetValue === 'object' && targetValue !== null) {
        if (targetValue.id) {
          targetIds = [targetValue.id];
        } else {
          targetIds = Object.values(targetValue).map(v => (typeof v === 'object' && v !== null) ? v.id : v).filter(Boolean);
        }
      } else if (targetValue) {
        targetIds = [targetValue];
      }

      if (targetIds.length === 0) {
          usersSql = "SELECT id FROM users WHERE id IS NULL";
          break;
      }

      usersSql = "SELECT id FROM users WHERE id = ANY($1)";
      params = [targetIds];
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
    LEFT JOIN push_tokens pt ON f.id = pt.user_id AND pt.revoked_at IS NULL
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
