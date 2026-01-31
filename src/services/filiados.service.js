// src/services/filiados.service.js
const pool = require("../config/db");
const { normalizarCpf, normalizarCep } = require("../utils/format");
const { anexarEstadoCadastro, anexarEstadoCadastroLista } = require("../utils/cadastro");
const { normalizeParentesco } = require("../../shared/dependentes/parentesco");

/**
 * Garante que os dependentes sejam salvos de forma compacta (da esquerda para a direita).
 * Se dep1 e dep3 estiverem preenchidos, eles se tornam dep1 e dep2.
 */
function compactarDependentes(dados) {
  const dependentesCompactados = [];
  let houveAlgumCampoDependente = false;

  for (let i = 1; i <= 5; i++) {
    const nome = dados[`dep${i}_nome`];
    const cpf = dados[`dep${i}_cpf`];
    const data = dados[`dep${i}_data_nascimento`];
    const parentesco = dados[`dep${i}_parentesco`];

    if (nome !== undefined || cpf !== undefined || data !== undefined || parentesco !== undefined) {
      houveAlgumCampoDependente = true;
    }

    if (nome || cpf || data || parentesco) {
      dependentesCompactados.push({
        nome: nome || null,
        cpf: cpf || null,
        data_nascimento: data || null,
        parentesco: parentesco || null,
      });
    }

    // Remove os campos originais para evitar duplicidade ou resíduos
    delete dados[`dep${i}_nome`];
    delete dados[`dep${i}_cpf`];
    delete dados[`dep${i}_data_nascimento`];
    delete dados[`dep${i}_parentesco`];
  }

  // Se não recebemos nenhum campo de dependente, não alteramos nada (mantém como estava no banco)
  if (!houveAlgumCampoDependente) return dados;

  // Preenche os slots compactados
  for (let i = 0; i < 5; i++) {
    const dep = dependentesCompactados[i];
    dados[`dep${i + 1}_nome`] = dep ? dep.nome : null;
    dados[`dep${i + 1}_cpf`] = dep ? dep.cpf : null;
    dados[`dep${i + 1}_data_nascimento`] = dep ? dep.data_nascimento : null;
    dados[`dep${i + 1}_parentesco`] = dep ? dep.parentesco : null;
  }

  return dados;
}

// Colunas completas (retornadas nos UPDATE/INSERT/GET internos)
const FILIADO_COLUMNS = `
  id, nome, cpf, data_nascimento, telefone1, telefone2, email1, email2,
  logradouro_bairro, numero, complemento, cidade, uf, cep,
  lotacao, situacao, senha_hash, twofa_secret, perfil_acesso,
  avatar_url, bloqueado, ultimo_acesso, criado_em, atualizado_em,
  arquivado_em, arquivado_motivo, arquivado_por,
  dep1_nome, dep1_cpf, dep1_data_nascimento, dep1_parentesco,
  dep2_nome, dep2_cpf, dep2_data_nascimento, dep2_parentesco,
  dep3_nome, dep3_cpf, dep3_data_nascimento, dep3_parentesco,
  dep4_nome, dep4_cpf, dep4_data_nascimento, dep4_parentesco,
  dep5_nome, dep5_cpf, dep5_data_nascimento, dep5_parentesco
`;

const FILIADO_COLUMNS_WITH_ALIAS = FILIADO_COLUMNS.split(",")
  .map((c) => `f.${c.trim()}`)
  .join(", ");

/**
 * Busca filiado pelo CPF (normalizado).
 */
async function buscarPorCpf(cpfRaw) {
  const cpf = normalizarCpf(cpfRaw);
  const { rows } = await pool.query(
    `
    SELECT
      ${FILIADO_COLUMNS_WITH_ALIAS},
      responsavel.nome AS arquivado_por_nome
    FROM filiados f
    LEFT JOIN filiados responsavel ON f.arquivado_por = responsavel.id
    WHERE f.cpf = $1
    LIMIT 1
    `,
    [cpf]
  );
  return anexarEstadoCadastro(rows[0]) || null;
}

/**
 * Busca filiado pelo ID.
 */
