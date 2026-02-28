// src/services/push.service.js
const { Expo } = require("expo-server-sdk");
const pool = require("../config/db");
const pushConfig = require("../config/push.config");
const log = require("../utils/log");

const expo = new Expo();

function normalizeProjectId(projectId, expoProjectId) {
  return String(expoProjectId || projectId || "").trim() || null;
}

function normalizeScope(s) {
  return String(s || "").trim().toUpperCase();
}

function scopeValue(appScope) {
  return normalizeScope(appScope || pushConfig.APP_SCOPE);
}

function configuredExpoProjectId() {
  return String(pushConfig.EXPO_PROJECT_ID || "").trim() || null;
}

function normalizeTargetId(targetValue) {
  const rawId = typeof targetValue === "object" && targetValue !== null ? targetValue.id : targetValue;
  const targetId = Number.parseInt(rawId, 10);
  if (Number.isNaN(targetId)) {
    const err = new Error("targetValue.id inválido para FILIADO.");
    err.statusCode = 400;
    throw err;
  }
  return targetId;
}

function buildResolveTargetClause(targetType, targetValue, startIndex = 1) {
  const conditions = [];
  const params = [];
  let joins = "";

  switch (targetType) {
    case "ATIVOS":
      joins = "JOIN filiados f ON pt.user_id = f.id";
      conditions.push("f.situacao = 'ATIVO'");
      break;
    case "VETERANOS":
      joins = "JOIN filiados f ON pt.user_id = f.id";
      conditions.push("(f.situacao = 'VETERANO' OR f.situacao = 'PENSIONISTA')");
      break;
    case "LOTACAO":
      joins = "JOIN filiados f ON pt.user_id = f.id";
      conditions.push("f.situacao = 'ATIVO'");
      conditions.push(`f.lotacao = $${startIndex + params.length}`);
      params.push(targetValue);
      break;
    case "JOGOS":
      joins = "JOIN inscricoes_jogos ij ON pt.user_id = ij.filiado_id";
      break;
    case "FILIADO": {
      const targetId = normalizeTargetId(targetValue);
      conditions.push(`pt.user_id = $${startIndex + params.length}`);
      params.push(targetId);
      break;
    }
    case "ALL":
    default:
      break;
  }

  return { joins, conditions, params };
}

