const pool = require("../config/db");

async function closeExpiredPolls(client = pool) {
  await client.query(
    `UPDATE polls
       SET status = 'CLOSED', updated_at = NOW()
     WHERE status = 'ACTIVE'
       AND (NOW() AT TIME ZONE 'America/Sao_Paulo')::date > (deadline_at AT TIME ZONE 'America/Sao_Paulo')::date`
  );
}

async function createPoll({ title, type, allowMultipleAnswers, allowOtherOption, deadlineAt, createdBy, options }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pollRes = await client.query(
      `INSERT INTO polls (title, type, allow_multiple_answers, allow_other_option, deadline_at, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6)
       RETURNING *`,
      [title, type, allowMultipleAnswers, allowOtherOption, deadlineAt, createdBy]
    );

    const poll = pollRes.rows[0];
    const insertRows = options.map((opt, idx) => [poll.id, opt.label, !!opt.is_other, idx + 1]);

    for (const row of insertRows) {
      await client.query(
        `INSERT INTO poll_options (poll_id, label, is_other, sort_order)
         VALUES ($1, $2, $3, $4)`,
        row
      );
    }

    await client.query("COMMIT");
    return poll;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updatePoll({ pollId, title, type, allowMultipleAnswers, allowOtherOption, deadlineAt, options }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const pollRes = await client.query(
      `UPDATE polls
          SET title = $2,
              type = $3,
              allow_multiple_answers = $4,
              allow_other_option = $5,
              deadline_at = $6,
              updated_at = NOW()
        WHERE id = $1
          AND status <> 'CLOSED'
      RETURNING *`,
      [pollId, title, type, allowMultipleAnswers, allowOtherOption, deadlineAt]
    );

    const poll = pollRes.rows[0];
    if (!poll) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(`DELETE FROM poll_options WHERE poll_id = $1`, [pollId]);

    for (let idx = 0; idx < options.length; idx += 1) {
      const opt = options[idx];
      await client.query(
        `INSERT INTO poll_options (poll_id, label, is_other, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [pollId, opt.label, !!opt.is_other, idx + 1]
      );
    }

    await client.query("COMMIT");
    return poll;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function publishPoll(pollId) {
  await closeExpiredPolls();
  const { rows } = await pool.query(
    `UPDATE polls
        SET status = CASE
              WHEN (NOW() AT TIME ZONE 'America/Sao_Paulo')::date > (deadline_at AT TIME ZONE 'America/Sao_Paulo')::date
              THEN 'CLOSED' ELSE 'ACTIVE' END,
            updated_at = NOW()
      WHERE id = $1
        AND status <> 'CLOSED'
    RETURNING *`,
    [pollId]
  );
  return rows[0] || null;
}

async function listPolls({ status }) {
  await closeExpiredPolls();
  const desired = status === "CLOSED" ? "CLOSED" : "ACTIVE";
  const { rows } = await pool.query(
    `SELECT p.id,
            p.title,
            p.type,
            p.allow_multiple_answers,
            p.allow_other_option,
            p.deadline_at,
            (p.deadline_at AT TIME ZONE 'America/Sao_Paulo')::date AS deadline_date,
            p.status,
            p.created_at,
            COUNT(DISTINCT v.user_id)::int AS participants
       FROM polls p
       LEFT JOIN poll_votes v ON v.poll_id = p.id
      WHERE p.status = $1
      GROUP BY p.id
      ORDER BY p.deadline_at ASC, p.created_at DESC`,
    [desired]
  );
  return rows;
}

async function getPollById(pollId) {
  await closeExpiredPolls();
  const pollRes = await pool.query(`SELECT * FROM polls WHERE id = $1 LIMIT 1`, [pollId]);
  const poll = pollRes.rows[0];
  if (!poll) return null;

  const optionsRes = await pool.query(
    `SELECT id, poll_id, label, is_other, sort_order
       FROM poll_options
      WHERE poll_id = $1
      ORDER BY sort_order ASC, id ASC`,
    [pollId]
  );

  return {
    ...poll,
    options: optionsRes.rows,
  };
}

async function replaceVote({ pollId, userId, votes }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await closeExpiredPolls(client);

    await client.query(`DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2`, [pollId, userId]);

    for (const vote of votes) {
      await client.query(
        `INSERT INTO poll_votes (poll_id, user_id, option_id, other_text)
         VALUES ($1, $2, $3, $4)`,
        [pollId, userId, vote.optionId, vote.otherText || null]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getVotesByUser({ pollId, userId }) {
  const { rows } = await pool.query(
    `SELECT option_id, other_text
       FROM poll_votes
      WHERE poll_id = $1 AND user_id = $2
      ORDER BY option_id ASC`,
    [pollId, userId]
  );
  return rows;
}

async function getPollResults(pollId) {
  await closeExpiredPolls();
  const { rows } = await pool.query(
    `SELECT o.id AS option_id,
            o.label,
            o.is_other,
            v.user_id,
            v.other_text,
            f.nome
       FROM poll_options o
       LEFT JOIN poll_votes v
         ON v.option_id = o.id
        AND v.poll_id = o.poll_id
       LEFT JOIN filiados f
         ON f.id = v.user_id
      WHERE o.poll_id = $1
      ORDER BY o.sort_order ASC, o.id ASC, f.nome ASC`,
    [pollId]
  );
  return rows;
}

module.exports = {
  createPoll,
  updatePoll,
  publishPoll,
  listPolls,
  getPollById,
  replaceVote,
  getVotesByUser,
  getPollResults,
};
