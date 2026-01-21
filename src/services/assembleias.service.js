// src/services/assembleias.service.js
const pool = require("../config/db");

const ASSEMBLEIA_COLUMNS = "id, tipo, titulo, descricao, estado, criado_por, aberta_em, encerrada_em, criado_em";

async function listar(perfilAcesso) {
  let query = `SELECT ${ASSEMBLEIA_COLUMNS} FROM assembleias`;
  const params = [];

  if (perfilAcesso === "FILIADO") {
    query += " WHERE estado IN ('ABERTA', 'ENCERRADA')";
  }

  query += " ORDER BY criado_em DESC";

  const { rows } = await pool.query(query, params);
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await pool.query(`SELECT ${ASSEMBLEIA_COLUMNS} FROM assembleias WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function criar(dados) {
  const { tipo, titulo, descricao, criado_por } = dados;
  const { rows } = await pool.query(
    `INSERT INTO assembleias (tipo, titulo, descricao, criado_por)
     VALUES ($1, $2, $3, $4)
     RETURNING ${ASSEMBLEIA_COLUMNS}`,
    [tipo, titulo, descricao, criado_por]
  );
  return rows[0];
}

async function abrir(id) {
  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'ABERTA', aberta_em = NOW() WHERE id = $1 RETURNING ${ASSEMBLEIA_COLUMNS}`,
    [id]
  );
  return rows[0];
}

async function encerrar(id) {
  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'ENCERRADA', encerrada_em = NOW() WHERE id = $1 RETURNING ${ASSEMBLEIA_COLUMNS}`,
    [id]
  );
  return rows[0];
}

async function registrarAuditoria(assembleiaId, filiadoId, evento, payload) {
  try {
    await pool.query(
      "INSERT INTO assembleia_auditoria (assembleia_id, filiado_id, evento, payload) VALUES ($1, $2, $3, $4)",
      [assembleiaId, filiadoId, evento, payload ? JSON.stringify(payload) : null]
    );
  } catch (err) {
    console.error("Erro ao registrar auditoria de assembleia:", err);
  }
}

 async function gerarQuorum(assembleiaId, token, validadeMinutos = 10) {
   const { rows } = await pool.query(
     `INSERT INTO assembleia_quoruns (assembleia_id, token, valido_ate)
      VALUES ($1, $2, NOW() + interval '1 minute' * $3)
      RETURNING id, token, valido_ate`,
     [assembleiaId, token, validadeMinutos]
   );
   return rows[0];
 }

 async function buscarQuorumPorToken(assembleiaId, token) {
   const { rows } = await pool.query(
     `SELECT id, valido_ate FROM assembleia_quoruns
      WHERE assembleia_id = $1 AND token = $2 AND valido_ate > NOW()
      ORDER BY criado_em DESC LIMIT 1`,
     [assembleiaId, token]
   );
   return rows[0];
 }

 async function realizarCheckin(quorumId, filiadoId) {
   const { rows } = await pool.query(
     `INSERT INTO assembleia_checkins (quorum_id, filiado_id)
      VALUES ($1, $2)
      ON CONFLICT (quorum_id, filiado_id) DO UPDATE SET registrado_em = NOW()
      RETURNING id`,
     [quorumId, filiadoId]
   );
   return rows[0];
 }

module.exports = {
  listar,
  buscarPorId,
  criar,
  abrir,
  encerrar,
   registrarAuditoria,
   gerarQuorum,
   buscarQuorumPorToken,
   realizarCheckin
};
