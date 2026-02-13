const pool = require("../config/db");
const { somenteDigitos, normalizarCpf, normalizarCep, generateUuid } = require("../utils/format");
const { anexarEstadoCadastro, anexarEstadoCadastroLista } = require("../utils/cadastro");
const {
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
      f.id, f.cpf, f.name, f.name as nome, f.email, f.email as email1,
      f.perfil_acesso, f.situacao, f.bloqueado,
      f.telefone1, f.telefone2,
      f.cep, f.logradouro, f.numero, f.complemento, f.bairro, f.cidade, f.uf, f.uf_endereco, f.uf2,
      f.data_nascimento, f.cargo,
      f.avatar_url, f.avatar_public_id,
      f.created_at, f.updated_at, f.ultimo_acesso,
      f.arquivado_em, f.arquivado_motivo, f.arquivado_por,
      u_arq.name as arquivado_por_nome,
      f.desarquivado_em, f.desarquivado_motivo, f.desarquivado_por,
      u_des.name as desarquivado_por_nome,
      f.perfil_acesso2, f.cargo2,
      f.cargo_mandato_inicio, f.cargo_mandato_fim,
      f.sexo,
      f.password_hash as senha_hash
    FROM users f
    LEFT JOIN users u_arq ON f.arquivado_por = u_arq.id
    LEFT JOIN users u_des ON f.desarquivado_por = u_des.id
    WHERE f.id = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(query, [id]);
  const user = rows[0];
  if (!user) return null;

  // Compat Layer: Add empty vinculos for now
  user.vinculos = [];

  return anexarEstadoCadastro(user);
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
async function listarParaPerfil(perfilAcesso, termoBusca = "", incluirArquivados = false, apenasArquivados = false) {
  const perfil = (perfilAcesso || "CONSELHEIRO").toUpperCase();
  const filtro = (termoBusca || "").trim();

  const params = [];
  const conds = [];

  const perfisGestao = ["ADMIN", "DIRETORIA", "COLABORADOR"];
  const isGestao = perfisGestao.includes(perfil);

  if (isGestao && apenasArquivados) {
    conds.push("f.arquivado_em IS NOT NULL");
  } else if (!isGestao || !incluirArquivados) {
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
      f.logradouro, f.bairro, f.numero, f.complemento, f.cidade, f.uf, f.uf_endereco, f.uf2, f.cep,
      f.avatar_url,
      f.arquivado_em, f.arquivado_motivo, f.arquivado_por,
      u_arq.name as arquivado_por_nome,
      f.desarquivado_em, f.desarquivado_motivo, f.desarquivado_por,
      u_des.name as desarquivado_por_nome,
      f.cargo, f.cargo_mandato_inicio, f.cargo_mandato_fim,
      f.perfil_acesso2, f.cargo2
    FROM users f
    LEFT JOIN users u_arq ON f.arquivado_por = u_arq.id
    LEFT JOIN users u_des ON f.desarquivado_por = u_des.id
    ${whereSql}
    ORDER BY f.name ASC
  `;

  const { rows } = await pool.query(query, params);

  // Compat Layer: Add empty vinculos to list
  const list = rows.map(r => ({ ...r, vinculos: [] }));

  return anexarEstadoCadastroLista(list);
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

  if (dados.sexo !== undefined) addCampo("sexo", normalizeSexo(dados.sexo));
  if (dados.telefone1 !== undefined) addCampo("telefone1", somenteDigitos(dados.telefone1));
  if (dados.telefone2 !== undefined) addCampo("telefone2", somenteDigitos(dados.telefone2));
  if (dados.email !== undefined || dados.email1 !== undefined) addCampo("email", dados.email1 || dados.email);

  // FENAPRF: Persistence of address fields
  if (dados.logradouro !== undefined) addCampo("logradouro", dados.logradouro);
  if (dados.bairro !== undefined) addCampo("bairro", dados.bairro);
  if (dados.numero !== undefined) addCampo("numero", dados.numero);
  if (dados.complemento !== undefined) addCampo("complemento", dados.complemento);
  if (dados.cidade !== undefined) addCampo("cidade", dados.cidade);
  if (dados.uf_endereco !== undefined) addCampo("uf_endereco", dados.uf_endereco);

  if (dados.cep !== undefined) {
    addCampo("cep", normalizarCep(dados.cep));
  }

  if (dados.avatar_url !== undefined) addCampo("avatar_url", dados.avatar_url);
  addCampo("updated_at", "NOW()", true);

  if (campos.length === 1) return getMe(id);

  valores.push(id);
  const result = await pool.query(`UPDATE users SET ${campos.join(", ")} WHERE id = $${idx}`, valores);
  if (result.rowCount === 0) {
      const log = require("../utils/log");
      log.warn("UserUpdatePropriosNoEffect", { userId: id });
  }

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

  if (dados.name !== undefined) addCampo("name", dados.name);
  if (dados.sexo !== undefined) addCampo("sexo", normalizeSexo(dados.sexo));
  if (dados.cpf !== undefined) addCampo("cpf", somenteDigitos(dados.cpf));

  if (dados.data_nascimento !== undefined) {
    campos.push(`data_nascimento = NULLIF($${idx}, '')::date`);
    valores.push(dados.data_nascimento);
    idx += 1;
  }

  if (dados.telefone1 !== undefined) addCampo("telefone1", somenteDigitos(dados.telefone1));
  if (dados.telefone2 !== undefined) addCampo("telefone2", somenteDigitos(dados.telefone2));
  if (dados.email !== undefined || dados.email1 !== undefined) addCampo("email", dados.email1 || dados.email);

  if (dados.perfil_acesso !== undefined) addCampo("perfil_acesso", normalizePerfil(dados.perfil_acesso));

  // FENAPRF: Persistence of address fields
  if (dados.logradouro !== undefined) addCampo("logradouro", dados.logradouro);
  if (dados.bairro !== undefined) addCampo("bairro", dados.bairro);
  if (dados.numero !== undefined) addCampo("numero", dados.numero);
  if (dados.complemento !== undefined) addCampo("complemento", dados.complemento);
  if (dados.cidade !== undefined) addCampo("cidade", dados.cidade);
  if (dados.uf_endereco !== undefined) addCampo("uf_endereco", dados.uf_endereco);

  if (dados.cep !== undefined) {
    addCampo("cep", normalizarCep(dados.cep));
  }

  if (dados.avatar_url !== undefined) addCampo("avatar_url", dados.avatar_url);
  if (dados.avatar_public_id !== undefined) addCampo("avatar_public_id", dados.avatar_public_id);

  if (dados.perfil_acesso2 !== undefined) addCampo("perfil_acesso2", dados.perfil_acesso2);
  if (dados.cargo2 !== undefined) addCampo("cargo2", dados.cargo2);
  if (dados.uf2 !== undefined) addCampo("uf2", dados.uf2);
  if (dados.cargo !== undefined) addCampo("cargo", dados.cargo);
  if (dados.uf !== undefined) addCampo("uf", dados.uf);

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
  const result = await pool.query(`UPDATE users SET ${campos.join(", ")} WHERE id = $${idx}`, valores);
  if (result.rowCount === 0) {
      const log = require("../utils/log");
      log.warn("UserUpdatePorIdNoEffect", { targetId: id });
  }

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
    } = dados;

    const emailFinal = email1 || email || null;
    const newId = generateUuid();

    const { rows } = await pool.query(
      `
      INSERT INTO users (
        id, name, cpf, sexo, data_nascimento, telefone1, telefone2, email,
        perfil_acesso, cargo, uf, uf_endereco,
        perfil_acesso2, cargo2, uf2,
        created_at, updated_at, bloqueado
      ) VALUES (
        $1, $2, $3, $4, NULLIF($5, '')::date, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, NOW(), NOW(), false
      ) RETURNING id
      `,
      [
        newId,
        normalizeNome(nome),
        cpfNormalizado,
        normalizeSexo(dados.sexo),
        data_nascimento,
        somenteDigitos(telefone1),
        somenteDigitos(telefone2),
        emailFinal,
        normalizePerfil(perfilNovo),
        dados.cargo || null,
        dados.uf || null,
        dados.uf_endereco || null,
        dados.perfil_acesso2 || null,
        dados.cargo2 || null,
        dados.uf2 || null
      ]
    );

    return await getMe(newId);
  } catch (err) {
    if (err && err.code === "23505") err.code = "CPF_DUPLICADO";
    throw err;
  }
}

/**
 * Arquivar
 */
async function arquivarUserPorId(id, { motivo, atorId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users
       SET arquivado_em = NOW(),
           arquivado_motivo = $1,
           arquivado_por = $2,
           perfil_acesso = NULL,
           cargo = NULL,
           uf = NULL,
           cargo_mandato_inicio = NULL,
           cargo_mandato_fim = NULL,
           perfil_acesso2 = NULL,
           cargo2 = NULL,
           uf2 = NULL,
           updated_at = NOW()
       WHERE id = $3`,
      [motivo, atorId, id]
    );

    await client.query(
      `INSERT INTO user_movimentacoes (user_id, acao, por_id, motivo)
       VALUES ($1, 'ARQUIVADO', $2, $3)`,
      [id, atorId, motivo]
    );

    await client.query("COMMIT");
    return await getMe(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Desarquivar
 */
async function desarquivarUserPorId(id, { motivo, atorId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users
       SET arquivado_em = NULL,
           arquivado_motivo = NULL,
           arquivado_por = NULL,
           desarquivado_em = NOW(),
           desarquivado_motivo = $1,
           desarquivado_por = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [motivo, atorId, id]
    );

    await client.query(
      `INSERT INTO user_movimentacoes (user_id, acao, por_id, motivo)
       VALUES ($1, 'DESARQUIVADO', $2, $3)`,
      [id, atorId, motivo]
    );

    await client.query("COMMIT");
    return await getMe(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Lista histórico de movimentações (arquivamento/desarquivamento)
 */
async function listarHistoricoMovimentacoes(userId = null, termoBusca = "") {
  let query = `
    SELECT
      m.*,
      u_target.name as user_nome,
      u_target.cpf as user_cpf,
      u_por.name as por_nome
    FROM user_movimentacoes m
    JOIN users u_target ON m.user_id = u_target.id
    JOIN users u_por ON m.por_id = u_por.id
  `;
  const conds = [];
  const params = [];

  if (userId) {
    conds.push(`m.user_id = $${params.length + 1}`);
    params.push(userId);
  }

  if (termoBusca) {
    const termo = `%${termoBusca.toLowerCase()}%`;
    const apenasDigitos = `%${termoBusca.replace(/\D/g, "")}%`;
    conds.push(`(LOWER(u_target.name) LIKE $${params.length + 1} OR u_target.cpf LIKE $${params.length + 2})`);
    params.push(termo, apenasDigitos);
  }

  if (conds.length > 0) {
    query += " WHERE " + conds.join(" AND ");
  }

  query += " ORDER BY m.criado_em DESC";

  const { rows } = await pool.query(query, params);
  return rows;
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
  listarHistoricoMovimentacoes,
  buscarAniversariantesDoDia,
};
