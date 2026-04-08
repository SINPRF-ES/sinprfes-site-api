const pool = require('../config/db');
const emailService = require('./email.service');

const SEND_TYPE_BIRTHDAY_GREETING = 'birthday_greeting';

function getReferenceDateISO(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function normalizeEmail(rawEmail) {
  if (!rawEmail) return '';
  return String(rawEmail).trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveRecipientEmail(person = {}) {
  return normalizeEmail(person.email || person.email1 || person.email2 || '');
}

function resolveRecipientName(person = {}) {
  return (person.nome && String(person.nome).trim()) || 'colega';
}

function resolveRecipientKey(person = {}) {
  const tipo = String(person.tipo || 'FILIADO').toUpperCase();
  const filiadoId = String(person.id || 'unknown');

  if (tipo === 'DEPENDENTE') {
    const depOrdem = Number(person.dependente_ordem);
    if (Number.isFinite(depOrdem) && depOrdem > 0) {
      return `DEPENDENTE:${filiadoId}:${depOrdem}`;
    }
    return `DEPENDENTE:${filiadoId}:${resolveRecipientName(person)}`;
  }

  return `FILIADO:${filiadoId}`;
}

function hasCommunicationBlock(person = {}) {
  if (!Object.prototype.hasOwnProperty.call(person, 'permite_comunicacao')) {
    return false;
  }
  return person.permite_comunicacao === false;
}

async function upsertBirthdayGreetingLog({
  recipientKey,
  filiadoId,
  recipientName,
  targetEmail,
  referenceDate,
  status,
  providerMessageId = null,
  errorMessage = null,
}) {
  await pool.query(
    `
      INSERT INTO birthday_email_dispatch_log (
        send_type,
        reference_date,
        recipient_key,
        filiado_id,
        recipient_name,
        target_email,
        status,
        provider_message_id,
        error_message,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (send_type, reference_date, recipient_key)
      DO UPDATE SET
        target_email = EXCLUDED.target_email,
        recipient_name = EXCLUDED.recipient_name,
        status = EXCLUDED.status,
        provider_message_id = EXCLUDED.provider_message_id,
        error_message = EXCLUDED.error_message,
        updated_at = NOW()
    `,
    [
      SEND_TYPE_BIRTHDAY_GREETING,
      referenceDate,
      recipientKey,
      filiadoId || null,
      recipientName,
      targetEmail || null,
      status,
      providerMessageId,
      errorMessage,
    ]
  );
}

async function reserveBirthdayGreetingSend({ recipientKey, filiadoId, recipientName, targetEmail, referenceDate }) {
  const { rows } = await pool.query(
    `
      INSERT INTO birthday_email_dispatch_log (
        send_type,
        reference_date,
        recipient_key,
        filiado_id,
        recipient_name,
        target_email,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW())
      ON CONFLICT (send_type, reference_date, recipient_key) DO NOTHING
      RETURNING id
    `,
    [
      SEND_TYPE_BIRTHDAY_GREETING,
      referenceDate,
      recipientKey,
      filiadoId || null,
      recipientName,
      targetEmail || null,
    ]
  );

  return rows.length > 0;
}

async function sendBirthdayGreetingsBatch({ aniversariantes = [], referenceDate = getReferenceDateISO() }) {
  const stats = {
    totalBirthdaysFound: Array.isArray(aniversariantes) ? aniversariantes.length : 0,
    eligibleForIndividualSend: 0,
    sentSuccessfully: 0,
    failed: 0,
    skipped: 0,
  };

  for (const person of aniversariantes || []) {
    const recipientName = resolveRecipientName(person);
    const targetEmail = resolveRecipientEmail(person);
    const recipientKey = resolveRecipientKey(person);
    const filiadoId = person?.id || null;

    if (!targetEmail || !isValidEmail(targetEmail)) {
      stats.skipped += 1;
      await upsertBirthdayGreetingLog({
        recipientKey,
        filiadoId,
        recipientName,
        targetEmail,
        referenceDate,
        status: 'skipped',
        errorMessage: !targetEmail ? 'missing_email' : 'invalid_email',
      });
      continue;
    }

    if (hasCommunicationBlock(person)) {
      stats.skipped += 1;
      await upsertBirthdayGreetingLog({
        recipientKey,
        filiadoId,
        recipientName,
        targetEmail,
        referenceDate,
        status: 'skipped',
        errorMessage: 'communication_not_allowed',
      });
      continue;
    }

    const reserved = await reserveBirthdayGreetingSend({
      recipientKey,
      filiadoId,
      recipientName,
      targetEmail,
      referenceDate,
    });

    if (!reserved) {
      stats.skipped += 1;
      continue;
    }

    stats.eligibleForIndividualSend += 1;

    try {
      const result = await emailService.enviarEmailAniversarioPersonalizado({
        to: targetEmail,
        nome: recipientName,
      });

      await upsertBirthdayGreetingLog({
        recipientKey,
        filiadoId,
        recipientName,
        targetEmail,
        referenceDate,
        status: 'sent',
        providerMessageId: result?.id || null,
      });

      stats.sentSuccessfully += 1;
    } catch (error) {
      await upsertBirthdayGreetingLog({
        recipientKey,
        filiadoId,
        recipientName,
        targetEmail,
        referenceDate,
        status: 'failed',
        errorMessage: String(error?.message || 'unknown_error').slice(0, 1000),
      });
      stats.failed += 1;
    }
  }

  return stats;
}

module.exports = {
  SEND_TYPE_BIRTHDAY_GREETING,
  getReferenceDateISO,
  isValidEmail,
  resolveRecipientKey,
  sendBirthdayGreetingsBatch,
};
