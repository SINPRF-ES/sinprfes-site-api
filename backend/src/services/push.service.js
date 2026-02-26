// src/services/push.service.js
const { Expo } = require("expo-server-sdk");
const pool = require("../config/db");

const expo = new Expo();

async function upsertToken({ userId, expoPushToken, deviceId, platform, permissionStatus, projectId }) {
  // Se for negado, podemos não ter o token, mas registramos o status se tivermos userId
  if (permissionStatus === 'denied' && !expoPushToken) {
    // Apenas log de interesse para saber que o usuário negou
    return { status: 'denied_recorded' };
  }

  if (expoPushToken && !Expo.isExpoPushToken(expoPushToken)) {
    throw new Error("ExpoPushToken inválido.");
  }

  const sql = `
    INSERT INTO push_tokens (user_id, expo_push_token, device_id, platform, last_seen, revoked_at, permission_status, project_id, disabled_at, disabled_reason)
    VALUES ($1, $2, $3, $4, NOW(), NULL, $5, $6, NULL, NULL)
    ON CONFLICT (expo_push_token)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      device_id = EXCLUDED.device_id,
      platform = EXCLUDED.platform,
      last_seen = NOW(),
      revoked_at = NULL,
      permission_status = EXCLUDED.permission_status,
      project_id = EXCLUDED.project_id,
      disabled_at = NULL,
      disabled_reason = NULL
    RETURNING id;
  `;

  const r = await pool.query(sql, [
    userId,
    expoPushToken ? String(expoPushToken) : null,
    deviceId ? String(deviceId) : null,
    platform ? String(platform) : null,
    permissionStatus ? String(permissionStatus) : 'granted',
    projectId ? String(projectId) : null
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

/**
 * Desativa tokens de outros projetos para o mesmo usuário.
 * Ajuda a manter apenas tokens do projeto EAS atual ativos.
 */
async function deactivateOtherProjectTokens(userId, currentProjectId) {
  if (!userId || !currentProjectId) return;
  const sql = `
    UPDATE push_tokens
    SET
      disabled_at = NOW(),
      disabled_reason = 'project_mismatch'
    WHERE
      user_id = $1
      AND project_id IS NOT NULL
      AND project_id != $2
      AND revoked_at IS NULL
      AND disabled_at IS NULL;
  `;
  await pool.query(sql, [userId, currentProjectId]);
}

async function listActiveTokens(limit = 10000) {
  const sql = `
    SELECT expo_push_token, project_id
    FROM push_tokens
    WHERE revoked_at IS NULL AND disabled_at IS NULL AND expo_push_token IS NOT NULL
    ORDER BY last_seen DESC
    LIMIT $1;
  `;

  const { rows } = await pool.query(sql, [limit]);
  return rows.map((r) => ({
    token: r.expo_push_token,
    projectId: r.project_id
  })).filter(r => !!r.token);
}

/**
 * Retorna todos os tokens vinculados a um usuário para diagnóstico.
 */
async function getDiagnostics(userId) {
  const sql = `
    SELECT
      expo_push_token,
      project_id,
      platform,
      device_id,
      last_seen,
      revoked_at,
      disabled_at,
      disabled_reason,
      permission_status
    FROM push_tokens
    WHERE user_id = $1
    ORDER BY last_seen DESC;
  `;
  const { rows } = await pool.query(sql, [userId]);
  return rows;
}

/**
 * Resolve destinatários com base no targetType e targetValue
 */
async function resolvePushTargets(targetType, targetValue) {
  let sql = "";
  let params = [];

  switch (targetType) {
    case 'ATIVOS':
      sql = `
        SELECT pt.expo_push_token, pt.project_id
        FROM push_tokens pt
        JOIN filiados f ON pt.user_id = f.id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND f.situacao = 'ATIVO'
      `;
      break;
    case 'VETERANOS':
      sql = `
        SELECT pt.expo_push_token, pt.project_id
        FROM push_tokens pt
        JOIN filiados f ON pt.user_id = f.id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND (f.situacao = 'VETERANO' OR f.situacao = 'PENSIONISTA')
      `;
      break;
    case 'LOTACAO':
      sql = `
        SELECT pt.expo_push_token, pt.project_id
        FROM push_tokens pt
        JOIN filiados f ON pt.user_id = f.id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND f.situacao = 'ATIVO' AND f.lotacao = $1
      `;
      params = [targetValue];
      break;
    case 'JOGOS':
      // Exemplo: inscritos em qualquer modalidade dos jogos
      sql = `
        SELECT DISTINCT pt.expo_push_token, pt.project_id
        FROM push_tokens pt
        JOIN inscricoes_jogos ij ON pt.user_id = ij.filiado_id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL
      `;
      break;
    case 'FILIADO': {
      const targetId = (typeof targetValue === 'object' && targetValue !== null) ? targetValue.id : targetValue;
      sql = `
        SELECT pt.expo_push_token, pt.project_id
        FROM push_tokens pt
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND pt.user_id = $1
      `;
      params = [targetId];
      break;
    }
    case 'ALL':
    default:
      sql = `
        SELECT pt.expo_push_token, pt.project_id
        FROM push_tokens pt
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND pt.expo_push_token IS NOT NULL
      `;
      break;
  }

  const { rows } = await pool.query(sql, params);
  return rows.map(r => ({
    token: r.expo_push_token,
    projectId: r.project_id
  })).filter(r => !!r.token);
}

/**
 * Conta quantos filiados no público alvo NÃO possuem token ou negaram
 */
async function countNoTokenTargets(targetType, targetValue) {
  let sql = "";
  let params = [];

  // Subquery para filiados que casam com o critério
  let filiadosSql = "";
  switch (targetType) {
    case 'ATIVOS':
      filiadosSql = "SELECT id FROM filiados WHERE situacao = 'ATIVO'";
      break;
    case 'VETERANOS':
      filiadosSql = "SELECT id FROM filiados WHERE situacao = 'VETERANO' OR situacao = 'PENSIONISTA'";
      break;
    case 'LOTACAO':
      filiadosSql = "SELECT id FROM filiados WHERE situacao = 'ATIVO' AND lotacao = $1";
      params = [targetValue];
      break;
    case 'FILIADO': {
      const targetIdCount = (typeof targetValue === 'object' && targetValue !== null) ? targetValue.id : targetValue;
      filiadosSql = "SELECT id FROM filiados WHERE id = $1";
      params = [targetIdCount];
      break;
    }
    case 'ALL':
    default:
      filiadosSql = "SELECT id FROM filiados WHERE situacao IN ('ATIVO', 'VETERANO', 'PENSIONISTA')";
      break;
  }

  sql = `
    SELECT COUNT(*) as count
    FROM (${filiadosSql}) f
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
  const targets = await listActiveTokens();
  if (!targets.length) return { sent: 0 };

  // Agrupar por project_id para evitar erro do Expo
  const groups = targets.reduce((acc, curr) => {
    const pid = curr.projectId || "unspecified";
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(curr.token);
    return acc;
  }, {});

  let sent = 0;
  for (const [projectId, tokens] of Object.entries(groups)) {
    const messages = tokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data: data || {},
      priority: "high",
      ...(projectId !== "unspecified" ? { _projectId: projectId } : {})
    }));

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      // eslint-disable-next-line no-await-in-loop
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      sent += tickets.length;
    }
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
  revokeSpecificToken,
  deactivateOtherProjectTokens,
  getDiagnostics
};
