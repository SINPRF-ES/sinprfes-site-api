const pool = require("../config/db");
const { normalizarCpf, normalizarCep } = require("../utils/format");
const { anexarEstadoCadastro, anexarEstadoCadastroLista } = require("../utils/cadastro");
const {
  normalizeSituacaoFuncional,
  normalizeSexo,
  normalizePerfil,
  normalizeNome
} = require("../../shared/canon");

/**
 * Busca membro pelo CPF (normalizado).
 */
async function buscarUserPorCpf(cpfRaw) {
  const cpf = normalizarCpf(cpfRaw);
  const { rows } = await pool.query(
    "SELECT *, name as nome, password_hash as senha_hash FROM users WHERE cpf = $1 LIMIT 1",
    [cpf]
  );
  return anexarEstadoCadastro(rows[0]) || null;
}

/**
 * Busca membro pelo ID (UUID).
 */
async function buscarUserPorId(id) {
  const { rows } = await pool.query(
    "SELECT *, name as nome, password_hash as senha_hash FROM users WHERE id = $1 LIMIT 1",
    [id]
  );
  return anexarEstadoCadastro(rows[0]) || null;
}

/**
 * Retorna dados detalhados para o endpoint /me ou perfil.
 * Usa colunas específicas da tabela users e aliases para o app.
 */
async function getMe(id) {
  const query = `
    SELECT
      id, cpf, name, name as nome, email, email as email1,
      perfil_acesso, situacao, bloqueado,
      telefone1, telefone2,
      cep, logradouro, numero, complemento, bairro, cidade, uf,
      data_nascimento, cargo,
      avatar_url, avatar_public_id,
      uf_endereco,
      created_at, updated_at, ultimo_acesso,
      arquivado_em, arquivado_motivo, arquivado_por,
      desarquivado_em, desarquivado_motivo, desarquivado_por,
      perfil_acesso2, cargo2, uf2,
      cargo_mandato_inicio, cargo_mandato_fim,
      sexo,
      password_hash as senha_hash
    FROM users
    WHERE id = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [id]);
  return anexarEstadoCadastro(rows[0]) || null;
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
      f.id, f.name, f.name as nome, f.cpf, f.sexo, f.data_nascimento, f.telefone1, f.telefone2, f.email as email1,
      NULL as email2,
      f.situacao, f.perfil_acesso,
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
 * Atualiza dados básicos do próprio membro ("Meus dados").
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

  if (campos.length === 1) return getMe(id);

  valores.push(id);
  await pool.query(`UPDATE users SET ${campos.join(", ")} WHERE id = $${idx}`, valores);

  return await getMe(id);
}

/**
 * Atualização completa de um membro (usada por perfis de gestão).
 */
async function atualizarUserPorId(id, dados) {
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

  if (dados.cep !== undefined) {
    addCampo("cep", normalizarCep(dados.cep));
  }

  addCampo("avatar_url", dados.avatar_url);
  addCampo("avatar_public_id", dados.avatar_public_id);

  addCampo("perfil_acesso2", dados.perfil_acesso2);
  addCampo("cargo2", dados.cargo2);
  addCampo("uf2", dados.uf2);
  addCampo("cargo", dados.cargo);
  addCampo("uf", dados.uf);

  if (dados.cargo_mandato_inicio !== undefined) {
    campos.push(`cargo_mandato_inicio = NULLIF($${idx}, '')::date`);
    valores.push(dados.cargo_mandato_inicio);
    idx += 1;
  }
  if (dados.cargo_mandato_fim !== undefined) {
    campos.push(`cargo_mandato_fim = NULLIF($${idx}, '')::date`);
    valores.push(dados.cargo_mandato_fim);
    idx += 1;
  }

  addCampo("updated_at", "NOW()", true);

  if (campos.length === 1) return await getMe(id);

  valores.push(id);
  await pool.query(`UPDATE users SET ${campos.join(", ")} WHERE id = $${idx}`, valores);

  return await getMe(id);
}

/**
 * Criação inicial de membro.
 */
async function criarUserInicial(dados) {
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
      situacao = "ATIVO",
    } = dados;

    const emailFinal = email1 || email || null;

    const { rows } = await pool.query(
      `
      INSERT INTO users (
        name, cpf, sexo, data_nascimento, telefone1, telefone2, email,
        situacao, perfil_acesso, cargo, uf,
        perfil_acesso2, cargo2, uf2,
        created_at, updated_at, bloqueado
      ) VALUES (
        $1, $2, $3, NULLIF($4, '')::date, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, NOW(), NOW(), false
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
        normalizeSituacaoFuncional(situacao),
        normalizePerfil(perfilNovo),
        dados.cargo || null,
        dados.uf || null,
        dados.perfil_acesso2 || null,
        dados.cargo2 || null,
        dados.uf2 || null
      ]
    );

    return await getMe(rows[0].id);
  } catch (err) {
    if (err && err.code === "23505") err.code = "CPF_DUPLICADO";
    throw err;
  }
}

/**
 * Arquivar
 */
async function arquivarUserPorId(id, { motivo }) {
  await pool.query(
    `UPDATE users SET arquivado_em = NOW(), arquivado_motivo = $1, updated_at = NOW() WHERE id = $2`,
    [motivo, id]
  );
  return await getMe(id);
}

/**
 * Desarquivar
 */
async function desarquivarUserPorId(id) {
  await pool.query(
    `UPDATE users SET arquivado_em = NULL, arquivado_motivo = NULL, updated_at = NOW() WHERE id = $1`,
    [id]
  );
  return await getMe(id);
}

async function buscarAniversariantesDoDia() {
  const query = `
    SELECT
      id, name as nome, situacao, perfil_acesso, 'MEMBRO' as tipo,
      NULL as nome_user_vinculo, NULL as situacao_user_vinculo,
      data_nascimento
    FROM users
    WHERE
      data_nascimento IS NOT NULL AND
      EXTRACT(DAY FROM data_nascimento) = EXTRACT(DAY FROM CURRENT_DATE) AND
      EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE) AND
      arquivado_em IS NULL
    ORDER BY name ASC
  `;
  const { rows } = await pool.query(query);
  return rows;
}

module.exports = {
  buscarUserPorCpf,
  buscarPorCpf: buscarUserPorCpf,
  buscarUserPorId,
  buscarPorId: buscarUserPorId,
  getMe,
  setResetToken,
  setPassword,
  registrarUltimoAcesso,
  listarParaPerfil,
  atualizarDadosProprios,
  atualizarUserPorId,
  criarUserInicial,
  arquivarUserPorId,
  desarquivarUserPorId,
  buscarAniversariantesDoDia,
};
