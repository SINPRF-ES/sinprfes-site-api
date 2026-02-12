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

  // 1. Buscar tokens e Normalizar TargetValue
  let tokens;
  let noTokenOrDenied = 0;
  let normalizedTargetValue = targetValue;

  try {
    // Se for USER, vamos tentar normalizar para array se vier como objeto com chaves numéricas
    if (targetType === 'USER' && targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        if (targetValue.id) {
            normalizedTargetValue = [targetValue];
        } else {
            normalizedTargetValue = Object.values(targetValue);
        }
        log.info('PushCampaign.NormalizedTargetValue', { requestId, before: typeof targetValue, after: Array.isArray(normalizedTargetValue) });
    }

    tokens = await pushService.resolvePushTargets(targetType, normalizedTargetValue);
    noTokenOrDenied = await pushService.countNoTokenTargets(targetType, normalizedTargetValue);
    log.info('PUSH_CAMPAIGN_TOKENS_RESOLVED', { requestId, count: tokens.length, noTokenOrDenied });
  } catch (e) {
    log.error("PushCampaign.ErroObterTokens", { requestId, error: e.message, stack: e.stack });
    throw e;
  }

  if (!tokens.length) {
    log.warn("PushCampaign.SemTokens", { requestId, targetType, targetValue });
    const campaignId = await saveCampaignRecord({
      title, body, targetType, targetValue, data, createdBy,
      status: 'SENT',
      sentAt: new Date(),
      result: { sent: 0, failed: 0, noTokenOrDenied, details: "Nenhum token encontrado." }
    });
    return { success: true, sent: 0, failed: 0, noTokenOrDenied, campaignId };
  }

  // 2. Preparar mensagens
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title: title || "FENAPRF",
    body: body,
    data: data || {},
    priority: "high",
  }));

  // 3. Chunks e Envio
  const chunks = expo.chunkPushNotifications(messages);
  log.info("PushCampaign.ChunksCriados", { requestId, chunksCount: chunks.length, messagesCount: messages.length });

  const tickets = [];
  let sentCount = 0;
  let errorCount = 0;
  let hasCredentialError = false;
  const errors = [];

  let chunkIdx = 0;
  for (const chunk of chunks) {
    chunkIdx++;
    try {
      log.info("PushCampaign.EnviandoChunk", {
        requestId,
        chunkIdx,
        chunkSize: chunk.length,
        totalChunks: chunks.length
      });
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...chunkTickets);

      // Log detalhado dos tickets deste chunk
      for (let i = 0; i < chunkTickets.length; i++) {
        const ticket = chunkTickets[i];
        if (ticket.status === 'error') {
          errorCount++;
          const errorCode = ticket.details?.error;
          const errorMessage = ticket.message;

          if (errorCode === 'InvalidCredentials') {
            hasCredentialError = true;
          }

          // Auto-revogação se o dispositivo não estiver mais registrado
          if (errorCode === 'DeviceNotRegistered') {
            log.info("PushCampaign.RevogandoTokenInvalido", { token: chunk[i].to.substring(0, 15) + "..." });
            await pushService.revokeSpecificToken(chunk[i].to);
          }

          log.error("PushCampaign.TicketErro", {
            requestId,
            chunkIdx,
            token: chunk[i].to.substring(0, 15) + "...",
            errorCode,
            errorMessage
          });
          errors.push(`Token[${i}]: ${errorCode || errorMessage}`);
        } else {
          sentCount++;
        }
      }

    } catch (error) {
      log.error("PushCampaign.ChunkErro", { requestId, chunkIdx, error: error.message });
      errorCount += chunk.length;
      errors.push(`Chunk ${chunkIdx} (Transport Error): ${error.message}`);
    }
  }

  // 4. Salvar Registro de Campanha e Tickets (Task B)
  const authorId = (createdBy && typeof createdBy === 'string') ? createdBy : null;
  const { generateUuid } = require("../utils/format");
  const campaignId = generateUuid();

  const resultData = {
    sent: sentCount,
    failed: errorCount,
    noTokenOrDenied,
    hasCredentialError,
    errors: errors.length > 0 ? errors : undefined,
    durationMs: new Date() - startTime
  };

  try {
    await saveCampaignWithTickets({
      id: campaignId,
      title, body, targetType, targetValue: normalizedTargetValue, data, createdBy: authorId,
      status: (errorCount === messages.length && messages.length > 0) ? 'FAILED' : 'SENT',
      sentAt: new Date(),
      result: resultData,
      tickets: tickets.map((t, idx) => ({
        ticket_id: t.id,
        expo_push_token: tokens[idx],
        status: t.status,
        error_message: t.message,
        error_code: t.details?.error
      })).filter(t => !!t.ticket_id)
    });
    log.info("PushCampaign.RegistroSalvo", { requestId, campaignId });
  } catch (e) {
    log.error("PushCampaign.ErroSalvarRegistro", { requestId, error: e.message });
    throw e;
  }

  // 5. Agendar Processamento de Receipts (Async)
  setTimeout(() => {
    processPendingReceipts().catch(err => log.error("PushCampaign.ReceiptProcessingError", { error: err.message }));
  }, 120000); // 2 minutos

  log.info("PushCampaign.Finalizado", { requestId, userId: createdBy, campaignId, ...resultData });

  return { success: true, campaignId, ...resultData };
}

