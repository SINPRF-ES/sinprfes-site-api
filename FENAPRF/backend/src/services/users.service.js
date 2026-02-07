const pool = require("../config/db");

/**
 * Busca usuário pelo CPF (normalizado).
 */
async function buscarPorCpf(cpf) {
  const { rows } = await pool.query(
    "SELECT *, password_hash as senha_hash FROM users WHERE cpf = $1 LIMIT 1",
    [cpf]
  );
  return rows[0] || null;
}

/**
 * Busca usuário pelo ID (UUID).
 */
async function buscarPorId(id) {
  const { rows } = await pool.query(
    "SELECT *, password_hash as senha_hash FROM users WHERE id = $1 LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

/**
 * Grava token de reset e expiração.
 */
async function setResetToken(id, token, expiracao) {
  await pool.query(
    "UPDATE users SET token_acesso_temp = $1, token_expiracao = $2 WHERE id = $3",
    [token, expiracao, id]
  );
}

/**
 * Atualiza senha e limpa tokens de reset.
 */
async function setPassword(id, passwordHash) {
  await pool.query(
    `UPDATE users
     SET password_hash = $1, token_acesso_temp = NULL, token_expiracao = NULL, updated_at = NOW()
     WHERE id = $2`,
    [passwordHash, id]
  );
}

/**
 * Registra data do último acesso.
 */
async function registrarUltimoAcesso(id) {
  await pool.query(
    "UPDATE users SET ultimo_acesso = NOW() WHERE id = $1",
    [id]
  );
}

/**
 * Listagem simplificada para FENAPRF.
 */
async function listarParaPerfil(perfilAcesso) {
  // Mantém compatibilidade mínima de colunas
  const { rows } = await pool.query(
    `SELECT id, name as nome, cpf, perfil_acesso, bloqueado, arquivado_em, lotacao, situacao, email
     FROM users
     ORDER BY name ASC`
  );
  return rows;
}

module.exports = {
  buscarPorCpf,
  buscarPorId,
  setResetToken,
  setPassword,
  registrarUltimoAcesso,
  listarParaPerfil
};
