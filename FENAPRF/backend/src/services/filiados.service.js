// src/services/filiados.service.js
const pool = require("../config/db");
const log = require("../utils/log");
const { normalizarCpf, normalizarCep } = require("../utils/format");
const { anexarEstadoCadastro, anexarEstadoCadastroLista } = require("../utils/cadastro");
const {
  normalizeSituacaoFuncional,
  normalizeSexo,
  normalizePerfil,
  normalizeLotacao,
  normalizeNome
} = require("../../shared/canon");

// Colunas completas (mapeadas para compatibilidade com o app)
const FILIADO_COLUMNS = `
  id, name, name as nome, cpf, sexo, data_nascimento, telefone1, telefone2, email, email as email1,
  logradouro, bairro, numero, complemento, cidade, uf, cep,
  lotacao, situacao, password_hash, password_hash as senha_hash, twofa_secret, perfil_acesso,
  avatar_url, bloqueado, ultimo_acesso, created_at, created_at as criado_em, updated_at, updated_at as atualizado_em,
  arquivado_em, arquivado_motivo,
  cargo, cargo2, uf2, perfil_acesso2
`;

const FILIADO_COLUMNS_WITH_ALIAS = FILIADO_COLUMNS.split(",")
  .map((c) => `f.${c.trim()}`)
  .join(", ");

/**
 * Busca usuário pelo CPF (normalizado).
 */
async function buscarPorCpf(cpfRaw) {
  const cpf = normalizarCpf(cpfRaw);
  const { rows } = await pool.query(
    `
    SELECT
      ${FILIADO_COLUMNS_WITH_ALIAS}
    FROM users f
    WHERE f.cpf = $1
    LIMIT 1
    `,
    [cpf]
  );
  return anexarEstadoCadastro(rows[0]) || null;
}

/**
 * Busca usuário pelo ID (UUID).
 */
async function buscarPorId(id) {
  const { rows } = await pool.query(
    `
    SELECT
      ${FILIADO_COLUMNS_WITH_ALIAS}
    FROM users f
    WHERE f.id = $1
    LIMIT 1
    `,
    [id]
  );
  return anexarEstadoCadastro(rows[0]) || null;
}

/**
 * Atualiza o campo ultimo_acesso do usuário.
 */
async function registrarUltimoAcesso(id) {
  await pool.query(`UPDATE users SET ultimo_acesso = NOW() WHERE id = $1`, [id]);
}

/**
 * Atualiza dados básicos do próprio usuário ("Meus dados").
 */
async function atualizarDadosProprios(id, dados) {
  if (dados.nome) {
    dados.name = normalizeNome(dados.nome);
  }

  const campos = [];
  const valores = [];
  let idx = 1;

  const addCampo = (campoSql, valor, raw = false) => {
    if (valor !== undefined) {
      if (raw) {
        campos.push(`${campoSql} = ${valor}`);
      } else {
        campos.push(`${campoSql} = $${idx}`);
        valores.push(valor);
        idx += 1;
      }
    }
  };

  addCampo("sexo", normalizeSexo(dados.sexo));
  addCampo("telefone1", dados.telefone1);
  addCampo("telefone2", dados.telefone2);
  addCampo("email", dados.email1 || dados.email);

  if (dados.lotacao !== undefined) {
    addCampo("lotacao", normalizeLotacao(dados.lotacao));
  }

  // No FENAPRF logradouro_bairro pode vir do app, mas salvamos separado se possível
  // ou apenas logradouro. Como o app manda logradouro_bairro (SINPRF-ES), vamos mapear.
  if (dados.logradouro_bairro) {
      addCampo("logradouro", dados.logradouro_bairro);
  } else {
      addCampo("logradouro", dados.logradouro);
      addCampo("bairro", dados.bairro);
  }

  addCampo("numero", dados.numero);
  addCampo("complemento", dados.complemento);
  addCampo("cidade", dados.cidade);
  addCampo("uf", dados.uf);

  if (dados.cep !== undefined) {
    addCampo("cep", normalizarCep(dados.cep));
  }

  addCampo("avatar_url", dados.avatar_url);
  addCampo("updated_at", "NOW()", true);

  if (campos.length === 1) return buscarPorId(id);

  valores.push(id);
  await pool.query(`UPDATE users SET ${campos.join(", ")} WHERE id = $${idx}`, valores);

  return await buscarPorId(id);
}

