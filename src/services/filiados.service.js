// src/services/filiados.service.js
const pool = require("../config/db");
const { normalizarCpf } = require("../utils/format");

/**
 * Busca filiado pelo CPF (já normalizando).
 * Usado em autenticação, primeiro acesso etc.
 */
async function buscarPorCpf(cpfRaw) {
  const cpf = normalizarCpf(cpfRaw);
  const { rows } = await pool.query(
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
      lotacao,
      situacao,
      senha_hash,
      twofa_secret,
      ultimo_acesso,
      criado_em,
      atualizado_em,
      perfil_acesso,
      avatar_url,
      bloqueado
    FROM filiados
    WHERE cpf = $1
    LIMIT 1
  `,
    [cpf]
  );

  return rows[0] || null;
}

/**
 * Busca filiado pelo ID.
 */
async function buscarPorId(id) {
  const { rows } = await pool.query(
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
      lotacao,
      situacao,
      senha_hash,
      twofa_secret,
      ultimo_acesso,
      criado_em,
      atualizado_em,
      perfil_acesso,
      avatar_url,
      bloqueado
    FROM filiados
    WHERE id = $1
    LIMIT 1
  `,
    [id]
  );

  return rows[0] || null;
}

/**
 * Atualiza o campo ultimo_acesso do filiado.
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
 * Atualiza dados básicos do próprio filiado ("Meus dados").
 * Campos permitidos: telefone1, telefone2, email1, email2, endereco, lotacao.
 */
async function atualizarDadosProprios(id, dados) {
  const {
    telefone1 = null,
    telefone2 = null,
    email1 = null,
    email2 = null,
    endereco = null,
    lotacao = null,
  } = dados;

  const { rows } = await pool.query(
    `
    UPDATE filiados
    SET
      telefone1 = $1,
      telefone2 = $2,
      email1    = $3,
      email2    = $4,
      endereco  = $5,
      lotacao   = $6,
      atualizado_em = NOW()
    WHERE id = $7
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
      lotacao,
      situacao,
      perfil_acesso,
      avatar_url,
      bloqueado,
      ultimo_acesso,
      criado_em,
      atualizado_em
  `,
    [telefone1, telefone2, email1, email2, endereco, lotacao, id]
  );

  return rows[0] || null;
}

/**
 * Atualização completa de um filiado (usada por ADMIN / DIRETORIA / FUNCIONARIO).
 * Aqui já deve chegar algo filtrado pela controller quanto aos campos permitidos.
 */
async function atualizarFiliadoPorId(id, dados) {
  const campos = [];
  const valores = [];
  let idx = 1;

  function addCampo(campoSql, valor) {
    campos.push(`${campoSql} = $${idx}`);
    valores.push(valor);
    idx++;
  }

  if (dados.nome !== undefined) addCampo("nome", dados.nome);
  if (dados.cpf !== undefined) addCampo("cpf", normalizarCpf(dados.cpf));
  if (dados.data_nascimento !== undefined)
    addCampo("data_nascimento", dados.data_nascimento);
  if (dados.telefone1 !== undefined) addCampo("telefone1", dados.telefone1);
  if (dados.telefone2 !== undefined) addCampo("telefone2", dados.telefone2);
  if (dados.email1 !== undefined) addCampo("email1", dados.email1);
  if (dados.email2 !== undefined) addCampo("email2", dados.email2);
  if (dados.endereco !== undefined) addCampo("endereco", dados.endereco);
  if (dados.lotacao !== undefined) addCampo("lotacao", dados.lotacao);
  if (dados.situacao !== undefined) addCampo("situacao", dados.situacao);
  if (dados.perfil_acesso !== undefined)
    addCampo("perfil_acesso", dados.perfil_acesso);

  if (!campos.length) {
    return await buscarPorId(id);
  }

  // campo de auditoria
  campos.push(`atualizado_em = NOW()`);

  valores.push(id);
  const sql = `
    UPDATE filiados
    SET ${campos.join(", ")}
    WHERE id = $${idx}
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
      lotacao,
      situacao,
      perfil_acesso,
      avatar_url,
      bloqueado,
      ultimo_acesso,
      criado_em,
      atualizado_em
  `;

  const { rows } = await pool.query(sql, valores);
  return rows[0] || null;
}

