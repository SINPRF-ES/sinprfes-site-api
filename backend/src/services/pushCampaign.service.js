// src/services/pushCampaign.service.js
const { Expo } = require("expo-server-sdk");
const pool = require("../config/db");
const pushService = require("./push.service");
const pushConfig = require("../config/push.config");
const log = require("../utils/log");

const expo = new Expo();

async function sendCampaign({ title, body, targetType, targetValue, data, createdBy, requestId, perfil }) {
  const startTime = new Date();
  const safeBody = typeof body === "string" && body.trim() ? body.trim() : "Notificação SINPRF-ES";
  log.info("PushCampaign.Iniciado", { requestId, userId: createdBy, perfil, title, body: safeBody, targetType, targetValue });

  let tokens;
  let noTokenOrDenied = 0;
  let diagnostics = null;
  try {
    [tokens, noTokenOrDenied, diagnostics] = await Promise.all([
      pushService.resolvePushTargets(targetType, targetValue),
      pushService.countNoTokenTargets(targetType, targetValue),
      pushService.getResolveDiagnostics(targetType, targetValue)
    ]);
  } catch (e) {
    log.error("PushCampaign.ErroObterTokens", { requestId, error: e.message });
    throw e;
  }

  const expectedProjectId = String(pushConfig.EXPO_PROJECT_ID || "").trim() || null;
  const totalOriginal = tokens.length;
  const tokensSemProjeto = tokens.filter((t) => !t.expoProjectId);
  const tokensProjetoInvalido = tokens.filter((t) => t.expoProjectId && expectedProjectId && t.expoProjectId !== expectedProjectId);
  const tokensValidos = tokens.filter((t) => t.expoProjectId && (!expectedProjectId || t.expoProjectId === expectedProjectId));

  const projectGroups = tokens.reduce((acc, curr) => {
    const pid = curr.expoProjectId || "missing";
    acc[pid] = acc[pid] || [];
    acc[pid].push(curr);
    return acc;
  }, {});

  const byProjectCount = Object.entries(projectGroups).map(([projectId, list]) => ({ projectId, count: list.length }));
  const projectConflictDetected = Object.keys(projectGroups).filter((projectId) => projectId !== "missing").length > 1;

  log.info("PushCampaign.TokenResumo", {
    requestId,
    targetType,
    targetValue,
    expectedProjectId,
    totalOriginal,
    totalValid: tokensValidos.length,
    invalid_missing_expo_project_id: tokensSemProjeto.length,
    invalid_project_mismatch: tokensProjetoInvalido.length,
    revoked: Number(diagnostics?.revoked || 0),
    disabled: Number(diagnostics?.disabled || 0),
    byProject: byProjectCount,
    projectConflictDetected
  });

  if (!tokensValidos.length) {
    log.warn("PushCampaign.SemTokensValidos", { requestId, targetType, targetValue, totalOriginal });
    const campaignId = await saveCampaignRecord({
      title,
      body: safeBody,
      targetType,
      targetValue,
      data,
      createdBy,
      status: "FAILED",
      sentAt: new Date(),
      result: {
        sent: 0,
        failed: tokensSemProjeto.length + tokensProjetoInvalido.length,
        noTokenOrDenied,
        failuresTop: [{ reason: "Sem tokens válidos", count: totalOriginal || 1 }],
        missingProjectId: tokensSemProjeto.length,
        projectMismatchFiltered: tokensProjetoInvalido.length,
        byProject: byProjectCount,
        projectConflictDetected,
        diagnostics,
        requestId
      }
    });
    return {
      success: true,
      sent: 0,
      failed: tokensSemProjeto.length + tokensProjetoInvalido.length,
      noTokenOrDenied,
      campaignId,
      failuresTop: [{ reason: "Sem tokens válidos", count: totalOriginal || 1 }],
      byProject: byProjectCount,
      projectConflictDetected,
      diagnostics,
      requestId
    };
  }

  const groups = tokensValidos.reduce((acc, curr) => {
    const pid = curr.expoProjectId;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(curr.token);
    return acc;
  }, {});

  let sentCount = 0;
  let errorCount = 0;
  let hasCredentialError = false;
  const failureReasons = {};
  const byProject = [];

  for (const [projectId, groupTokens] of Object.entries(groups)) {
    const messages = groupTokens.map((token) => ({
      to: token,
      sound: "default",
      title: title || "SINPRF-ES",
      body: safeBody,
      data: data || {},
      priority: "high",
      projectId
    }));

    const chunks = expo.chunkPushNotifications(messages);
    let pSent = 0;
    let pFailed = 0;
    let chunkIdx = 0;

    for (const chunk of chunks) {
      chunkIdx += 1;
      const chunkProjectIds = [...new Set(chunk.map((msg) => msg.projectId))];
      if (chunkProjectIds.length > 1) {
        log.error("PushCampaign.ChunkProjetoMisturado", { requestId, projectId, chunkIdx, chunkProjectIds });
        pFailed += chunk.length;
        failureReasons.project_mismatch_filtered = (failureReasons.project_mismatch_filtered || 0) + chunk.length;
        continue;
      }

      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i += 1) {
          const ticket = tickets[i];
          if (ticket.status === "error") {
            pFailed += 1;
            const errorCode = ticket.details?.error || "UnknownError";
            failureReasons[errorCode] = (failureReasons[errorCode] || 0) + 1;

            if (errorCode === "InvalidCredentials") hasCredentialError = true;
            if (errorCode === "DeviceNotRegistered") {
              await pushService.revokeSpecificToken(chunk[i].to);
            }
          } else {
            pSent += 1;
          }
        }
      } catch (e) {
        log.error("PushCampaign.ChunkErro", { requestId, projectId, chunkIdx, error: e.message });
        pFailed += chunk.length;
        failureReasons.TransportError = (failureReasons.TransportError || 0) + chunk.length;
      }
    }

    byProject.push({ projectId, sent: pSent, failed: pFailed });
    sentCount += pSent;
    errorCount += pFailed;
  }

  if (tokensProjetoInvalido.length > 0) {
    errorCount += tokensProjetoInvalido.length;
    failureReasons.project_mismatch_filtered = (failureReasons.project_mismatch_filtered || 0) + tokensProjetoInvalido.length;
  }
  if (tokensSemProjeto.length > 0) {
    errorCount += tokensSemProjeto.length;
    failureReasons.missing_expo_project_id = (failureReasons.missing_expo_project_id || 0) + tokensSemProjeto.length;
  }

  const failuresTop = Object.entries(failureReasons)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const resultData = {
    sent: sentCount,
    failed: errorCount,
    noTokenOrDenied,
    missingProjectId: tokensSemProjeto.length,
    projectMismatchFiltered: tokensProjetoInvalido.length,
    hasCredentialError,
    failuresTop,
    byProject,
    projectConflictDetected,
    durationMs: new Date() - startTime,
    diagnostics,
    requestId
  };

  const allCandidates = totalOriginal || tokensSemProjeto.length + tokensProjetoInvalido.length;
  const campaignId = await saveCampaignRecord({
    title,
    body: safeBody,
    targetType,
    targetValue,
    data,
    createdBy,
    status: sentCount === 0 && allCandidates > 0 ? "FAILED" : "SENT",
    sentAt: new Date(),
    result: resultData
  });

  log.info("PushCampaign.Finalizado", { requestId, userId: createdBy, campaignId, ...resultData });
  return { success: true, campaignId, ...resultData };
}