/**
 * Atualização completa de um usuário (usada por perfis de gestão).
 */
async function atualizarFiliadoPorId(id, dados) {
  if (dados.nome) {
    dados.name = normalizeNome(dados.nome);
  }

  const campos = [];
  const valores = [];
  let idx = 1;

  function addCampo(campoSql, valor, raw = false) {
    if (valor !== undefined) {
      if (raw) campos.push(`${campoSql} = ${valor}`);
      else {
        campos.push(`${campoSql} = $${idx}`);
        valores.push(valor);
        idx += 1;
      }
    }
  }

  addCampo("name", dados.name);
  if (dados.sexo !== undefined) addCampo("sexo", normalizeSexo(dados.sexo));
  addCampo("cpf", dados.cpf);

  if (dados.data_nascimento !== undefined) {
    campos.push(`data_nascimento = NULLIF($${idx}, '')::date`);
    valores.push(dados.data_nascimento);
    idx += 1;
  }

  addCampo("telefone1", dados.telefone1);
  addCampo("telefone2", dados.telefone2);
  addCampo("email", dados.email1 || dados.email);

  if (dados.lotacao !== undefined) addCampo("lotacao", normalizeLotacao(dados.lotacao));
  if (dados.situacao !== undefined) addCampo("situacao", normalizeSituacaoFuncional(dados.situacao));
  if (dados.perfil_acesso !== undefined) addCampo("perfil_acesso", normalizePerfil(dados.perfil_acesso));

  if (dados.logradouro_bairro) {
      addCampo("logradouro", dados.logradouro_bairro);
  } else {
      addCampo("logradouro", dados.logradouro);
      addCampo("bairro", dados.bairro);
  }

  addCampo("numero", dados.numero);
  addCampo("complemento", dados.complemento);
  addCampo("cidade", dados.cidade);
  addCampo("uf", dados.uf);

  if (dados.cep !== undefined) addCampo("cep", normalizarCep(dados.cep));

  addCampo("avatar_url", dados.avatar_url);
  addCampo("updated_at", "NOW()", true);

  if (campos.length === 1) return await buscarPorId(id);

  valores.push(id);
  await pool.query(`UPDATE users SET ${campos.join(", ")} WHERE id = $${idx}`, valores);

  return await buscarPorId(id);
}

/**
 * Listagem para perfil (com busca e opção de incluir arquivados).
 */
async function listarParaPerfil(perfilAcesso, termoBusca = "", incluirArquivados = false) {
  const perfil = (perfilAcesso || "CONSELHEIRO").toUpperCase();
  const filtro = (termoBusca || "").trim();

  const params = [];
  const conds = [];

  const perfisGestao = ["ADMIN", "DIRETORIA", "COLABORADOR"];
  const isGestao = perfisGestao.includes(perfil);

  if (!isGestao || !incluirArquivados) {
    conds.push("f.arquivado_em IS NULL");
  }

  if (filtro) {
    const termoLimpo = filtro.toLowerCase();
    const apenasDigitos = filtro.replace(/\D/g, "");
    const searchConds = [];

    if (termoLimpo) {
      params.push(`%${termoLimpo}%`);
      searchConds.push(`LOWER(f.name) LIKE $${params.length}`);
    }

    if (apenasDigitos) {
      params.push(`%${apenasDigitos}%`);
      searchConds.push(`f.cpf LIKE $${params.length}`);
    }

    if (searchConds.length > 0) {
      conds.push(`(${searchConds.join(" OR ")})`);
    }
  }

  const whereSql = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  const query = `
    SELECT
      f.id, f.name as nome, f.cpf, f.sexo, f.data_nascimento, f.telefone1, f.telefone2, f.email as email1,
      f.lotacao, f.situacao, f.perfil_acesso,
      f.logradouro, f.bairro, f.numero, f.complemento, f.cidade, f.uf, f.cep,
      f.avatar_url,
      f.arquivado_em, f.arquivado_motivo
    FROM users f
    ${whereSql}
    ORDER BY f.name ASC
  `;

  const { rows } = await pool.query(query, params);
  return anexarEstadoCadastroLista(rows);
}