async function buscarPorId(id) {
  const { rows } = await pool.query(
    `
    SELECT
      ${FILIADO_COLUMNS_WITH_ALIAS},
      responsavel.nome AS arquivado_por_nome
    FROM filiados f
    LEFT JOIN filiados responsavel ON f.arquivado_por = responsavel.id
    WHERE f.id = $1
    LIMIT 1
    `,
    [id]
  );
  return anexarEstadoCadastro(rows[0]) || null;
}

/**
 * Atualiza o campo ultimo_acesso do filiado.
 */
async function registrarUltimoAcesso(id) {
  await pool.query(`UPDATE filiados SET ultimo_acesso = NOW() WHERE id = $1`, [id]);
}

/**
 * Atualiza dados básicos do próprio filiado ("Meus dados").
 * Observação: avatar é tratado em rota dedicada (upload), mas também aceitamos avatar_url se necessário.
 */
async function atualizarDadosProprios(id, dados) {
  compactarDependentes(dados);
  const campos = [];
  const valores = [];
  let idx = 1;

  const addCampo = (campoSql, valor, raw = false) => {
    // Apenas adiciona à query se o valor não for undefined
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
  
  // Campos existentes
  addCampo("telefone1", dados.telefone1);
  addCampo("telefone2", dados.telefone2);
  addCampo("email1", dados.email1);
  addCampo("email2", dados.email2);
  addCampo("lotacao", dados.lotacao);
  addCampo("logradouro_bairro", dados.logradouro_bairro);
  addCampo("numero", dados.numero);
  addCampo("complemento", dados.complemento);
  addCampo("cidade", dados.cidade);
  addCampo("uf", dados.uf);

  if (dados.cep !== undefined) {
    const cepNorm = normalizarCep(dados.cep);
    if (cepNorm && cepNorm.length !== 8) {
      const err = new Error("CEP deve conter 8 dígitos.");
      err.isValidationError = true;
      throw err;
    }
    addCampo("cep", cepNorm);
  }

  addCampo("avatar_url", dados.avatar_url);

  // Campos dos dependentes
  for (let i = 1; i <= 5; i++) {
    addCampo(`dep${i}_nome`, dados[`dep${i}_nome`]);
    addCampo(`dep${i}_cpf`, dados[`dep${i}_cpf`]);

    if (dados[`dep${i}_data_nascimento`] !== undefined) {
      campos.push(`dep${i}_data_nascimento = NULLIF($${idx}, '')::date`);
      valores.push(dados[`dep${i}_data_nascimento`]);
      idx += 1;
    }

    if (dados[`dep${i}_parentesco`] !== undefined) {
      addCampo(`dep${i}_parentesco`, normalizeParentesco(dados[`dep${i}_parentesco`]));
    }
  }

  // Sempre atualiza o timestamp
  addCampo("atualizado_em", "NOW()", true);
  
  if (campos.length === 1) { // Só tem o atualizado_em
    return buscarPorId(id);
  }

  valores.push(id);

  await pool.query(
    `
    UPDATE filiados
    SET ${campos.join(", ")}
    WHERE id = $${idx}
  `,
    valores
  );

  return await buscarPorId(id);
}

/**
 * Atualização completa de um filiado (usada por perfis de gestão).
 * Atualiza apenas campos presentes (valor !== undefined).
 */
async function atualizarFiliadoPorId(id, dados) {
  compactarDependentes(dados);
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

  addCampo("nome", dados.nome);
  addCampo("cpf", dados.cpf);

  // ✅ PATCH: tipar explicitamente como date no SQL (evita "expression is of type text")
  if (dados.data_nascimento !== undefined) {
    // Converte '' -> NULL no lado do SQL e faz cast para DATE
    campos.push(`data_nascimento = NULLIF($${idx}, '')::date`);
    valores.push(dados.data_nascimento);
    idx += 1;
  }

  addCampo("telefone1", dados.telefone1);
  addCampo("telefone2", dados.telefone2);
  addCampo("email1", dados.email1);
  addCampo("email2", dados.email2);
  addCampo("lotacao", dados.lotacao);
  addCampo("situacao", dados.situacao);
  addCampo("perfil_acesso", dados.perfil_acesso);
  addCampo("logradouro_bairro", dados.logradouro_bairro);
  addCampo("numero", dados.numero);
  addCampo("complemento", dados.complemento);
  addCampo("cidade", dados.cidade);
  addCampo("uf", dados.uf);

  if (dados.cep !== undefined) {
    const cepNorm = normalizarCep(dados.cep);
    if (cepNorm && cepNorm.length !== 8) {
      const err = new Error("CEP deve conter 8 dígitos.");
      err.isValidationError = true;
      throw err;
    }
    addCampo("cep", cepNorm);
  }

  addCampo("avatar_url", dados.avatar_url);

  // Campos dos dependentes
  for (let i = 1; i <= 5; i++) {
    addCampo(`dep${i}_nome`, dados[`dep${i}_nome`]);
    addCampo(`dep${i}_cpf`, dados[`dep${i}_cpf`]);

    if (dados[`dep${i}_data_nascimento`] !== undefined) {
      campos.push(`dep${i}_data_nascimento = NULLIF($${idx}, '')::date`);
      valores.push(dados[`dep${i}_data_nascimento`]);
      idx += 1;
    }

    if (dados[`dep${i}_parentesco`] !== undefined) {
      addCampo(`dep${i}_parentesco`, normalizeParentesco(dados[`dep${i}_parentesco`]));
    }
  }

  // sempre atualiza timestamp
  addCampo("atualizado_em", "NOW()", true);

  if (campos.length === 0) return await buscarPorId(id);

  valores.push(id);

  await pool.query(
    `
    UPDATE filiados
    SET ${campos.join(", ")}
    WHERE id = $${idx}
  `,
    valores
  );

  return await buscarPorId(id);
}

/**
 * Listagem para perfil (com busca e opção de incluir arquivados).
 *
 * incluirArquivados:
 * - false: apenas ativos (arquivado_em IS NULL)
 * - true: ativos + arquivados
 */
async function listarParaPerfil(perfilAcesso, termoBusca = "", incluirArquivados = false) {
  const perfil = (perfilAcesso || "FILIADO").toUpperCase();
  const filtro = (termoBusca || "").trim();

  const params = [];
  const conds = [];

  const perfisGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"];
  const isGestao = perfisGestao.includes(perfil);

  // Apenas gestores podem incluir arquivados
  if (!isGestao || !incluirArquivados) {
    conds.push("f.arquivado_em IS NULL");
  }

  if (filtro) {
    // Busca por nome (case-insensitive) ou CPF (comparando apenas dígitos)
    params.push(`%${filtro.toLowerCase()}%`);
    params.push(`%${filtro.replace(/\D/g, "")}%`);
    const pNome = params.length - 1;
    const pCpf = params.length;

    conds.push(`
      (
        LOWER(f.nome) LIKE $${pNome}
        OR regexp_replace(f.cpf, '[^0-9]', '', 'g') LIKE $${pCpf}
      )
    `);
  }

  const whereSql = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  if (isGestao) {
    // gestão: devolve campos necessários para edição, incluindo dependentes
    const { rows } = await pool.query(
      `
      SELECT
        f.id, f.nome, f.cpf, f.data_nascimento, f.telefone1, f.telefone2, f.email1, f.email2,
        f.lotacao, f.situacao, f.perfil_acesso,
        f.logradouro_bairro, f.numero, f.complemento, f.cidade, f.uf, f.cep,
        f.avatar_url,
        f.arquivado_em, f.arquivado_motivo, f.arquivado_por,
        responsavel.nome AS arquivado_por_nome,
        f.dep1_nome, f.dep1_cpf, f.dep1_data_nascimento, f.dep1_parentesco,
        f.dep2_nome, f.dep2_cpf, f.dep2_data_nascimento, f.dep2_parentesco,
        f.dep3_nome, f.dep3_cpf, f.dep3_data_nascimento, f.dep3_parentesco,
        f.dep4_nome, f.dep4_cpf, f.dep4_data_nascimento, f.dep4_parentesco,
        f.dep5_nome, f.dep5_cpf, f.dep5_data_nascimento, f.dep5_parentesco
      FROM filiados f
      LEFT JOIN filiados responsavel ON f.arquivado_por = responsavel.id
      ${whereSql}
      ORDER BY f.nome ASC
    `,
      params
    );
    return anexarEstadoCadastroLista(rows);
  }

  // filiado: devolve só diretório (inclui avatar e lotação p/ visualização)
  const { rows } = await pool.query(
    `
    SELECT
      f.id, f.nome, f.telefone1, f.avatar_url, f.lotacao, f.situacao, f.arquivado_em
    FROM filiados f
    ${whereSql}
    ORDER BY f.nome ASC
  `,
    params
  );

  return anexarEstadoCadastroLista(rows);
}

/**
 * Criação inicial de filiado (ADMIN/DIRETORIA/FUNCIONARIO).
 * Observação: verificação proativa de CPF duplicado é feita no controller.
 */
async function criarFiliadoInicial(dados, perfilCriador) {
  compactarDependentes(dados);
  const cpfNormalizado = normalizarCpf(dados.cpf);

  // Fallback: se bater constraint única por race-condition
  // (o controller já tenta evitar)
  try {
    const perfilNovo = (dados.perfil_acesso || "FILIADO").toUpperCase();

    const {
      nome,
      data_nascimento = null,
      telefone1 = null,
      telefone2 = null,
      email1 = null,
      email2 = null,
      logradouro_bairro = null,
      numero = null,
      complemento = null,
      cidade = null,
      uf = null,
      cep = null,
      lotacao = "SEDE",
      situacao = "ATIVO",
    } = dados;

    const colunas = [];
    const placeholders = [];
    const params = [];
    let p = 1;

    function push(col, val, castSql = "") {
      colunas.push(col);
      params.push(val === undefined ? null : val);
      placeholders.push(`$${p}${castSql}`);
      p++;
    }

    push("nome", nome);
    push("cpf", cpfNormalizado);
    // Explicit date cast with NULLIF for empty strings
    colunas.push("data_nascimento");
    params.push(data_nascimento === undefined ? null : data_nascimento);
    placeholders.push(`NULLIF($${p}, '')::date`);
    p++;

    push("telefone1", telefone1);
    push("telefone2", telefone2);
    push("email1", email1);
    push("email2", email2);
    push("logradouro_bairro", logradouro_bairro);
    push("numero", numero);
    push("complemento", complemento);
    push("cidade", cidade);
    push("uf", uf);

    const cepNorm = normalizarCep(cep);
    if (cepNorm && cepNorm.length !== 8) {
      const err = new Error("CEP deve conter 8 dígitos.");
      err.isValidationError = true;
      throw err;
    }
    push("cep", cepNorm);

    push("lotacao", lotacao);
    push("situacao", situacao);
    push("perfil_acesso", perfilNovo);

    // NOW() directly in SQL, no parameter increment
    colunas.push("criado_em");
    placeholders.push("NOW()");
    colunas.push("atualizado_em");
    placeholders.push("NOW()");

    push("bloqueado", false);
    push("arquivado_em", null);
    push("arquivado_motivo", null);

    for (let i = 1; i <= 5; i++) {
      push(`dep${i}_nome`, dados[`dep${i}_nome`]);
      push(`dep${i}_cpf`, dados[`dep${i}_cpf`]);

      // Explicit date cast for dependents
      colunas.push(`dep${i}_data_nascimento`);
      params.push(dados[`dep${i}_data_nascimento`] === undefined ? null : dados[`dep${i}_data_nascimento`]);
      placeholders.push(`NULLIF($${p}, '')::date`);
      p++;

      push(`dep${i}_parentesco`, normalizeParentesco(dados[`dep${i}_parentesco`]));
    }

    const { rows } = await pool.query(
      `
      INSERT INTO filiados (${colunas.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING id
    `,
      params
    );

    return await buscarPorId(rows[0].id);
  } catch (err) {
    if (err && err.code === "23505") {
      err.code = "CPF_DUPLICADO";
    }
    throw err;
  }
}

/**
 * Auditoria (tabela própria): registra evento.
 * Se a tabela não existir, falha silenciosamente para não quebrar o fluxo principal.
 */
async function registrarEventoAuditoria({
  filiadoId,
  acao,
  motivo = null,
  atorId,
  atorPerfil,
  payloadAntes = null,
  payloadDepois = null,
}) {
  try {
    const query = `
      INSERT INTO filiados_eventos
        (filiado_id, acao, motivo, ator_id, ator_perfil, payload_antes, payload_depois, criado_em)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;
    const params = [
      filiadoId,
      acao,
      motivo,
      atorId,
      atorPerfil,
      payloadAntes ? JSON.stringify(payloadAntes) : null,
      payloadDepois ? JSON.stringify(payloadDepois) : null,
    ];

    await pool.query(query, params);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Auditoria não registrada (verifique migração filiados_eventos).", e?.message || e);
  }
}

/**
 * Arquivar
 */
async function arquivarFiliadoPorId(id, { atorId, atorPerfil, motivo }) {
  const antes = await buscarPorId(id);
  if (!antes) return null;

  await pool.query(
    `
    UPDATE filiados
    SET
      arquivado_em = NOW(),
      arquivado_motivo = $1,
      arquivado_por = $2,
      atualizado_em = NOW()
    WHERE id = $3
  `,
    [motivo, atorId, id]
  );

  const depois = await buscarPorId(id);

  await registrarEventoAuditoria({
    filiadoId: id,
    acao: "ARQUIVAR",
    motivo,
    atorId,
    atorPerfil,
    payloadAntes: antes,
    payloadDepois: depois,
  });

  return depois;
}

/**
 * Desarquivar
 */
async function desarquivarFiliadoPorId(id, { atorId, atorPerfil, motivo }) {
  const antes = await buscarPorId(id);
  if (!antes) return null;

  await pool.query(
    `
    UPDATE filiados
    SET
      arquivado_em = NULL,
      arquivado_motivo = NULL,
      arquivado_por = NULL,
      atualizado_em = NOW()
    WHERE id = $1
  `,
    [id]
  );

  const depois = await buscarPorId(id);

  await registrarEventoAuditoria({
    filiadoId: id,
    acao: "DESARQUIVAR",
    motivo: motivo || null,
    atorId,
    atorPerfil,
    payloadAntes: antes,
    payloadDepois: depois,
  });

  return depois;
}

async function salvarTwoFaSecret(userId, secret) {
  await pool.query(
    `
    UPDATE filiados
    SET twofa_secret = $1, atualizado_em = NOW()
    WHERE id = $2
  `,
    [secret, userId]
  );
  return await buscarPorId(userId);
}

/**
 * Busca aniversariantes do dia (filiados e dependentes)
 */
async function buscarAniversariantesDoDia() {
  const query = `
    SELECT * FROM (
      -- Filiados
      SELECT
        id, nome, situacao, perfil_acesso, 'FILIADO' as tipo,
        NULL as nome_filiado_vinculo, NULL as situacao_filiado_vinculo,
        data_nascimento
      FROM filiados
      WHERE
        data_nascimento IS NOT NULL AND
        EXTRACT(DAY FROM data_nascimento) = EXTRACT(DAY FROM CURRENT_DATE) AND
        EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE) AND
        arquivado_em IS NULL

      UNION ALL

      -- Dependentes (dep1 a dep5)
      ${[1, 2, 3, 4, 5]
        .map(
          (i) => `
      SELECT
        f.id, f.dep${i}_nome as nome, 'DEPENDENTE' as situacao, f.perfil_acesso, 'DEPENDENTE' as tipo,
        f.nome as nome_filiado_vinculo, f.situacao as situacao_filiado_vinculo,
        f.dep${i}_data_nascimento as data_nascimento
      FROM filiados f
      WHERE
        f.dep${i}_data_nascimento IS NOT NULL AND
        EXTRACT(DAY FROM f.dep${i}_data_nascimento) = EXTRACT(DAY FROM CURRENT_DATE) AND
        EXTRACT(MONTH FROM f.dep${i}_data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE) AND
        f.arquivado_em IS NULL
      `
        )
        .join(" UNION ALL ")}
    ) as niver
    ORDER BY tipo ASC, nome ASC
  `;

  const { rows } = await pool.query(query);
  return rows;
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
