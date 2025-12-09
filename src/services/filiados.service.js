// src/services/filiados.service.js
const pool = require("../config/db");
const { normalizarCpf } = require("../utils/format");

/**
 * Busca filiado pelo CPF já normalizado (apenas dígitos).
 */
async function buscarPorCpf(cpf) {
  const cpfLimpo = normalizarCpf(cpf);
  const result = await pool.query(
    `
    SELECT
      id,
      nome,
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
      situacao,
      senha_hash,
      twofa_secret,
      perfil_acesso
    FROM filiados
    WHERE cpf = $1
    `,
    [cpfLimpo]
  );
  return result.rows[0] || null;
}

/**
 * Busca filiado pelo ID.
 */
async function buscarPorId(id) {
  const result = await pool.query(
    `
    SELECT
      id,
      nome,
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
      situacao,
      senha_hash,
      twofa_secret,
      perfil_acesso
    FROM filiados
    WHERE id = $1
    `,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Atualiza dados no primeiro acesso (confirmação).
 */
async function atualizarPrimeiroAcesso(id, cpf, dadosAtualizar) {
  const {
    telefone1,
    telefone2,
    email1,
    email2,
    endereco,
    senha_hash,
  } = dadosAtualizar;

  const result = await pool.query(
    `
    UPDATE filiados
    SET
      telefone1 = $1,
      telefone2 = $2,
      email1    = $3,
      email2    = $4,
      endereco  = $5,
      senha_hash = $6,
      atualizado_em = NOW()
    WHERE id = $7 AND cpf = $8
    RETURNING id, nome, cpf, perfil_acesso, situacao
    `,
    [telefone1, telefone2, email1, email2, endereco, senha_hash, id, cpf]
  );

  return result.rows[0] || null;
}

/**
 * Atualiza segredo 2FA.
 */
async function salvarTwoFaSecret(id, secretBase32) {
  const result = await pool.query(
    `
    UPDATE filiados
    SET twofa_secret = $1, atualizado_em = NOW()
    WHERE id = $2
    RETURNING id, nome, cpf, perfil_acesso
    `,
    [secretBase32, id]
  );
  return result.rows[0] || null;
}

/**
 * Atualiza último acesso.
 */
async function registrarUltimoAcesso(id) {
  await pool.query(
    `
    UPDATE filiados
    SET ultimo_acesso = NOW()
    WHERE id = $1
    `,
    [id]
  );
}

/**
 * Lista filiados conforme perfil de acesso.
 * - FILIADO: apenas nome + telefone1 dos outros
 * - DIRETORIA / FUNCIONARIO / ADMIN: dados completos
 */
async function listarParaPerfil(perfil) {
  if (perfil === "DIRETORIA" || perfil === "FUNCIONARIO" || perfil === "ADMIN") {
    const result = await pool.query(
      `
      SELECT
        id,
        nome,
        cpf,
        telefone1,
        telefone2,
        email1,
        email2,
        endereco,
        situacao,
        perfil_acesso
      FROM filiados
      ORDER BY nome
      `
    );
    return result.rows;
  }

  // Perfil normal
  const result = await pool.query(
    `
    SELECT
      id,
      nome,
      telefone1
    FROM filiados
    WHERE situacao = 'Ativo'
    ORDER BY nome
    `
  );
  return result.rows;
}

/**
 * Atualiza dados de contato de um filiado (telefones, e-mails, endereço).
 * Usado para o próprio filiado ou atualização limitada.
 */
async function atualizarDadosContato(id, dados) {
  const {
    telefone1 = null,
    telefone2 = null,
    email1 = null,
    email2 = null,
    endereco = null,
  } = dados;

  const result = await pool.query(
    `
    UPDATE filiados
    SET
      telefone1   = COALESCE($1, telefone1),
      telefone2   = COALESCE($2, telefone2),
      email1      = COALESCE($3, email1),
      email2      = COALESCE($4, email2),
      endereco    = COALESCE($5, endereco),
      atualizado_em = NOW()
    WHERE id = $6
    RETURNING
      id,
      nome,
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
      situacao,
      perfil_acesso
    `,
    [telefone1, telefone2, email1, email2, endereco, id]
  );

  return result.rows[0] || null;
}

/**
 * Atualiza dados completos de um filiado.
 * Usado por DIRETORIA / FUNCIONARIO / ADMIN.
 */
async function atualizarDadosCompleto(id, dados) {
  const {
    nome,
    cpf,
    data_nascimento,
    telefone1,
    telefone2,
    email1,
    email2,
    endereco,
    situacao,
    perfil_acesso,
  } = dados;

  const result = await pool.query(
    `
    UPDATE filiados
    SET
      nome            = $1,
      cpf             = $2,
      data_nascimento = $3,
      telefone1       = $4,
      telefone2       = $5,
      email1          = $6,
      email2          = $7,
      endereco        = $8,
      situacao        = $9,
      perfil_acesso   = $10,
      atualizado_em   = NOW()
    WHERE id = $11
    RETURNING
      id,
      nome,
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
      situacao,
      perfil_acesso
    `,
    [
      nome,
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
      situacao,
      perfil_acesso,
      id,
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarPorCpf,
  buscarPorId,
  atualizarPrimeiroAcesso,
  salvarTwoFaSecret,
  registrarUltimoAcesso,
  listarParaPerfil,
  atualizarDadosContato,
  atualizarDadosCompleto,
};
