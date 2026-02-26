// src/services/push.service.js
const { Expo } = require("expo-server-sdk");
const pool = require("../config/db");
const pushConfig = require("../config/push.config");
const log = require("../utils/log");

const expo = new Expo();

function normalizeProjectId(projectId, expoProjectId) {
  return String(expoProjectId || projectId || "").trim() || null;
}

function scopeValue(appScope) {
  return appScope || pushConfig.APP_SCOPE;
}

function configuredExpoProjectId() {
  return String(pushConfig.EXPO_PROJECT_ID || "").trim() || null;
}

async function upsertToken({ userId, expoPushToken, deviceId, platform, permissionStatus, projectId, appScope, expoProjectId }) {
  if (permissionStatus === "denied" && !expoPushToken) {
    return { status: "denied_recorded" };
  }

  const isExpo = expoPushToken && Expo.isExpoPushToken(expoPushToken);
  if (expoPushToken && !isExpo) {
    throw new Error("ExpoPushToken inválido.");
  }

  const finalScope = scopeValue(appScope);
  const envExpoProjectId = configuredExpoProjectId();
  const tokenExpoProjectId = normalizeProjectId(projectId, expoProjectId);

  let disabledAt = null;
  let disabledReason = null;

  if (isExpo && !tokenExpoProjectId) {
    disabledAt = new Date();
    disabledReason = "missing_expo_project_id";
    log.warn("PushService.UpsertTokenMissingExpoProjectId", { userId, appScope: finalScope, hasToken: !!expoPushToken });
  } else if (isExpo && tokenExpoProjectId && envExpoProjectId && tokenExpoProjectId !== envExpoProjectId) {
    disabledAt = new Date();
    disabledReason = "expo_project_mismatch";
    log.warn("PushService.UpsertTokenProjectMismatch", {
      userId,
      appScope: finalScope,
      tokenExpoProjectId,
      expectedExpoProjectId: envExpoProjectId
    });
  }

  const sql = `
    INSERT INTO push_tokens (
      user_id, expo_push_token, device_id, platform, last_seen,
      revoked_at, permission_status, project_id, disabled_at, disabled_reason,
      app_scope, expo_project_id, updated_at
    )
    VALUES ($1, $2, $3, $4, NOW(), NULL, $5, $6, $9, $10, $7, $8, NOW())
    ON CONFLICT (expo_push_token)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      device_id = EXCLUDED.device_id,
      platform = EXCLUDED.platform,
      last_seen = NOW(),
      revoked_at = NULL,
      permission_status = EXCLUDED.permission_status,
      project_id = EXCLUDED.project_id,
      disabled_at = EXCLUDED.disabled_at,
      disabled_reason = EXCLUDED.disabled_reason,
      app_scope = EXCLUDED.app_scope,
      expo_project_id = EXCLUDED.expo_project_id,
      updated_at = NOW()
    RETURNING id;
  `;

  const r = await pool.query(sql, [
    userId,
    expoPushToken ? String(expoPushToken) : null,
    deviceId ? String(deviceId) : null,
    platform ? String(platform) : null,
    permissionStatus ? String(permissionStatus) : "granted",
    tokenExpoProjectId,
    finalScope,
    tokenExpoProjectId,
    disabledAt,
    disabledReason
  ]);

  await cleanupDuplicateTokens({
    userId,
    appScope: finalScope,
    expoProjectId: tokenExpoProjectId,
    deviceId,
    keepToken: expoPushToken
  });

  if (tokenExpoProjectId && (!envExpoProjectId || tokenExpoProjectId === envExpoProjectId)) {
    await pool.query(
      `
      UPDATE push_tokens
      SET disabled_at = NULL, disabled_reason = NULL
      WHERE expo_push_token = $1
        AND disabled_reason IN ('missing_expo_project_id', 'expo_project_mismatch', 'missing_project_id')
      `,
      [expoPushToken]
    );
  }

  return { ...(r.rows[0] || null), disabled_reason: disabledReason };
}

