// src/services/push.service.js
const { Expo } = require("expo-server-sdk");
const pool = require("../config/db");
const pushConfig = require("../config/push.config");
const log = require("../utils/log");

const expo = new Expo();

async function upsertToken({ userId, expoPushToken, deviceId, platform, permissionStatus, projectId, appScope, expoProjectId }) {
  // Se for negado, podemos não ter o token, mas registramos o status se tivermos userId
  if (permissionStatus === 'denied' && !expoPushToken) {
    // Apenas log de interesse para saber que o usuário negou
    return { status: 'denied_recorded' };
  }

  const isExpo = expoPushToken && Expo.isExpoPushToken(expoPushToken);
  if (expoPushToken && !isExpo) {
    throw new Error("ExpoPushToken inválido.");
  }

  // Normalização de project IDs
  let finalProjectId = projectId;
  let finalExpoProjectId = expoProjectId;

  if (finalExpoProjectId && !finalProjectId) finalProjectId = finalExpoProjectId;
  if (finalProjectId && !finalExpoProjectId) finalExpoProjectId = finalProjectId;

  // Hard validation: Se o token for do Expo, ele DEVE ter um project_id associado
  // Caso contrário, ele será desativado para evitar ChunkError no SDK
  let disabledAt = null;
  let disabledReason = null;

  if (isExpo && (!finalExpoProjectId || finalExpoProjectId === '') && (!finalProjectId || finalProjectId === '')) {
    disabledAt = new Date();
    disabledReason = 'missing_project_id';
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
    permissionStatus ? String(permissionStatus) : 'granted',
    finalProjectId ? String(finalProjectId) : null,
    appScope || pushConfig.APP_SCOPE,
    finalExpoProjectId ? String(finalExpoProjectId) : null,
    disabledAt,
    disabledReason
  ]);

  const result = r.rows[0] || null;
  if (result && disabledReason) {
    result.disabled_reason = disabledReason;
  }

  await cleanupDuplicateTokens({
    userId,
    appScope: appScope || pushConfig.APP_SCOPE,
    expoProjectId: finalExpoProjectId || finalProjectId,
    deviceId,
    keepToken: expoPushToken
  });

  // Reabilitar automaticamente se o token tinha sido desativado apenas por ausência de projectId
  if (finalExpoProjectId || finalProjectId) {
    await pool.query(`
      UPDATE push_tokens
      SET disabled_at = NULL, disabled_reason = NULL
      WHERE expo_push_token = $1
        AND disabled_reason = 'missing_project_id'
    `, [expoPushToken]);
  }

  return result;
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
      AND COALESCE(expo_project_id, project_id) = $3
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
      AND COALESCE(expo_project_id, project_id) IS NOT NULL
      AND COALESCE(expo_project_id, project_id) != $2
      AND revoked_at IS NULL
      AND disabled_at IS NULL;
  `;
  await pool.query(sql, [userId, currentProjectId]);
}

async function listActiveTokens(limit = 10000) {
  const sql = `
    SELECT expo_push_token, expo_project_id, project_id, COALESCE(expo_project_id, project_id) as resolved_project_id
    FROM push_tokens
    WHERE revoked_at IS NULL
      AND disabled_at IS NULL
      AND expo_push_token IS NOT NULL
      AND app_scope = $2
      AND COALESCE(expo_project_id, project_id) IS NOT NULL
    ORDER BY last_seen DESC
    LIMIT $1;
  `;

  const { rows } = await pool.query(sql, [limit, pushConfig.APP_SCOPE]);
  return rows.map((r) => ({
    token: r.expo_push_token,
    projectId: r.resolved_project_id || r.expo_project_id || r.project_id || null
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

/**
 * Retorna contagem de tokens por scope e projeto para admin.
 */
async function getScopesDiagnostics() {
  const sql = `
    SELECT
      app_scope,
      expo_project_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE revoked_at IS NULL AND disabled_at IS NULL) as valid,
      COUNT(*) FILTER (WHERE disabled_reason = 'missing_project_id') as missing_project_id,
      MIN(last_seen) as oldest,
      MAX(last_seen) as newest
    FROM push_tokens
    GROUP BY app_scope, expo_project_id
    ORDER BY valid DESC, total DESC;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

/**
 * Desativa tokens de outros scopes para o mesmo usuário.
 */
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

/**
 * Resolve destinatários com base no targetType e targetValue
 */
