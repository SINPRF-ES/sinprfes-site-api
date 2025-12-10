// src/services/filiados.service.js
const pool = require("../config/db");
const { normalizarCpf } = require("../utils/format");

// Variável para listar todas as colunas necessárias nos SELECTs
const FILIADO_COLUMNS = `
  id, nome, cpf, data_nascimento, telefone1, telefone2, email1, email2,
  logradouro_bairro, numero, complemento, cidade, uf, cep,
  lotacao, situacao, senha_hash, twofa_secret, perfil_acesso, avatar_url, bloqueado, ultimo_acesso, criado_em, atualizado_em
`;

/**
 * Busca filiado pelo CPF (já normalizando).
 */
async function buscarPorCpf(cpfRaw) {
  const cpf = normalizarCpf(cpfRaw);
  const { rows } = await pool.query(
    `SELECT ${FILIADO_COLUMNS} FROM filiados WHERE cpf = $1 LIMIT 1`,
    [cpf]
  );
  return rows[0] || null;
}

/**
 * Busca filiado pelo ID.
 */
async function buscarPorId(id) {
  const { rows } = await pool.query(
    `SELECT ${FILIADO_COLUMNS} FROM filiados WHERE id = $1 LIMIT 1`,
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
 * Campos permitidos: telefone1, telefone2, email1, email2,
 * logradouro_bairro, numero, complemento, cidade, uf, cep, lotacao.
 */
// src/services/filiados.service.js (Trecho da função atualizarDadosProprios)
// ...

async function atualizarDadosProprios(id, dados) {
  const {
    telefone1 = null,
    telefone2 = null,
    email1 = null,
    email2 = null,
    lotacao = null,
    // NOVOS CAMPOS (Ordem de $6 a $11):
    logradouro_bairro = null,
    numero = null,
    complemento = null,
    cidade = null,
    uf = null,
    cep = null,
  } = dados;

  const { rows } = await pool.query(
    `
    UPDATE filiados
    SET
      telefone1 = $1,
      telefone2 = $2,
      email1 = $3,
      email2 = $4,
      lotacao = $5,
      logradouro_bairro = $6,
      numero = $7,
      complemento = $8,
      cidade = $9,
      uf = $10,
      cep = $11,
      atualizado_em = NOW()
    WHERE id = $12
    RETURNING ${FILIADO_COLUMNS}
  `,
    [
      // PARÂMETROS ($1 a $11):
      telefone1,
      telefone2,
      email1,
      email2,
      lotacao,
      logradouro_bairro, // $6
      numero,            // $7
      complemento,       // $8
      cidade,            // $9
      uf,                // $10
      cep,               // $11
      id,                // $12 (WHERE)
    ]
  );
  return rows[0] || null;
}
// ...
/**
 * Atualização completa de um filiado (usada por ADMIN / DIRETORIA / FUNCIONARIO).
 */
async function atualizarFiliadoPorId(id, dados) {
  const campos = [];
  const valores = [];
  let idx = 1;

  function addCampo(campoSql, valor) {
    // Garante que campos vazios que não são string (ex: data_nascimento) não sejam adicionados
    if (valor !== undefined && valor !== null) {
      campos.push(`${campoSql} = $${idx}`);
      valores.push(valor);
      idx++;
    }
  }

  if (dados.nome !== undefined) addCampo("nome", dados.nome);
  if (dados.cpf !== undefined) addCampo("cpf", normalizarCpf(dados.cpf));
  if (dados.data_nascimento !== undefined)
    addCampo("data_nascimento", dados.data_nascimento);
  if (dados.telefone1 !== undefined) addCampo("telefone1", dados.telefone1);
  if (dados.telefone2 !== undefined) addCampo("telefone2", dados.telefone2);
  if (dados.email1 !== undefined) addCampo("email1", dados.email1);
  if (dados.email2 !== undefined) addCampo("email2", dados.email2);
  // NOVOS CAMPOS DO ENDEREÇO AQUI:
  if (dados.logradouro_bairro !== undefined)
    addCampo("logradouro_bairro", dados.logradouro_bairro);
  if (dados.numero !== undefined) addCampo("numero", dados.numero);
  if (dados.complemento !== undefined)
    addCampo("complemento", dados.complemento);
  if (dados.cidade !== undefined) addCampo("cidade", dados.cidade);
  if (dados.uf !== undefined) addCampo("uf", dados.uf);
  if (dados.cep !== undefined) addCampo("cep", dados.cep);

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
    RETURNING ${FILIADO_COLUMNS}
  `;

  const { rows } = await pool.query(sql, valores);
  return rows[0] || null;
}

/**
 * Lista filiados de acordo com o perfil de acesso.
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
        logradouro_bairro,
        numero,
        complemento,
        cidade,
        uf,
        cep,
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
 */
async function criarFiliadoInicial(dados, perfilCriador) {
  const perfilUpper = (perfilCriador || "").toUpperCase();

  let perfilNovo = (dados.perfil_acesso || "FILIADO").toUpperCase();
  if (!["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilUpper)) {
    throw new Error("Perfil não autorizado para criar filiados.");
  }

  if (perfilUpper !== "ADMIN") {
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
    // NOVOS CAMPOS DO ENDEREÇO AQUI:
    logradouro_bairro = null,
    numero = null,
    complemento = null,
    cidade = null,
    uf = null,
    cep = null,
    lotacao = "SEDE",
  } = dados;

  const { rows } = await pool.query(
    `
    INSERT INTO filiados
      (nome, cpf, data_nascimento,
       telefone1, telefone2,
       email1, email2,
       logradouro_bairro, numero, complemento, cidade, uf, cep,
       lotacao,
       situacao,
       perfil_acesso,
       criado_em, atualizado_em,
       bloqueado)
    VALUES
      ($1, $2, $3,
       $4, $5,
       $6, $7,
       $8, $9, $10, $11, $12, $13,
       $14,
       $15,
       $16,
       NOW(), NOW(),
       false)
    RETURNING ${FILIADO_COLUMNS}
  `,
    [
      nome,
      cpfNormalizado,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      // Valores das 6 novas colunas
      logradouro_bairro,
      numero,
      complemento,
      cidade,
      uf,
      cep,
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