async function cleanupDuplicateTokens({ userId, appScope, expoProjectId, deviceId, keepToken }) {
  if (!userId || !appScope || !expoProjectId || !deviceId || !keepToken) return;

  const sql = `
    UPDATE push_tokens
    SET
      disabled_at = NOW(),
      disabled_reason = 'deduplicated'
    WHERE user_id = $1
      AND app_scope = $2
      AND expo_project_id = $3
      AND device_id = $4
      AND expo_push_token != $5
      AND revoked_at IS NULL
      AND disabled_at IS NULL;
  `;

  await pool.query(sql, [userId, appScope, expoProjectId, deviceId, keepToken]);
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

async function deactivateOtherProjectTokens(userId, currentProjectId) {
  if (!userId || !currentProjectId) return;
  const sql = `
    UPDATE push_tokens
    SET
      disabled_at = NOW(),
      disabled_reason = 'project_mismatch'
    WHERE
      user_id = $1
      AND expo_project_id IS NOT NULL
      AND expo_project_id != $2
      AND revoked_at IS NULL
      AND disabled_at IS NULL;
  `;
  await pool.query(sql, [userId, currentProjectId]);
}

async function listActiveTokens(limit = 10000) {
  const sql = `
    SELECT expo_push_token, expo_project_id
    FROM push_tokens
    WHERE revoked_at IS NULL
      AND disabled_at IS NULL
      AND expo_push_token IS NOT NULL
      AND app_scope = $2
      AND expo_project_id = $3
    ORDER BY last_seen DESC
    LIMIT $1;
  `;

  const scope = pushConfig.APP_SCOPE;
  const expoProjectId = configuredExpoProjectId();
  const { rows } = await pool.query(sql, [limit, scope, expoProjectId]);

  return rows
    .map((r) => ({ token: r.expo_push_token, projectId: r.expo_project_id, expoProjectId: r.expo_project_id }))
    .filter((r) => !!r.token && !!r.expoProjectId);
}

async function getDiagnostics(userId) {
  const sql = `
    SELECT
      expo_push_token,
      project_id,
      expo_project_id,
      app_scope,
      platform,
      device_id,
      last_seen,
      revoked_at,
      disabled_at,
      disabled_reason,
      permission_status,
      updated_at
    FROM push_tokens
    WHERE user_id = $1
    ORDER BY last_seen DESC;
  `;
  const { rows } = await pool.query(sql, [userId]);
  return rows;
}

async function getScopesDiagnostics() {
  const sql = `
    SELECT
      app_scope,
      expo_project_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE revoked_at IS NULL AND disabled_at IS NULL) as valid,
      COUNT(*) FILTER (WHERE disabled_reason IN ('missing_expo_project_id', 'missing_project_id')) as missing_project_id,
      MIN(last_seen) as oldest,
      MAX(last_seen) as newest
    FROM push_tokens
    GROUP BY app_scope, expo_project_id
    ORDER BY valid DESC, total DESC;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

async function deactivateMismatchedScopeTokens(userId, currentAppScope) {
  if (!userId || !currentAppScope) return;
  const sql = `
    UPDATE push_tokens
    SET
      disabled_at = NOW(),
      disabled_reason = 'scope_mismatch'
    WHERE
      user_id = $1
      AND app_scope != $2
      AND revoked_at IS NULL
      AND disabled_at IS NULL;
  `;
  await pool.query(sql, [userId, currentAppScope]);
}

async function resolvePushTargets(targetType, targetValue) {
  let sql = "";
  let params = [];
  const scope = pushConfig.APP_SCOPE;
  const expoProjectId = configuredExpoProjectId();

  switch (targetType) {
    case "ATIVOS":
      sql = `
        SELECT pt.expo_push_token, pt.expo_project_id
        FROM push_tokens pt
        JOIN filiados f ON pt.user_id = f.id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND f.situacao = 'ATIVO'
          AND pt.app_scope = $1
          AND pt.expo_project_id = $2
      `;
      params = [scope, expoProjectId];
      break;
    case "VETERANOS":
      sql = `
        SELECT pt.expo_push_token, pt.expo_project_id
        FROM push_tokens pt
        JOIN filiados f ON pt.user_id = f.id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND (f.situacao = 'VETERANO' OR f.situacao = 'PENSIONISTA')
          AND pt.app_scope = $1
          AND pt.expo_project_id = $2
      `;
      params = [scope, expoProjectId];
      break;
    case "LOTACAO":
      sql = `
        SELECT pt.expo_push_token, pt.expo_project_id
        FROM push_tokens pt
        JOIN filiados f ON pt.user_id = f.id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND f.situacao = 'ATIVO' AND f.lotacao = $1
          AND pt.app_scope = $2
          AND pt.expo_project_id = $3
      `;
      params = [targetValue, scope, expoProjectId];
      break;
    case "JOGOS":
      sql = `
        SELECT DISTINCT pt.expo_push_token, pt.expo_project_id
        FROM push_tokens pt
        JOIN inscricoes_jogos ij ON pt.user_id = ij.filiado_id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL
          AND pt.app_scope = $1
          AND pt.expo_project_id = $2
      `;
      params = [scope, expoProjectId];
      break;
    case "FILIADO": {
      const targetId = typeof targetValue === "object" && targetValue !== null ? targetValue.id : targetValue;
      sql = `
        SELECT pt.expo_push_token, pt.expo_project_id
        FROM push_tokens pt
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND pt.user_id = $1
          AND pt.app_scope = $2
          AND pt.expo_project_id = $3
      `;
      params = [targetId, scope, expoProjectId];
      break;
    }
    case "ALL":
    default:
      sql = `
        SELECT pt.expo_push_token, pt.expo_project_id
        FROM push_tokens pt
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND pt.expo_push_token IS NOT NULL
          AND pt.app_scope = $1
          AND pt.expo_project_id = $2
      `;
      params = [scope, expoProjectId];
      break;
  }

  const { rows } = await pool.query(sql, params);
  const diagnostics = await getResolveDiagnostics(targetType, targetValue);

  log.info("PushService.ResolveTargetsCounts", {
    targetType,
    targetValue,
    scope,
    expoProjectId,
    totalOriginal: Number(diagnostics.total || 0),
    totalValid: rows.length,
    invalid_missing_expo_project_id: Number(diagnostics.without_expo_project_id || 0),
    invalid_project_mismatch: Number(diagnostics.project_mismatch_scope || 0),
    revoked: Number(diagnostics.revoked || 0),
    disabled: Number(diagnostics.disabled || 0)
  });

  if (rows.length === 0) {
    log.warn("PushService.ResolveTargetsEmpty", { targetType, targetValue, scope, diagnostics });
  }

  return rows
    .map((r) => ({ token: r.expo_push_token, projectId: r.expo_project_id, expoProjectId: r.expo_project_id }))
    .filter((r) => !!r.token && !!r.expoProjectId);
}

async function getResolveDiagnostics(targetType, targetValue) {
  const scope = pushConfig.APP_SCOPE;
  const envExpoProjectId = configuredExpoProjectId();
  const targetId = targetType === "FILIADO" ? (typeof targetValue === "object" && targetValue !== null ? targetValue.id : targetValue) : null;
  const diagSql = `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as revoked,
      COUNT(*) FILTER (WHERE disabled_at IS NOT NULL) as disabled,
      COUNT(*) FILTER (WHERE disabled_reason IN ('missing_expo_project_id', 'missing_project_id')) as missing_project_id,
      COUNT(*) FILTER (WHERE app_scope != $1) as other_scope,
      COUNT(*) FILTER (WHERE expo_project_id IS NULL OR expo_project_id = '') as without_expo_project_id,
      COUNT(*) FILTER (WHERE expo_project_id IS NOT NULL AND expo_project_id != $3) as project_mismatch_scope
    FROM push_tokens
    WHERE user_id = $2 OR $2 IS NULL
  `;

  const diag = await pool.query(diagSql, [scope, targetId, envExpoProjectId]);
  return diag.rows[0] || null;
}

async function countNoTokenTargets(targetType, targetValue) {
  let sql = "";
  let params = [];
  let filiadosSql = "";

  switch (targetType) {
    case "ATIVOS":
      filiadosSql = "SELECT id FROM filiados WHERE situacao = 'ATIVO'";
      break;
    case "VETERANOS":
      filiadosSql = "SELECT id FROM filiados WHERE situacao = 'VETERANO' OR situacao = 'PENSIONISTA'";
      break;
    case "LOTACAO":
      filiadosSql = "SELECT id FROM filiados WHERE situacao = 'ATIVO' AND lotacao = $1";
      params = [targetValue];
      break;
    case "FILIADO": {
      const targetIdCount = typeof targetValue === "object" && targetValue !== null ? targetValue.id : targetValue;
      filiadosSql = "SELECT id FROM filiados WHERE id = $1";
      params = [targetIdCount];
      break;
    }
    case "ALL":
    default:
      filiadosSql = "SELECT id FROM filiados WHERE situacao IN ('ATIVO', 'VETERANO', 'PENSIONISTA')";
      break;
  }

  sql = `
    SELECT COUNT(*) as count
    FROM (${filiadosSql}) f
    LEFT JOIN push_tokens pt ON f.id = pt.user_id
      AND pt.revoked_at IS NULL
      AND pt.app_scope = $${params.length + 1}
      AND pt.expo_project_id = $${params.length + 2}
    WHERE pt.id IS NULL OR pt.permission_status = 'denied'
  `;

  params.push(pushConfig.APP_SCOPE, configuredExpoProjectId());

  const { rows } = await pool.query(sql, params);
  return parseInt(rows[0].count, 10) || 0;
}

async function revokeSpecificToken(expoPushToken) {
  const sql = `UPDATE push_tokens SET revoked_at = NOW() WHERE expo_push_token = $1`;
  await pool.query(sql, [expoPushToken]);
}

async function sendBroadcast({ title, body, data }) {
  const targets = await listActiveTokens();
  if (!targets.length) return { sent: 0, ignoredNoProjectId: 0 };

  const messages = targets.map((target) => ({
    to: target.token,
    sound: "default",
    title,
    body,
    data: data || {},
    priority: "high",
    projectId: target.expoProjectId
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
  revokeSpecificToken,
  deactivateOtherProjectTokens,
  getDiagnostics,
  getScopesDiagnostics,
  deactivateMismatchedScopeTokens,
  getResolveDiagnostics
};
