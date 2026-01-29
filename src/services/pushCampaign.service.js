// src/services/pushCampaign.service.js
const { Expo } = require("expo-server-sdk");
const pool = require("../config/db");
const pushService = require("./push.service");
const log = require("../utils/log");

const expo = new Expo();

/**
 * Envia uma campanha de push para todos os tokens ativos.
 * @param {Object} params - { title, body, targetType, targetValue, data, createdBy }
 */
async function sendCampaign({ title, body, targetType, targetValue, data, createdBy }) {
  const startTime = new Date();
  log.info("PushCampaign.Iniciado", { title, body, targetType, createdBy });

  // 1. Buscar tokens (por enquanto apenas targetType='ALL' é suportado conforme v1)
  const tokens = await pushService.listActiveTokens();
  if (!tokens.length) {
    log.warn("PushCampaign.SemTokens", { targetType });
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
  const tickets = [];
  let sentCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const chunk of chunks) {
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...chunkTickets);
      sentCount += chunkTickets.length;
    } catch (error) {
      log.error("PushCampaign.ChunkErro", error);
      errorCount += chunk.length;
      errors.push(error.message);
    }
  }

  // 4. Analisar tickets (opcional para v1, mas bom para histórico)
  // Por simplicidade na v1, vamos considerar enviados se o ticket foi gerado.
  // Erros de tokens inválidos aparecem no recibo posterior, que não trataremos agora.

  const resultData = {
    sent: sentCount,
    failed: errorCount,
    errors: errors.length > 0 ? errors : undefined,
    durationMs: new Date() - startTime
  };

  // 5. Salvar registro
  const campaignId = await saveCampaignRecord({
    title, body, targetType, targetValue, data, createdBy,
    status: errorCount === messages.length ? 'FAILED' : 'SENT',
    sentAt: new Date(),
    result: resultData
  });

  log.info("PushCampaign.Finalizado", { campaignId, ...resultData });

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
