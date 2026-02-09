// src/services/eventos.service.js
const pool = require("../config/db");

const TIPOS_VALIDOS = new Set(["AGE", "AGO", "INFORMATIVA", "OUTROS"]);
const STATUS_VALIDOS = new Set(["RASCUNHO", "AGENDADO", "ABERTO", "ENCERRADO", "CANCELADO"]);

function normUpper(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.toUpperCase() : null;
}

function normStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normNumOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Cria evento
 */
exports.criarEvento = async ({
  tipo,
  titulo,
  pautaResumida,
  dataHoraInicioPrevista,
  duracaoPrevistaMin,
  editalPdfUrl,
  status = "RASCUNHO",
  createdBy,
}) => {
  const tipoNorm = normUpper(tipo);
  const statusNorm = normUpper(status) || "RASCUNHO";
  const tituloNorm = normStr(titulo);

  if (!tipoNorm || !TIPOS_VALIDOS.has(tipoNorm)) throw new Error("Tipo de evento inválido.");
  if (!STATUS_VALIDOS.has(statusNorm)) throw new Error("Status inválido.");
  if (!tituloNorm) throw new Error("Título é obrigatório.");

  const durMin = normNumOrNull(duracaoPrevistaMin);
  if (duracaoPrevistaMin != null && durMin == null) throw new Error("Duração prevista deve ser um número.");
  if (durMin != null && durMin <= 0) throw new Error("Duração prevista deve ser maior que zero.");

  const q = `
    INSERT INTO eventos (
      tipo,
      titulo,
      pauta_resumida,
      data_hora_inicio_prevista,
      duracao_prevista_min,
      edital_pdf_url,
      status,
      quorum_versao_atual,
      created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8)
    RETURNING *
  `;

  const r = await pool.query(q, [
    tipoNorm,
    tituloNorm,
    normStr(pautaResumida),
    dataHoraInicioPrevista ? String(dataHoraInicioPrevista) : null,
    durMin,
    normStr(editalPdfUrl),
    statusNorm,
    createdBy ?? null,
  ]);

  return r.rows[0];
};

/**
 * Agenda evento (RASCUNHO -> AGENDADO)
 * Retorna null se não transicionou
 */
exports.agendarEvento = async ({ eventoId }) => {
  const q = `
    UPDATE eventos
       SET status = 'AGENDADO',
           updated_at = NOW()
     WHERE id = $1
       AND status = 'RASCUNHO'
     RETURNING *
  `;
  const r = await pool.query(q, [eventoId]);
  return r.rows[0] || null;
};

/**
 * Cancela evento
 * Retorna null se não atualizou (id inexistente ou status ENCERRADO)
 */
exports.cancelarEvento = async ({ eventoId }) => {
  const q = `
    UPDATE eventos
       SET status = 'CANCELADO',
           updated_at = NOW()
     WHERE id = $1
       AND status <> 'ENCERRADO'
     RETURNING *
  `;
  const r = await pool.query(q, [eventoId]);
  return r.rows[0] || null;
};

/**
 * Obtém evento por ID
 */
exports.obterEvento = async ({ eventoId }) => {
  const r = await pool.query(`SELECT * FROM eventos WHERE id = $1`, [eventoId]);
  return r.rows[0] || null;
};

/**
 * Próximo evento (para Home do app)
 */
exports.obterProximoEvento = async () => {
  const r = await pool.query(`
    SELECT *
      FROM eventos
     WHERE status IN ('AGENDADO','ABERTO')
     ORDER BY
       CASE status WHEN 'ABERTO' THEN 0 ELSE 1 END,
       data_hora_inicio_prevista ASC NULLS LAST
     LIMIT 1
  `);
  return r.rows[0] || null;
};

/**
 * ABRIR EVENTO (AGENDADO -> ABERTO)
 * Retorna null se não transicionou
 */
exports.abrirEvento = async ({ eventoId }) => {
  const q = `
    UPDATE eventos
       SET status = 'ABERTO',
           abre_em = NOW(),
           updated_at = NOW()
     WHERE id = $1
       AND status = 'AGENDADO'
     RETURNING *
  `;
  const r = await pool.query(q, [eventoId]);
  return r.rows[0] || null;
};

/**
 * ENCERRAR EVENTO (ABERTO -> ENCERRADO)
 * Retorna null se não transicionou
 */