function buildValidPushTokenFilters({ scope, expoProjectId, startIndex = 1 }) {
  const where = [
    "pt.revoked_at IS NULL",
    "pt.disabled_at IS NULL",
    "pt.expo_push_token IS NOT NULL",
    `UPPER(TRIM(pt.app_scope)) = UPPER(TRIM($${startIndex}))`
  ];
  const params = [scope];

  if (expoProjectId) {
    where.push(`pt.expo_project_id = $${startIndex + 1}`);
    params.push(expoProjectId);
  } else {
    where.push("NULLIF(TRIM(pt.expo_project_id), '') IS NOT NULL");
  }

  return {
    where,
    params
  };
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
  let tokenExpoProjectId = normalizeProjectId(projectId, expoProjectId);

  if (isExpo && !tokenExpoProjectId && expoPushToken) {
    const existing = await pool.query(
      `SELECT expo_project_id FROM push_tokens WHERE expo_push_token = $1 LIMIT 1`,
      [expoPushToken]
    );
    const existingProjectId = normalizeProjectId(existing.rows[0]?.expo_project_id, existing.rows[0]?.expo_project_id);
    if (existingProjectId) {
      tokenExpoProjectId = existingProjectId;
      log.info("PushService.UpsertTokenReuseExistingProjectId", { userId, appScope: finalScope });
    }
  }

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
      AND UPPER(TRIM(app_scope)) = UPPER(TRIM($2))
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

async function deactivateOtherProjectTokens(userId, currentProjectId, currentAppScope) {
  if (!userId || !currentProjectId || !currentAppScope) return;
  const sql = `
    UPDATE push_tokens
    SET
      disabled_at = NOW(),
      disabled_reason = 'project_mismatch'
    WHERE
      user_id = $1
      AND UPPER(TRIM(app_scope)) = UPPER(TRIM($3))
      AND expo_project_id IS NOT NULL
      AND expo_project_id != $2
      AND revoked_at IS NULL
      AND disabled_at IS NULL;
  `;
  await pool.query(sql, [userId, currentProjectId, currentAppScope]);
}

async function listActiveTokens(limit = 10000) {
  const sql = `
    SELECT expo_push_token, expo_project_id
    FROM push_tokens
    WHERE revoked_at IS NULL
      AND disabled_at IS NULL
      AND expo_push_token IS NOT NULL
      AND UPPER(TRIM(app_scope)) = UPPER(TRIM($2))
      AND expo_project_id = $3
    ORDER BY last_seen DESC
    LIMIT $1;
  `;

  const scope = normalizeScope(pushConfig.APP_SCOPE);
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
  const normalizedScope = normalizeScope(currentAppScope);
  const sql = `
    UPDATE push_tokens
    SET
      disabled_at = NOW(),
      disabled_reason = 'scope_mismatch'
    WHERE
      user_id = $1
      AND UPPER(TRIM(app_scope)) != UPPER(TRIM($2))
      AND revoked_at IS NULL
      AND disabled_at IS NULL;
  `;
  await pool.query(sql, [userId, normalizedScope]);
}

async function resolvePushTargets(targetType, targetValue) {
  const scope = normalizeScope(pushConfig.APP_SCOPE);
  const expoProjectId = configuredExpoProjectId();
  const normalizedTargetValue = targetType === "FILIADO" ? normalizeTargetId(targetValue) : targetValue;

  log.info("PushService.ResolveTargetsInput", {
    targetType,
    targetId: targetType === "FILIADO" ? normalizedTargetValue : null,
    scope,
    scopeRaw: JSON.stringify(scope),
    scopeLen: scope.length,
    expoProjectId
  });

  const targetClause = buildResolveTargetClause(targetType, normalizedTargetValue);
  const validFilters = buildValidPushTokenFilters({ scope, expoProjectId, startIndex: targetClause.params.length + 1 });

  const sql = `
    SELECT ${targetType === "JOGOS" ? "DISTINCT" : ""} pt.expo_push_token, pt.expo_project_id
    FROM push_tokens pt
    ${targetClause.joins}
    WHERE ${[...validFilters.where, ...targetClause.conditions].join(" AND ")}
  `;
  const params = [...targetClause.params, ...validFilters.params];

  const { rows } = await pool.query(sql, params);
  const diagnostics = await getResolveDiagnostics(targetType, normalizedTargetValue);

  log.info("PushService.ResolveTargetsCounts", {
    targetType,
    targetValue: normalizedTargetValue,
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
    log.warn("PushService.ResolveTargetsEmpty", { targetType, targetValue: normalizedTargetValue, scope, diagnostics });
  }

  return rows
    .map((r) => ({ token: r.expo_push_token, projectId: r.expo_project_id, expoProjectId: r.expo_project_id }))
    .filter((r) => !!r.token && !!r.expoProjectId);
}

async function getResolveDiagnostics(targetType, targetValue) {
  const scope = normalizeScope(pushConfig.APP_SCOPE);
  const envExpoProjectId = configuredExpoProjectId();
  const normalizedTargetValue = targetType === "FILIADO" ? normalizeTargetId(targetValue) : targetValue;
  const targetClause = buildResolveTargetClause(targetType, normalizedTargetValue);
  const validFilters = buildValidPushTokenFilters({ scope, expoProjectId: envExpoProjectId, startIndex: targetClause.params.length + 1 });

  const diagSql = `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as revoked,
      COUNT(*) FILTER (WHERE disabled_at IS NOT NULL) as disabled,
      COUNT(*) FILTER (WHERE disabled_reason IN ('missing_expo_project_id', 'missing_project_id')) as missing_project_id,
      COUNT(*) FILTER (WHERE UPPER(TRIM(app_scope)) != UPPER(TRIM($${targetClause.params.length + 1}))) as other_scope,
      COUNT(*) FILTER (WHERE expo_project_id IS NULL OR expo_project_id = '') as without_expo_project_id,
      COUNT(*) FILTER (WHERE expo_project_id IS NOT NULL ${envExpoProjectId ? `AND expo_project_id != $${targetClause.params.length + 2}` : ""}) as project_mismatch_scope
    FROM (
      SELECT pt.*
      FROM push_tokens pt
      ${targetClause.joins}
      WHERE ${[...validFilters.where, ...targetClause.conditions].join(" AND ")}
    ) base
  `;

  const diag = await pool.query(diagSql, [...targetClause.params, ...validFilters.params]);
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
      const targetIdCount = normalizeTargetId(targetValue);
      filiadosSql = "SELECT id FROM filiados WHERE id = $1";
      params = [targetIdCount];
      break;
    }
    case "ALL":
    default:
      filiadosSql = "SELECT id FROM filiados WHERE situacao IN ('ATIVO', 'VETERANO', 'PENSIONISTA')";
      break;
  }

  const appScopeParamIndex = params.length + 1;
  const scopeParams = [normalizeScope(pushConfig.APP_SCOPE)];
  let projectFilterSql = "NULLIF(TRIM(pt.expo_project_id), '') IS NOT NULL";
  const configuredProjectId = configuredExpoProjectId();
  if (configuredProjectId) {
    projectFilterSql = `pt.expo_project_id = $${params.length + 2}`;
    scopeParams.push(configuredProjectId);
  }

  sql = `
    SELECT COUNT(*) as count
    FROM (${filiadosSql}) f
    LEFT JOIN push_tokens pt ON f.id = pt.user_id
      AND pt.revoked_at IS NULL
      AND pt.disabled_at IS NULL
      AND pt.expo_push_token IS NOT NULL
      AND UPPER(TRIM(pt.app_scope)) = UPPER(TRIM($${appScopeParamIndex}))
      AND ${projectFilterSql}
    WHERE pt.id IS NULL OR pt.permission_status = 'denied'
  `;

  params.push(...scopeParams);

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
  getResolveDiagnostics,
  normalizeScope
};