async function saveCampaignRecord({ title, body, targetType, targetValue, data, createdBy, status, sentAt, result }) {
  const sql = `
    INSERT INTO push_campaigns (title, body, target_type, target_value, data, created_by, status, sent_at, result)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id;
  `;
  const r = await pool.query(sql, [
    title || null,
    body,
    targetType || "ALL",
    targetValue ? JSON.stringify(targetValue) : null,
    data ? JSON.stringify(data) : null,
    createdBy,
    status,
    sentAt,
    result ? JSON.stringify(result) : null
  ]);
  return r.rows[0]?.id;
}

async function listCampaigns(limit = 20, offset = 0) {
  const sql = `
    SELECT c.*, f.nome as autor_nome
    FROM push_campaigns c
    LEFT JOIN filiados f ON c.created_by = f.id
    ORDER BY c.created_at DESC
    LIMIT $1 OFFSET $2;
  `;
  const { rows } = await pool.query(sql, [limit, offset]);
  return rows;
}

async function listMyNotifications({ userId, perfil, lotacao, situacao }) {
  const sql = `
    SELECT c.id, c.title, c.body, c.created_at, c.target_type, c.target_value
    FROM push_campaigns c
    WHERE
        c.status = 'SENT'
        AND (
            c.target_type = 'ALL'
            OR (c.target_type = 'ATIVOS' AND $1 = 'ATIVO')
            OR (c.target_type = 'VETERANOS' AND $1 IN ('VETERANO', 'PENSIONISTA'))
            OR (c.target_type = 'LOTACAO' AND c.target_value::text = '"' || $2 || '"')
            OR (c.target_type = 'FILIADO' AND (c.target_value->>'id')::int = $3)
            OR (c.target_type = 'JOGOS' AND EXISTS (SELECT 1 FROM pre_inscricoes_jogos pi WHERE pi.filiado_id = $3))
        )
    ORDER BY c.created_at DESC
    LIMIT 50;
  `;

  const { rows } = await pool.query(sql, [situacao, lotacao, userId]);
  return rows;
}

async function cleanupOldCampaigns() {
  const sql = `DELETE FROM push_campaigns WHERE created_at < NOW() - INTERVAL '60 days'`;
  const r = await pool.query(sql);
  return r.rowCount;
}

module.exports = {
  sendCampaign,
  listCampaigns,
  cleanupOldCampaigns
};
