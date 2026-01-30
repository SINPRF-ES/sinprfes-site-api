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
  log.info("PushCampaign.Iniciado", { requestId, userId: createdBy, perfil, title, body, targetType });

  // 1. Buscar tokens (por enquanto apenas targetType='ALL' é suportado conforme v1)
  let tokens;
  try {
    tokens = await pushService.listActiveTokens();
    log.info("PushCampaign.TokensObtidos", { requestId, count: tokens.length });
  } catch (e) {
    log.error("PushCampaign.ErroObterTokens", { requestId, error: e.message });
    throw e;
  }

  if (!tokens.length) {
    log.warn("PushCampaign.SemTokens", { requestId, targetType });
    const campaignId = await saveCampaignRecord({
      title, body, targetType, targetValue, data, createdBy,
      status: 'SENT',
      sentAt: new Date(),
      result: { sent: 0, failed: 0, details: "Nenhum token encontrado." }
    });
    return { success: true, sent: 0, campaignId };
  }

  // 2. Preparar mensagens
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title: title || "SINPRF-ES",
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
      chunkTickets.forEach((ticket, idx) => {
        if (ticket.status === 'error') {
          errorCount++;
          const errorCode = ticket.details?.error;
          const errorMessage = ticket.message;
          log.error("PushCampaign.TicketErro", {
            requestId,
            chunkIdx,
            token: chunk[idx].to.substring(0, 15) + "...",
            errorCode,
            errorMessage
          });
          errors.push(`Token[${idx}]: ${errorCode || errorMessage}`);
        } else {
          sentCount++;
        }
      });

    } catch (error) {
      log.error("PushCampaign.ChunkErro", { requestId, chunkIdx, error: error.message });
      errorCount += chunk.length;
      errors.push(`Chunk ${chunkIdx} (Transport Error): ${error.message}`);
    }
  }

  // 4. Analisar tickets (v1 simplificada: logs já feitos acima)

  const resultData = {
    sent: sentCount,
    failed: errorCount,
    errors: errors.length > 0 ? errors : undefined,
    durationMs: new Date() - startTime
  };

  // 5. Salvar registro
  let campaignId;
  try {
    campaignId = await saveCampaignRecord({
        title, body, targetType, targetValue, data, createdBy,
        status: (errorCount === messages.length && messages.length > 0) ? 'FAILED' : 'SENT',
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

async function listCampaigns(limit = 20) {
  const sql = `
    SELECT c.*, f.nome as autor_nome
    FROM push_campaigns c
    LEFT JOIN filiados f ON c.created_by = f.id
    ORDER BY c.created_at DESC
    LIMIT $1;
  `;
  const { rows } = await pool.query(sql, [limit]);
  return rows;
}

module.exports = {
  sendCampaign,
  listCampaigns
};
