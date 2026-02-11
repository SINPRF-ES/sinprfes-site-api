// src/services/eventoVotacoes.service.js
const pool = require("../config/db");
const { generateUuid } = require("../utils/format");

function assertMin(min) {
  const m = Number(min);
  if (!Number.isFinite(m) || m < 1 || m > 5) throw new Error("duracao_min deve estar entre 1 e 5.");
  return m;
}

exports.criarVotacaoSimNao = async ({ eventoId, titulo, duracaoMin, criadoPor }) => {
  const m = assertMin(duracaoMin ?? 2);
  const newId = generateUuid();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ev = await client.query(`SELECT id, status FROM eventos WHERE id=$1 LIMIT 1`, [eventoId]);
    if (!ev.rows[0]) throw new Error("Evento não encontrado.");

    const ins = await client.query(
      `
      INSERT INTO evento_votacoes (id, evento_id, titulo, duracao_min, criado_por)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, evento_id, titulo, status, duracao_min, criado_em;
      `,
      [newId, eventoId, String(titulo || "").trim(), m, criadoPor]
    );

    const votacao = ins.rows[0];

    await client.query(
      `
      INSERT INTO evento_votacao_opcoes (id, votacao_id, texto, ordem)
      VALUES
        ($1, $3, 'Sim', 1),
        ($2, $3, 'Não', 2);
      `,
      [generateUuid(), generateUuid(), votacao.id]
    );

    await client.query("COMMIT");
    return votacao;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

exports.abrirVotacao = async ({ eventoId, votacaoId, abertoPor }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // evento deve estar ABERTO
    const ev = await client.query(`SELECT id, status, quorum_epoch FROM eventos WHERE id=$1 LIMIT 1`, [eventoId]);
    const evento = ev.rows[0];
    if (!evento) throw new Error("Evento não encontrado.");
    if (evento.status !== "ABERTO") throw new Error("Evento não está ABERTO.");

    // votação deve pertencer ao evento e estar AGENDADA
    const vq = await client.query(
      `
      SELECT id, status, duracao_min
      FROM evento_votacoes
      WHERE id=$1 AND evento_id=$2
      LIMIT 1
      `,
      [votacaoId, eventoId]
    );
    const votacao = vq.rows[0];
    if (!votacao) throw new Error("Votação não encontrada.");
    if (votacao.status !== "AGENDADA") throw new Error("Votação já foi aberta/encerrada.");

    // trava quorum_epoch e snapshot de elegíveis (presentes ativos agora)
    const nowRes = await client.query("SELECT now() as now");
    const now = nowRes.rows[0].now;

    const encerraEm = new Date(now);
    encerraEm.setMinutes(encerraEm.getMinutes() + Number(votacao.duracao_min));

    await client.query(
      `
      UPDATE evento_votacoes
      SET status='ABERTA',
          abre_em=$3,
          encerra_em=$4,
          quorum_epoch_travado=$5,
          presenca_minima_em=$3
      WHERE id=$1 AND evento_id=$2
      `,
      [votacaoId, eventoId, now, encerraEm, evento.quorum_epoch]
    );

    // snapshot elegíveis: quem está presente ativo no evento neste instante
    await client.query(
      `
      INSERT INTO evento_votacao_elegiveis (votacao_id, user_id, entrou_em)
      SELECT $1, p.user_id, p.entrou_em
      FROM evento_presencas p
      WHERE p.evento_id=$2
        AND p.ativo=true
        AND p.quorum_epoch=$3
      ON CONFLICT DO NOTHING
      `,
      [votacaoId, eventoId, evento.quorum_epoch]
    );

    await client.query("COMMIT");
    return { ok: true, abre_em: now, encerra_em: encerraEm, quorum_epoch: evento.quorum_epoch };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

exports.listarVotacoesEvento = async ({ eventoId, userId }) => {
  const sql = `
    SELECT v.id, v.titulo, v.status, v.abre_em, v.encerra_em, v.duracao_min,
           EXISTS (
             SELECT 1 FROM evento_votacao_votos vv
             WHERE vv.votacao_id = v.id AND vv.user_id = $2
           ) AS ja_votou
    FROM evento_votacoes v
    WHERE v.evento_id = $1
    ORDER BY v.id DESC
    LIMIT 200;
  `;
  const { rows } = await pool.query(sql, [eventoId, userId]);
  return rows;
};

exports.detalheVotacao = async ({ eventoId, votacaoId, userId }) => {
  const vq = await pool.query(
    `
    SELECT id, evento_id, titulo, status, abre_em, encerra_em, duracao_min
    FROM evento_votacoes
    WHERE id=$1 AND evento_id=$2
    LIMIT 1
    `,
    [votacaoId, eventoId]
  );
  const votacao = vq.rows[0];
  if (!votacao) return null;

  const op = await pool.query(
    `
    SELECT id, texto, ordem
    FROM evento_votacao_opcoes
    WHERE votacao_id=$1
    ORDER BY ordem ASC
    `,
    [votacaoId]
  );

  const ja = await pool.query(
    `SELECT 1 FROM evento_votacao_votos WHERE votacao_id=$1 AND user_id=$2 LIMIT 1`,
    [votacaoId, userId]
  );

  return { ...votacao, opcoes: op.rows, ja_votou: ja.rowCount > 0 };
};

exports.votar = async ({ eventoId, votacaoId, userId, opcaoId }) => {
  const opc = Number(opcaoId);
  if (!Number.isFinite(opc) || opc <= 0) throw new Error("opcao_id inválido.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // votação e janela
    const vq = await client.query(
      `
      SELECT id, evento_id, status, abre_em, encerra_em
      FROM evento_votacoes
      WHERE id=$1 AND evento_id=$2
      LIMIT 1
      `,
      [votacaoId, eventoId]
    );
    const votacao = vq.rows[0];
    if (!votacao) throw new Error("Votação não encontrada.");
    if (votacao.status !== "ABERTA") throw new Error("Votação não está ABERTA.");

    const nowRes = await client.query("SELECT now() as now");
    const now = nowRes.rows[0].now;
    if (votacao.encerra_em && now > votacao.encerra_em) throw new Error("Votação encerrada.");

    // elegibilidade: precisa estar no snapshot
    const el = await client.query(
      `
      SELECT 1
      FROM evento_votacao_elegiveis
      WHERE votacao_id=$1 AND user_id=$2
      LIMIT 1
      `,
      [votacaoId, userId]
    );
    if (el.rowCount === 0) {
      throw new Error("Você não está elegível para votar (não estava presente na abertura).");
    }

    // opcao precisa pertencer a esta votação
    const okOpt = await client.query(
      `SELECT 1 FROM evento_votacao_opcoes WHERE id=$1 AND votacao_id=$2 LIMIT 1`,
      [opc, votacaoId]
    );
    if (okOpt.rowCount === 0) throw new Error("Opção inválida.");

    const ins = await client.query(
      `
      INSERT INTO evento_votacao_votos (id, votacao_id, user_id, opcao_id, recibo)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING recibo, votou_em;
      `,
      [generateUuid(), votacaoId, userId, opc, generateUuid()]
    );

    await client.query("COMMIT");
    return { message: "Voto computado com sucesso.", recibo: ins.rows[0].recibo };
  } catch (e) {
    await client.query("ROLLBACK");

    // erro de voto duplicado
    if (String(e.message || "").includes("duplicate key") || String(e.code) === "23505") {
      throw new Error("Você já votou nesta votação.");
    }

    throw e;
  } finally {
    client.release();
  }
};