async function resolvePushTargets(targetType, targetValue) {
  let sql = "";
  let params = [];
  const scope = pushConfig.APP_SCOPE;

  switch (targetType) {
    case 'ATIVOS':
      sql = `
        SELECT pt.expo_push_token, pt.expo_project_id, pt.project_id, COALESCE(pt.expo_project_id, pt.project_id) as resolved_project_id
        FROM push_tokens pt
        JOIN filiados f ON pt.user_id = f.id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND f.situacao = 'ATIVO'
          AND pt.app_scope = $1
      `;
      params = [scope];
      break;
    case 'VETERANOS':
      sql = `
        SELECT pt.expo_push_token, pt.expo_project_id, pt.project_id, COALESCE(pt.expo_project_id, pt.project_id) as resolved_project_id
        FROM push_tokens pt
        JOIN filiados f ON pt.user_id = f.id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND (f.situacao = 'VETERANO' OR f.situacao = 'PENSIONISTA')
          AND pt.app_scope = $1
      `;
      params = [scope];
      break;
    case 'LOTACAO':
      sql = `
        SELECT pt.expo_push_token, pt.expo_project_id, pt.project_id, COALESCE(pt.expo_project_id, pt.project_id) as resolved_project_id
        FROM push_tokens pt
        JOIN filiados f ON pt.user_id = f.id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND f.situacao = 'ATIVO' AND f.lotacao = $1
          AND pt.app_scope = $2
      `;
      params = [targetValue, scope];
      break;
    case 'JOGOS':
      // Exemplo: inscritos em qualquer modalidade dos jogos
      sql = `
        SELECT DISTINCT pt.expo_push_token, pt.expo_project_id, pt.project_id, COALESCE(pt.expo_project_id, pt.project_id) as resolved_project_id
        FROM push_tokens pt
        JOIN inscricoes_jogos ij ON pt.user_id = ij.filiado_id
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL
          AND pt.app_scope = $1
      `;
      params = [scope];
      break;
    case 'FILIADO': {
      const targetId = (typeof targetValue === 'object' && targetValue !== null) ? targetValue.id : targetValue;
      sql = `
        SELECT pt.expo_push_token, pt.expo_project_id, pt.project_id, COALESCE(pt.expo_project_id, pt.project_id) as resolved_project_id
        FROM push_tokens pt
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND pt.user_id = $1
          AND pt.app_scope = $2
      `;
      params = [targetId, scope];
      break;
    }
    case 'ALL':
    default:
      sql = `
        SELECT pt.expo_push_token, pt.expo_project_id, pt.project_id, COALESCE(pt.expo_project_id, pt.project_id) as resolved_project_id
        FROM push_tokens pt
        WHERE pt.revoked_at IS NULL AND pt.disabled_at IS NULL AND pt.expo_push_token IS NOT NULL
          AND pt.app_scope = $1
      `;
      params = [scope];
      break;
  }

  const { rows } = await pool.query(sql, params);

  if (rows.length === 0) {
    const diagnostics = await getResolveDiagnostics(targetType, targetValue);
    log.warn("PushService.ResolveTargetsEmpty", {
      targetType,
      targetValue,
      scope,
      diagnostics
    });
  }

  return rows.map(r => ({
    token: r.expo_push_token,
    projectId: r.resolved_project_id || r.expo_project_id || r.project_id || null
  })).filter(r => !!r.token);
}


async function getResolveDiagnostics(targetType, targetValue) {
  const scope = pushConfig.APP_SCOPE;
  const targetId = targetType === 'FILIADO' ? ((typeof targetValue === 'object' && targetValue !== null) ? targetValue.id : targetValue) : null;
  const diagSql = `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) as revoked,
      COUNT(*) FILTER (WHERE disabled_at IS NOT NULL) as disabled,
      COUNT(*) FILTER (WHERE disabled_reason = 'missing_project_id') as missing_project_id,
      COUNT(*) FILTER (WHERE disabled_reason = 'scope_mismatch') as scope_mismatch,
      COUNT(*) FILTER (WHERE disabled_reason = 'project_mismatch') as project_mismatch,
      COUNT(*) FILTER (WHERE (expo_project_id IS NULL OR expo_project_id = '') AND (project_id IS NULL OR project_id = '')) as without_project_id,
      COUNT(*) FILTER (WHERE app_scope != $1) as other_scope
    FROM push_tokens
    WHERE user_id = $2 OR $2 IS NULL
  `;

  const diag = await pool.query(diagSql, [scope, targetId]);
  return diag.rows[0] || null;
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
    LEFT JOIN push_tokens pt ON f.id = pt.user_id AND pt.revoked_at IS NULL AND pt.app_scope = $${params.length + 1}
    WHERE pt.id IS NULL OR pt.permission_status = 'denied'
  `;

  params.push(pushConfig.APP_SCOPE);

  const { rows } = await pool.query(sql, params);
  return parseInt(rows[0].count, 10) || 0;
}

async function revokeSpecificToken(expoPushToken) {
    const sql = `UPDATE push_tokens SET revoked_at = NOW() WHERE expo_push_token = $1`;
    await pool.query(sql, [expoPushToken]);
}

async function sendBroadcast({ title, body, data }) {
  const targets = await listActiveTokens();
  const validTargets = targets.filter(t => !!t.projectId);

  if (!validTargets.length) return { sent: 0, ignoredNoProjectId: targets.length };

  // Agrupar por project_id para evitar erro do Expo
  const groups = validTargets.reduce((acc, curr) => {
    const pid = curr.projectId;
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
      ...(projectId !== "unspecified" ? { projectId: projectId } : {})
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
  getDiagnostics,
  getScopesDiagnostics,
  deactivateMismatchedScopeTokens,
  getResolveDiagnostics
};
