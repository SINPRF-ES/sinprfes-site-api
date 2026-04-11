const pool = require('../config/db');
const log = require('../utils/log');
const { buildBirthdayCard } = require('../templates/aniversarios/cardTemplate');

function getReferenceDateISO(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function getReferenceDateTimestamp(referenceDateISO) {
  return `${referenceDateISO}T12:00:00.000Z`;
}

async function archiveCurrentBirthdayEntry(client, id) {
  if (!id) return 0;
  const { rowCount } = await client.query(
    `UPDATE aniversarios
     SET status_editorial = 'ARQUIVADA',
         is_editable = false,
         archived_at = NOW(),
         status = 'PUBLICADA',
         published_at = COALESCE(published_at, NOW()),
         sort_date = COALESCE(sort_date, published_at, created_at)
     WHERE id = $1`,
    [id]
  );
  return rowCount;
}

async function criarAniversarioAutomatico({ aniversariantes = [], referenceDateISO = getReferenceDateISO() }) {
  const client = await pool.connect();
  const birthdaysCount = Array.isArray(aniversariantes) ? aniversariantes.length : 0;
  const referenceDate = getReferenceDateTimestamp(referenceDateISO);

  try {
    await client.query('BEGIN');

    const { rows: currentRows } = await client.query(
      `SELECT id, data_informe
       FROM aniversarios
       WHERE status_editorial = 'ATUAL'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`
    );
    const currentEntry = currentRows[0] || null;
    const currentEntryDate = currentEntry?.data_informe
      ? new Date(currentEntry.data_informe).toISOString().slice(0, 10)
      : null;

    log.info('ANIVERSARIOS_AUTO_SYNC_START', {
      referenceDateISO,
      birthdaysCount,
      currentEntryId: currentEntry?.id || null,
      currentEntryDate,
    });

    if (birthdaysCount === 0) {
      if (currentEntry) {
        await archiveCurrentBirthdayEntry(client, currentEntry.id);
        log.info('ANIVERSARIOS_AUTO_SYNC_ARCHIVED_STALE_CURRENT', {
          referenceDateISO,
          archivedId: currentEntry.id,
          reason: 'no_birthdays_today',
        });
      } else {
        log.info('ANIVERSARIOS_AUTO_SYNC_NOOP_EMPTY_DAY', { referenceDateISO });
      }

      await client.query('COMMIT');
      return {
        created: false,
        updated: false,
        archivedPrevious: Boolean(currentEntry),
        reason: 'no_birthdays_today',
      };
    }

    const birthdayCard = buildBirthdayCard({
      aniversariantes,
      date: new Date(`${referenceDateISO}T12:00:00-03:00`),
    });

    if (currentEntry && currentEntryDate !== referenceDateISO) {
      await archiveCurrentBirthdayEntry(client, currentEntry.id);
      log.info('ANIVERSARIOS_AUTO_SYNC_ARCHIVED_PREVIOUS_CURRENT', {
        referenceDateISO,
        archivedId: currentEntry.id,
        archivedDate: currentEntryDate,
      });
    }

    const { rows: todayRows } = await client.query(
      `SELECT id
       FROM aniversarios
       WHERE status_editorial = 'ATUAL'
         AND data_informe::date = $1::date
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [referenceDateISO]
    );

    if (todayRows.length > 0) {
      const todayId = todayRows[0].id;
      await client.query(
        `UPDATE aniversarios
         SET titulo = $1,
             subtitulo = $2,
             conteudo = $3,
             destaque = true,
             status = 'PUBLICADA',
             published_at = COALESCE(published_at, NOW()),
             data_informe = $4,
             sort_date = $4,
             is_editable = true
         WHERE id = $5`,
        [birthdayCard.titulo, birthdayCard.subtitulo, birthdayCard.conteudo, referenceDate, todayId]
      );

      await client.query('COMMIT');
      log.info('ANIVERSARIOS_AUTO_SYNC_UPDATED_CURRENT', {
        referenceDateISO,
        id: todayId,
        birthdaysCount,
      });
      return { created: false, updated: true, id: todayId, birthdaysCount };
    }

    const { rows: createdRows } = await client.query(
      `INSERT INTO aniversarios (
         titulo, subtitulo, conteudo, status, autor_id, destaque, data_informe,
         status_editorial, is_editable, published_at, sort_date
       )
       VALUES ($1, $2, $3, 'PUBLICADA', NULL, true, $4, 'ATUAL', true, NOW(), $4)
       RETURNING id`,
      [birthdayCard.titulo, birthdayCard.subtitulo, birthdayCard.conteudo, referenceDate]
    );
    const createdId = createdRows[0].id;

    await client.query('COMMIT');
    log.info('ANIVERSARIOS_AUTO_SYNC_CREATED_CURRENT', {
      referenceDateISO,
      id: createdId,
      birthdaysCount,
    });
    return { created: true, updated: false, id: createdId, birthdaysCount };
  } catch (error) {
    await client.query('ROLLBACK');
    log.error('ANIVERSARIOS_AUTO_SYNC_FAILED', {
      referenceDateISO,
      birthdaysCount,
      errorMessage: error.message,
    });
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  criarAniversarioAutomatico,
  getReferenceDateISO,
};