/**
 * Lista filiados de acordo com o perfil de acesso.
 *  - ADMIN/DIRETORIA/FUNCIONARIO: vê tudo
 *  - FILIADO: vê apenas nome + telefone1 dos demais
 */
async function listarParaPerfil(perfilAcesso, termoBusca = "") {
  const filtro = termoBusca.trim();
  let whereClause = "";
  const params = [];

  if (filtro) {
    params.push(`%${filtro.toLowerCase()}%`);
    params.push(`%${filtro.toLowerCase()}%`);
    whereClause = `
      WHERE LOWER(nome) LIKE $1
         OR REPLACE(cpf, '.', '') LIKE REPLACE($2, '.', '')
    `;
  }

  // Quem pode ver tudo
  if (["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAcesso)) {
    const { rows } = await pool.query(
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
        lotacao,
        situacao,
        perfil_acesso
      FROM filiados
      ${whereClause}
      ORDER BY nome ASC
    `,
      params
    );

    return rows;
  }

  // FILIADO: visão reduzida
  const { rows } = await pool.query(
    `
    SELECT
      id,
      nome,
      telefone1
    FROM filiados
    ${whereClause}
    ORDER BY nome ASC
  `,
    params
  );

  return rows;
}

/**
 * Cria um novo filiado a partir do painel (ADMIN/DIRETORIA/FUNCIONARIO).
 * Se não for ADMIN, força perfil_acesso = 'FILIADO'.
 */
async function criarFiliadoInicial(dados, perfilCriador) {
  const perfilUpper = (perfilCriador || "").toUpperCase();

  let perfilNovo = (dados.perfil_acesso || "FILIADO").toUpperCase();
  if (!["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilUpper)) {
    throw new Error("Perfil não autorizado para criar filiados.");
  }

  if (perfilUpper !== "ADMIN") {
    // Diretoria/funcionário só podem criar FILIADO
    perfilNovo = "FILIADO";
  } else {
    if (!["FILIADO", "FUNCIONARIO", "DIRETORIA", "ADMIN"].includes(perfilNovo)) {
      perfilNovo = "FILIADO";
    }
  }

  const cpfNormalizado = normalizarCpf(dados.cpf);

  // Verifica se já existe CPF
  const { rows: jaExiste } = await pool.query(
    "SELECT id FROM filiados WHERE cpf = $1 LIMIT 1",
    [cpfNormalizado]
  );
  if (jaExiste.length) {
    const err = new Error("Já existe um filiado com este CPF.");
    err.code = "CPF_DUPLICADO";
    throw err;
  }

  const {
    nome,
    data_nascimento = null,
    telefone1 = null,
    telefone2 = null,
    email1 = null,
    email2 = null,
    endereco = null,
    lotacao = "SEDE",
  } = dados;

  const { rows } = await pool.query(
    `
    INSERT INTO filiados
      (nome, cpf, data_nascimento,
       telefone1, telefone2,
       email1, email2,
       endereco, lotacao,
       situacao,
       perfil_acesso,
       criado_em, atualizado_em,
       bloqueado)
    VALUES
      ($1, $2, $3,
       $4, $5,
       $6, $7,
       $8, $9,
       $10,
       $11,
       NOW(), NOW(),
       false)
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
      lotacao,
      situacao,
      perfil_acesso,
      avatar_url,
      bloqueado,
      ultimo_acesso,
      criado_em,
      atualizado_em
  `,
    [
      nome,
      cpfNormalizado,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      endereco,
      lotacao,
      dados.situacao || "ATIVO",
      perfilNovo,
    ]
  );

  return rows[0];
}

module.exports = {
  buscarPorCpf,
  buscarPorId,
  registrarUltimoAcesso,
  atualizarDadosProprios,
  atualizarFiliadoPorId,
  listarParaPerfil,
  criarFiliadoInicial,
};