exports.encerrarEvento = async ({ eventoId }) => {
  const q = `
    UPDATE eventos
       SET status = 'ENCERRADO',
           encerra_em = NOW(),
           updated_at = NOW()
     WHERE id = $1
       AND status = 'ABERTO'
     RETURNING *
  `;
  const r = await pool.query(q, [eventoId]);
  return r.rows[0] || null;
};

/* ============================================================
 * PRESENÇA / QUÓRUM (alinhado ao seu schema: ativa boolean)
 * ============================================================ */

/**
 * Entrar no evento (registrar presença)
 * Regras:
 * - evento precisa estar ABERTO
 * - se já está presente (ativa=true), retorna a presença existente
 */
exports.entrarNoEvento = async ({ eventoId, userId, deviceId }) => {
  if (!userId) throw new Error("Membro inválido.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Trava o evento para ler status e versão do quórum
    const ev = await client.query(
      `SELECT id, status, quorum_versao_atual
         FROM eventos
        WHERE id = $1
        FOR UPDATE`,
      [eventoId]
    );

    if (!ev.rowCount) throw new Error("Evento não encontrado.");
    if (ev.rows[0].status !== "ABERTO") throw new Error("Evento não está ABERTO.");

    const quorumVersao = ev.rows[0].quorum_versao_atual || 1;

    // Se já tem presença ativa, retorna
    const existing = await client.query(
      `SELECT id, evento_id, user_id, entrou_em, saiu_em, ativa, quorum_versao, device_id
         FROM evento_presencas
        WHERE evento_id = $1
          AND user_id = $2
          AND ativa = true
        LIMIT 1`,
      [eventoId, userId]
    );

    if (existing.rowCount) {
      await client.query("COMMIT");
      return existing.rows[0];
    }

    const ins = await client.query(
      `INSERT INTO evento_presencas (evento_id, user_id, entrou_em, ativa, quorum_versao, device_id)
       VALUES ($1, $2, NOW(), true, $3, $4)
       RETURNING id, evento_id, user_id, entrou_em, saiu_em, ativa, quorum_versao, device_id`,
      [eventoId, userId, quorumVersao, deviceId ? String(deviceId) : null]
    );

    await client.query("COMMIT");
    return ins.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

/**
 * Sair do evento (encerrar presença ativa)
 */
exports.sairDoEvento = async ({ eventoId, userId }) => {
  if (!userId) throw new Error("Membro inválido.");

  const r = await pool.query(
    `UPDATE evento_presencas
        SET ativa = false,
            saiu_em = NOW()
      WHERE evento_id = $1
        AND user_id = $2
        AND ativa = true`,
    [eventoId, userId]
  );

  return r.rowCount > 0;
};

/**
 * Listar presenças (ativas e históricas)
 * Se quiser apenas ativas: acrescente "AND ep.ativa = true" no WHERE.
 */
exports.listarPresencas = async ({ eventoId }) => {
  const r = await pool.query(
    `SELECT
        ep.id,
        ep.evento_id,
        ep.user_id,
        ep.entrou_em,
        ep.saiu_em,
        ep.ativa,
        ep.quorum_versao,
        ep.device_id
     FROM evento_presencas ep
    WHERE ep.evento_id = $1
    ORDER BY ep.entrou_em ASC`,
    [eventoId]
  );

  return r.rows;
};

/**
 * Recontar quórum:
 * - evento precisa estar ABERTO
 * - incrementa eventos.quorum_versao_atual
 * - derruba todos os presentes (ativa=true)
 */
exports.recontarQuorum = async ({ eventoId }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ev = await client.query(
      `SELECT id, status, quorum_versao_atual
         FROM eventos
        WHERE id = $1
        FOR UPDATE`,
      [eventoId]
    );

    if (!ev.rowCount) throw new Error("Evento não encontrado.");
    if (ev.rows[0].status !== "ABERTO") throw new Error("Só é possível recontar quórum com evento ABERTO.");

    const newVersao = (ev.rows[0].quorum_versao_atual || 1) + 1;

    await client.query(
      `UPDATE eventos
          SET quorum_versao_atual = $2,
              updated_at = NOW()
        WHERE id = $1`,
      [eventoId, newVersao]
    );

    const dropped = await client.query(
      `UPDATE evento_presencas
          SET ativa = false,
              saiu_em = NOW()
        WHERE evento_id = $1
          AND ativa = true`,
      [eventoId]
    );

    await client.query("COMMIT");
    return { ok: true, quorum_versao_atual: newVersao, derrubados: dropped.rowCount };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};