async function saveCampaignWithTickets({ id, title, body, targetType, targetValue, data, createdBy, status, sentAt, result, tickets }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sqlCampaign = `
      INSERT INTO push_campaigns (id, title, body, target_type, target_value, data, created_by, status, sent_at, result)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    await client.query(sqlCampaign, [
      id, title || null, body, targetType || 'ALL',
      targetValue ? JSON.stringify(targetValue) : null,
      data ? JSON.stringify(data) : null,
      createdBy, status, sentAt, result ? JSON.stringify(result) : null
    ]);

    if (tickets && tickets.length > 0) {
      for (const t of tickets) {
        const sqlTicket = `
          INSERT INTO push_tickets (campaign_id, ticket_id, expo_push_token, status, error_message, error_code)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (ticket_id) DO NOTHING
        `;
        await client.query(sqlTicket, [id, t.ticket_id, t.expo_push_token, t.status, t.error_message, t.error_code]);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Processa tickets pendentes para verificar receipts do Expo.
 */
async function processPendingReceipts() {
  const { rows: pendingTickets } = await pool.query(
    "SELECT id, ticket_id, expo_push_token FROM push_tickets WHERE processed = FALSE AND status = 'ok' LIMIT 1000"
  );

  if (pendingTickets.length === 0) return;

  const ticketIds = pendingTickets.map(t => t.ticket_id);
  const ticketMap = new Map(pendingTickets.map(t => [t.ticket_id, t]));

  const chunks = expo.chunkPushNotificationReceiptIds(ticketIds);

  for (const chunk of chunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (let receiptId in receipts) {
        const receipt = receipts[receiptId];
        const localTicket = ticketMap.get(receiptId);

        if (receipt.status === 'error') {
          log.error(`PushCampaign.ReceiptError`, { receiptId, message: receipt.message, details: receipt.details });

          if (receipt.details?.error === 'DeviceNotRegistered' && localTicket) {
             log.info("PushCampaign.RevogandoTokenInvalidoViaReceipt", { token: localTicket.expo_push_token.substring(0, 15) + "..." });
             await pushService.revokeSpecificToken(localTicket.expo_push_token);
          }

          await pool.query(
            "UPDATE push_tickets SET processed = TRUE, status = 'error', error_message = $1, error_code = $2 WHERE ticket_id = $3",
            [receipt.message, receipt.details?.error, receiptId]
          );
        } else {
          await pool.query("UPDATE push_tickets SET processed = TRUE WHERE ticket_id = $1", [receiptId]);
        }
      }
    } catch (e) {
      log.error("PushCampaign.ChunkReceiptError", { error: e.message });
    }
  }
}

async function listCampaigns(limit = 20, offset = 0) {
  const sql = `
    SELECT c.*, f.name as autor_nome
    FROM push_campaigns c
    LEFT JOIN users f ON c.created_by = f.id
    ORDER BY c.created_at DESC
    LIMIT $1 OFFSET $2;
  `;
  const { rows } = await pool.query(sql, [limit, offset]);

  // Enriquecimento do target_label para exibição no Histórico
  // Regras: ALL -> Todos, UF -> UF: XX, USER(1) -> Nome, USER(N) -> N membros
  const singleUserIds = new Set();
  const campaignData = rows.map(row => {
    let targetValue = row.target_value;
    if (typeof targetValue === 'string') {
        try { targetValue = JSON.parse(targetValue); } catch(e) {}
    }

    let isSingleUser = false;
    let singleUserId = null;

    if (row.target_type === 'USER') {
      if (Array.isArray(targetValue)) {
        if (targetValue.length === 1) {
          isSingleUser = true;
          const first = targetValue[0];
          singleUserId = (typeof first === 'object' && first !== null) ? (first.id || first.user_id) : first;
        }
      } else if (targetValue && typeof targetValue === 'object' && targetValue.id) {
          isSingleUser = true;
          singleUserId = targetValue.id;
      } else if (targetValue && typeof targetValue === 'string' && targetValue.length > 10) {
          isSingleUser = true;
          singleUserId = targetValue;
      }
    }

    if (isSingleUser && singleUserId) {
        singleUserIds.add(String(singleUserId));
    }

    return { ...row, _parsedValue: targetValue, _isSingle: isSingleUser, _singleId: singleUserId };
  });

  const nameMap = new Map();
  if (singleUserIds.size > 0) {
    try {
        const { rows: userRows } = await pool.query(
            "SELECT id, name FROM users WHERE id = ANY($1)",
            [Array.from(singleUserIds)]
        );
        userRows.forEach(u => nameMap.set(String(u.id), u.name));
    } catch (e) {
        log.error("PushCampaign.listCampaigns.ErrorFetchingNames", e);
    }
  }

  return campaignData.map(c => {
    let label = "Destino não identificado";
    const type = c.target_type;
    const value = c._parsedValue;

    if (type === 'ALL') {
      label = "Todos";
    } else if (type === 'UF') {
      label = `UF: ${value}`;
    } else if (type === 'USER') {
      if (c._isSingle && c._singleId) {
          label = nameMap.get(String(c._singleId)) || "Membro selecionado";
      } else if (Array.isArray(value) && value.length > 1) {
          label = `${value.length} membros selecionados`;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          label = value.name || "Membro selecionado";
      }
    } else {
        const labels = {
            'DIRETORIA': 'Apenas Diretoria',
            'PRESIDENTES': 'Apenas Presidentes',
            'VICES': 'Apenas Vices',
            'DR': 'Delegados Representantes (DR)',
            'DS': 'Delegados Substitutos (DS)',
            'ADMIN_COLAB': 'Admin e Colaboradores',
            'PADRAO': 'Diretoria e Conselheiros'
        };
        label = labels[type] || type || label;
    }

    const { _parsedValue, _isSingle, _singleId, ...rest } = c;
    return { ...rest, target_label: label };
  });
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