/**
 * Criação inicial de usuário.
 */
async function criarFiliadoInicial(dados) {
  const cpfNormalizado = normalizarCpf(dados.cpf);

  try {
    const perfilNovo = (dados.perfil_acesso || "CONSELHEIRO").toUpperCase();

    const {
      nome,
      data_nascimento = null,
      telefone1 = null,
      telefone2 = null,
      email1 = null,
      email = null,
      lotacao = "SEDE",
      situacao = "ATIVO",
    } = dados;

    const emailFinal = email1 || email || null;

    const { rows } = await pool.query(
      `
      INSERT INTO users (
        name, cpf, sexo, data_nascimento, telefone1, telefone2, email,
        lotacao, situacao, perfil_acesso, created_at, updated_at, bloqueado
      ) VALUES (
        $1, $2, $3, NULLIF($4, '')::date, $5, $6, $7,
        $8, $9, $10, NOW(), NOW(), false
      ) RETURNING id
      `,
      [
        normalizeNome(nome),
        cpfNormalizado,
        normalizeSexo(dados.sexo),
        data_nascimento,
        telefone1,
        telefone2,
        emailFinal,
        normalizeLotacao(lotacao),
        normalizeSituacaoFuncional(situacao),
        normalizePerfil(perfilNovo)
      ]
    );

    return await buscarPorId(rows[0].id);
  } catch (err) {
    if (err && err.code === "23505") err.code = "CPF_DUPLICADO";
    throw err;
  }
}

/**
 * Arquivar
 */
async function arquivarFiliadoPorId(id, { motivo }) {
  await pool.query(
    `UPDATE users SET arquivado_em = NOW(), arquivado_motivo = $1, updated_at = NOW() WHERE id = $2`,
    [motivo, id]
  );
  return await buscarPorId(id);
}

/**
 * Desarquivar
 */
async function desarquivarFiliadoPorId(id) {
  await pool.query(
    `UPDATE users SET arquivado_em = NULL, arquivado_motivo = NULL, updated_at = NOW() WHERE id = $1`,
    [id]
  );
  return await buscarPorId(id);
}

async function buscarAniversariantesDoDia() {
  const query = `
    SELECT
      id, name as nome, situacao, perfil_acesso, 'FILIADO' as tipo,
      NULL as nome_filiado_vinculo, NULL as situacao_filiado_vinculo,
      data_nascimento
    FROM users
    WHERE
      data_nascimento IS NOT NULL AND
      EXTRACT(DAY FROM data_nascimento) = EXTRACT(DAY FROM CURRENT_DATE) AND
      EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE) AND
      arquivado_em IS NULL
    ORDER BY nome ASC
  `;
  const { rows } = await pool.query(query);
  return rows;
}

async function salvarTwoFaSecret(userId, secret) {
  await pool.query(
    `UPDATE users SET twofa_secret = $1, updated_at = NOW() WHERE id = $2`,
    [secret, userId]
  );
  return await buscarPorId(userId);
}

module.exports = {
  buscarPorCpf,
  buscarPorId,
  registrarUltimoAcesso,
  atualizarDadosProprios,
  atualizarFiliadoPorId,
  listarParaPerfil,
  criarFiliadoInicial,
  salvarTwoFaSecret,
  arquivarFiliadoPorId,
  desarquivarFiliadoPorId,
  buscarAniversariantesDoDia,
};
