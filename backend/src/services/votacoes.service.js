// src/services/votacoes.service.js
const pool = require("../config/db");
const { randomUUID } = require("crypto");

function normalizeStatus(s) {
  const v = (s || "").toString().toUpperCase().trim();
  if (!v) return "";
  if (!["AGENDADA", "ABERTA", "ENCERRADA"].includes(v)) return "";
  return v;
}

exports.listarVotacoes = async ({ userId, status }) => {
  const st = normalizeStatus(status);

  const where = st ? "WHERE v.status = $1" : "";
  const params = st ? [st] : [];

  const sql = `
    SELECT
      v.id, v.titulo, v.status, v.abre_em, v.encerra_em,
      EXISTS (
        SELECT 1 FROM votacao_votos vv
        WHERE vv.votacao_id = v.id AND vv.user_id = $${params.length + 1}
      ) AS ja_votou
    FROM votacoes v
    ${where}
    ORDER BY v.criado_em DESC
    LIMIT 100;
  `;

  const { rows } = await pool.query(sql, [...params, userId]);
  return rows;
};

exports.obterVotacao = async ({ votacaoId, userId }) => {
  const vSql = `
    SELECT
      v.id, v.titulo, v.descricao, v.status, v.abre_em, v.encerra_em,
      EXISTS (
        SELECT 1 FROM votacao_votos vv
        WHERE vv.votacao_id = v.id AND vv.user_id = $2
      ) AS ja_votou
    FROM votacoes v
    WHERE v.id = $1
    LIMIT 1;
  `;
  const vRes = await pool.query(vSql, [votacaoId, userId]);
  const votacao = vRes.rows[0];
  if (!votacao) return null;

  const oSql = `
    SELECT id, texto, ordem
    FROM votacao_opcoes
    WHERE votacao_id = $1
    ORDER BY ordem ASC, id ASC;
  `;
  const oRes = await pool.query(oSql, [votacaoId]);

  return { ...votacao, opcoes: oRes.rows };
};

exports.criarVotacao = async ({ criadoPor, titulo, descricao, abreEm, encerraEm, opcoes }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertV = `
      INSERT INTO votacoes (titulo, descricao, status, abre_em, encerra_em, criado_por)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, titulo, status, abre_em, encerra_em;
    `;

    // Se abre_em vem preenchido no futuro → AGENDADA; se abre_em já no passado → ABERTA (opcional)
    const status = "AGENDADA";

    const vRes = await client.query(insertV, [
      titulo,
      descricao || "",
      status,
      abreEm ? new Date(abreEm) : null,
      encerraEm ? new Date(encerraEm) : null,
      criadoPor,
    ]);

    const votacao = vRes.rows[0];

    const validOpcoes = [];
    for (let i = 0; i < opcoes.length; i++) {
      const opcao = opcoes[i];
      if (!opcao || typeof opcao !== "object") continue;
      const texto = (opcao.texto || "").toString().trim();
      if (!texto) continue;
      const ordem = Number.isFinite(opcao.ordem) ? opcao.ordem : i + 1;
      validOpcoes.push({ texto, ordem });
    }

    if (validOpcoes.length < 2) {
      throw new Error("Informe pelo menos 2 opções válidas.");
    }

    // Otimização Bolt: Batch insert de opções para reduzir roundtrips ao DB (1+N -> 2 queries)
    const placeholders = validOpcoes.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
    const params = [votacao.id];
    validOpcoes.forEach(o => params.push(o.texto, o.ordem));

    const oRes = await client.query(
      `INSERT INTO votacao_opcoes (votacao_id, texto, ordem) VALUES ${placeholders} RETURNING id, texto, ordem`,
      params
    );
    const opRows = oRes.rows;

    await client.query("COMMIT");
    return { ...votacao, opcoes: opRows };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

exports.abrirVotacao = async ({ votacaoId }) => {
  const sql = `
    UPDATE votacoes
    SET status = 'ABERTA',
        abre_em = COALESCE(abre_em, NOW()),
        atualizado_em = NOW()
    WHERE id = $1
    RETURNING id;
  `;
  const { rowCount } = await pool.query(sql, [votacaoId]);
  return rowCount > 0;
};

exports.encerrarVotacao = async ({ votacaoId }) => {
  const sql = `
    UPDATE votacoes
    SET status = 'ENCERRADA',
        encerra_em = COALESCE(encerra_em, NOW()),
        atualizado_em = NOW()
    WHERE id = $1
    RETURNING id;
  `;
  const { rowCount } = await pool.query(sql, [votacaoId]);
  return rowCount > 0;
};

exports.registrarVoto = async ({ votacaoId, opcaoId, userId, deviceId, biometriaConfirmada, ip, userAgent }) => {
  // 1) valida votação e janela
  const vSql = `SELECT id, status, abre_em, encerra_em FROM votacoes WHERE id = $1 LIMIT 1;`;
  const vRes = await pool.query(vSql, [votacaoId]);
  const v = vRes.rows[0];
  if (!v) throw new Error("Votação não encontrada.");

  if (v.status !== "ABERTA") throw new Error("Esta votação não está aberta.");

  const now = new Date();
  if (v.abre_em && now < new Date(v.abre_em)) throw new Error("Esta votação ainda não abriu.");
  if (v.encerra_em && now > new Date(v.encerra_em)) throw new Error("Esta votação já está encerrada.");

  // 2) grava voto (unique (votacao_id, user_id) garante 1 voto)
  const recibo = randomUUID();

  const sql = `
    INSERT INTO votacao_votos
      (votacao_id, opcao_id, user_id, recibo, device_id, biometria_confirmada, ip, user_agent)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING recibo;
  `;

  try {
    const r = await pool.query(sql, [
      votacaoId,
      opcaoId,
      userId,
      recibo,
      deviceId,
      biometriaConfirmada,
      ip,
      userAgent,
    ]);

    return { message: "Voto computado com sucesso.", recibo: r.rows[0].recibo };
  } catch (e) {
    // violação da unique constraint: já votou
    if (String(e.code) === "23505") {
      throw new Error("Você já votou nesta votação.");
    }
    // violação FK (opção não pertence à votação, etc.)
    if (String(e.code) === "23503") {
      throw new Error("Opção inválida para esta votação.");
    }
    throw e;
  }
};

exports.obterResultado = async ({ votacaoId }) => {
  const vSql = `SELECT id, titulo, status, abre_em, encerra_em FROM votacoes WHERE id = $1 LIMIT 1;`;
  const vRes = await pool.query(vSql, [votacaoId]);
  const v = vRes.rows[0];
  if (!v) return null;

  const sql = `
    SELECT o.id, o.texto, o.ordem, COUNT(vv.id)::int AS votos
    FROM votacao_opcoes o
    LEFT JOIN votacao_votos vv
      ON vv.opcao_id = o.id AND vv.votacao_id = o.votacao_id
    WHERE o.votacao_id = $1
    GROUP BY o.id, o.texto, o.ordem
    ORDER BY o.ordem ASC, o.id ASC;
  `;
  const { rows } = await pool.query(sql, [votacaoId]);

  const total = rows.reduce((acc, r) => acc + (r.votos || 0), 0);
  return { ...v, total, opcoes: rows };
};
