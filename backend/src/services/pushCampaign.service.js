// src/services/pushCampaign.service.js
const { Expo } = require("expo-server-sdk");
const pool = require("../config/db");
const pushService = require("./push.service");
const log = require("../utils/log");

const expo = new Expo();

/**
 * Envia uma campanha de push para todos os tokens ativos.
 * @param {Object} params - { title, body, targetType, targetValue, data, createdBy, requestId, perfil }
 */
async function sendCampaign({ title, body, targetType, targetValue, data, createdBy, requestId, perfil }) {
  const startTime = new Date();
  log.info("PushCampaign.Iniciado", { requestId, userId: createdBy, perfil, title, body, targetType, targetValue });

  // 1. Buscar tokens
  let tokens;
  let noTokenOrDenied = 0;
  try {
    tokens = await pushService.resolvePushTargets(targetType, targetValue);
    noTokenOrDenied = await pushService.countNoTokenTargets(targetType, targetValue);
    log.info('PUSH_CAMPAIGN_TOKENS_RESOLVED', { count: tokens.length, noTokenOrDenied });
  } catch (e) {
    log.error("PushCampaign.ErroObterTokens", { requestId, error: e.message });
    throw e;
  }

  // 1.1 Filtrar tokens sem Project ID (Quarentena)
  const tokensValidos = tokens.filter(t => !!t.projectId);
  const tokensSemProjeto = tokens.filter(t => !t.projectId);

  if (tokensSemProjeto.length > 0) {
    log.warn("PushCampaign.TokensSemProjeto", {
      requestId,
      count: tokensSemProjeto.length,
      tokensMasked: tokensSemProjeto.slice(0, 5).map(t => (t.token || '').substring(0, 15) + '...')
    });
  }

  if (!tokensValidos.length) {
    log.warn("PushCampaign.SemTokensValidos", { requestId, targetType, targetValue, totalOriginal: tokens.length });
    const campaignId = await saveCampaignRecord({
      title, body, targetType, targetValue, data, createdBy,
      status: 'SENT',
      sentAt: new Date(),
      result: {
        sent: 0,
        failed: tokensSemProjeto.length,
        noTokenOrDenied,
        details: "Nenhum token com Project ID encontrado.",
        missingProjectId: tokensSemProjeto.length
      }
    });
    return { success: true, sent: 0, failed: tokensSemProjeto.length, noTokenOrDenied, campaignId };
  }

  // 2. Agrupar tokens por project_id para evitar conflitos no mesmo request
  const groups = tokensValidos.reduce((acc, curr) => {
    const pid = curr.projectId; // Já garantido que existe pelo filter acima
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(curr.token);
    return acc;
  }, {});

  const projectIds = Object.keys(groups);
  const projectStats = {};
  projectIds.forEach(pid => { projectStats[pid] = groups[pid].length; });

  log.info("PushCampaign.Agrupamento", {
    requestId,
    projectsCount: projectIds.length,
    projects: projectIds,
    projectDetails: projectStats
  });

  let sentCount = 0;
  let errorCount = 0;
  let hasCredentialError = false;
  const failureReasons = {}; // reason -> count
  const byProject = []; // { projectId, sent, failed }
  let projectConflictDetected = projectIds.length > 1;

  // 3. Enviar por grupo
  for (const projectId of projectIds) {
    const groupTokens = groups[projectId];
    log.info("PushCampaign.EnviandoGrupo", { requestId, projectId, count: groupTokens.length });

    const messages = groupTokens.map((token) => ({
      to: token,
      sound: "default",
      title: title || "SINPRF-ES",
      body: body,
      data: data || {},
      priority: "high",
      ...(projectId !== "unspecified" ? { projectId: projectId } : {})
    }));

    const chunks = expo.chunkPushNotifications(messages);
    let pSent = 0;
    let pFailed = 0;

    let chunkIdx = 0;
    for (const chunk of chunks) {
      chunkIdx++;
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === 'error') {
            pFailed++;
            const errorCode = ticket.details?.error || "UnknownError";
            failureReasons[errorCode] = (failureReasons[errorCode] || 0) + 1;

            if (errorCode === 'InvalidCredentials') hasCredentialError = true;
            if (errorCode === 'DeviceNotRegistered') {
              await pushService.revokeSpecificToken(chunk[i].to);
            }
          } else {
            pSent++;
          }
        }
      } catch (e) {
        log.error("PushCampaign.ChunkErro", { requestId, projectId, chunkIdx, error: e.message });
        pFailed += chunk.length;
        failureReasons["TransportError"] = (failureReasons["TransportError"] || 0) + chunk.length;
      }
    }

    byProject.push({ projectId, sent: pSent, failed: pFailed });
    sentCount += pSent;
    errorCount += pFailed;
  }

  // Top 5 razões de falha
  const failuresTop = Object.entries(failureReasons)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const resultData = {
    sent: sentCount,
    failed: errorCount + tokensSemProjeto.length,
    noTokenOrDenied,
    missingProjectId: tokensSemProjeto.length,
    hasCredentialError,
    failuresTop,
    byProject,
    projectConflictDetected,
    durationMs: new Date() - startTime
  };

  // 5. Salvar registro
  let campaignId;
  try {
    campaignId = await saveCampaignRecord({
        title, body, targetType, targetValue, data, createdBy,
        status: (errorCount === tokens.length && tokens.length > 0) ? 'FAILED' : 'SENT',
        sentAt: new Date(),
        result: resultData
    });
    log.info("PushCampaign.RegistroSalvo", { requestId, campaignId });
  } catch (e) {
    log.error("PushCampaign.ErroSalvarRegistro", { requestId, error: e.message });
    // Não vamos falhar o retorno se apenas o log no banco falhou,
    // mas na v1 o registro é importante. Vamos deixar propagar para diagnosticar.
    throw e;
  }

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
    targetType || 'ALL',
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

/**
 * Retorna as notificações que o usuário logado deve visualizar.
 * Cruza os critérios de alvo da campanha com os dados do usuário.
 */
async function listMyNotifications({ userId, perfil, lotacao, situacao }) {
  // Nota: target_type pode ser 'ALL', 'ATIVOS', 'VETERANOS', 'LOTACAO', 'JOGOS', 'FILIADO'
  // target_value pode ser uma string (lotacao) ou um JSON (filiado object)

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

/**
 * Remove campanhas com mais de 60 dias
 */
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
