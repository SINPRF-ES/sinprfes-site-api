// src/services/filiados.service.js
const pool = require("../config/db");
const { normalizarCpf } = require("../utils/format");
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
  arquivado_em, arquivado_motivo,
  dep1_nome, dep1_cpf, dep1_data_nascimento, dep1_parentesco,
  dep2_nome, dep2_cpf, dep2_data_nascimento, dep2_parentesco,
  dep3_nome, dep3_cpf, dep3_data_nascimento, dep3_parentesco,
  dep4_nome, dep4_cpf, dep4_data_nascimento, dep4_parentesco,
  dep5_nome, dep5_cpf, dep5_data_nascimento, dep5_parentesco
`;

/**
 * Busca filiado pelo CPF (normalizado).
 */
async function buscarPorCpf(cpfRaw) {
  const cpf = normalizarCpf(cpfRaw);
  const { rows } = await pool.query(
    `SELECT ${FILIADO_COLUMNS} FROM filiados WHERE cpf = $1 LIMIT 1`,
    [cpf]
  );
  return anexarEstadoCadastro(rows[0]) || null;
}

/**
 * Busca filiado pelo ID.
 */
async function buscarPorId(id) {
  const { rows } = await pool.query(
    `SELECT ${FILIADO_COLUMNS} FROM filiados WHERE id = $1 LIMIT 1`,
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
  addCampo("cep", dados.cep);
  addCampo("avatar_url", dados.avatar_url);

  // Campos dos dependentes
  for (let i = 1; i <= 5; i++) {
    addCampo(`dep${i}_nome`, dados[`dep${i}_nome`]);
    addCampo(`dep${i}_cpf`, dados[`dep${i}_cpf`]);
    addCampo(`dep${i}_data_nascimento`, dados[`dep${i}_data_nascimento`]);
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

  const { rows } = await pool.query(
    `
    UPDATE filiados
    SET ${campos.join(", ")}
    WHERE id = $${idx}
    RETURNING ${FILIADO_COLUMNS}
  `,
    valores
  );

  return anexarEstadoCadastro(rows[0]) || null;
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
  addCampo("cep", dados.cep);
  addCampo("avatar_url", dados.avatar_url);

  // Campos dos dependentes
  for (let i = 1; i <= 5; i++) {
    addCampo(`dep${i}_nome`, dados[`dep${i}_nome`]);
    addCampo(`dep${i}_cpf`, dados[`dep${i}_cpf`]);
    addCampo(`dep${i}_data_nascimento`, dados[`dep${i}_data_nascimento`]);
    if (dados[`dep${i}_parentesco`] !== undefined) {
      addCampo(`dep${i}_parentesco`, normalizeParentesco(dados[`dep${i}_parentesco`]));
    }
  }

  // sempre atualiza timestamp
  addCampo("atualizado_em", "NOW()", true);

  if (campos.length === 0) return await buscarPorId(id);

  valores.push(id);

  const { rows } = await pool.query(
    `
    UPDATE filiados
    SET ${campos.join(", ")}
    WHERE id = $${idx}
    RETURNING ${FILIADO_COLUMNS}
  `,
    valores
  );

  return anexarEstadoCadastro(rows[0]) || null;
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

  if (!incluirArquivados) {
    conds.push("arquivado_em IS NULL");
  }

  if (filtro) {
    // Busca por nome (case-insensitive) ou CPF (comparando apenas dígitos)
    params.push(`%${filtro.toLowerCase()}%`);
    params.push(`%${filtro.replace(/\D/g, "")}%`);
    const pNome = params.length - 1;
    const pCpf = params.length;

    conds.push(`
      (
        LOWER(nome) LIKE $${pNome}
        OR regexp_replace(cpf, '[^0-9]', '', 'g') LIKE $${pCpf}
      )
    `);
  }

  const whereSql = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  const perfisGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"];
  const isGestao = perfisGestao.includes(perfil);

  if (isGestao) {
    // gestão: devolve campos necessários para edição, incluindo dependentes
    const { rows } = await pool.query(
      `
      SELECT
        id, nome, cpf, data_nascimento, telefone1, telefone2, email1, email2,
        lotacao, situacao, perfil_acesso,
        logradouro_bairro, numero, complemento, cidade, uf, cep,
        avatar_url,
        arquivado_em, arquivado_motivo,
        dep1_nome, dep1_cpf, dep1_data_nascimento, dep1_parentesco,
        dep2_nome, dep2_cpf, dep2_data_nascimento, dep2_parentesco,
        dep3_nome, dep3_cpf, dep3_data_nascimento, dep3_parentesco,
        dep4_nome, dep4_cpf, dep4_data_nascimento, dep4_parentesco,
        dep5_nome, dep5_cpf, dep5_data_nascimento, dep5_parentesco
      FROM filiados
      ${whereSql}
      ORDER BY nome ASC
    `,
      params
    );
    return anexarEstadoCadastroLista(rows);
  }

  // filiado: devolve só diretório (inclui avatar para exibição)
  const { rows } = await pool.query(
    `
    SELECT
      id, nome, telefone1, avatar_url
    FROM filiados
    WHERE arquivado_em IS NULL
    ORDER BY nome ASC
  `
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

    const colunas = [
      "nome", "cpf", "data_nascimento", "telefone1", "telefone2", "email1", "email2",
      "logradouro_bairro", "numero", "complemento", "cidade", "uf", "cep",
      "lotacao", "situacao", "perfil_acesso",
      "criado_em", "atualizado_em", "bloqueado", "arquivado_em", "arquivado_motivo"
    ];

    const valores = [
      nome, cpfNormalizado, data_nascimento, telefone1, telefone2, email1, email2,
      logradouro_bairro, numero, complemento, cidade, uf, cep,
      lotacao, situacao, perfilNovo,
      "NOW()", "NOW()", false, null, null
    ];

    for (let i = 1; i <= 5; i++) {
      colunas.push(`dep${i}_nome`, `dep${i}_cpf`, `dep${i}_data_nascimento`, `dep${i}_parentesco`);
      valores.push(
        dados[`dep${i}_nome`],
        dados[`dep${i}_cpf`],
        dados[`dep${i}_data_nascimento`],
        normalizeParentesco(dados[`dep${i}_parentesco`])
      );
    }

    const placeholders = valores.map((_, i) => (valores[i] === "NOW()" ? "NOW()" : `$${i + 1}`)).join(", ");
    const valoresFiltrados = valores.filter(v => v !== "NOW()");

    const { rows } = await pool.query(
      `
      INSERT INTO filiados (${colunas.join(", ")})
      VALUES (${placeholders})
      RETURNING ${FILIADO_COLUMNS}
    `,
      valoresFiltrados
    );

    return anexarEstadoCadastro(rows[0]);
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
    await pool.query(
      `
      INSERT INTO filiados_eventos
        (filiado_id, acao, motivo, ator_id, ator_perfil, payload_antes, payload_depois, criado_em)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, NOW())
    `,
      [
        filiadoId,
        acao,
        motivo,
        atorId,
        atorPerfil,
        payloadAntes ? JSON.stringify(payloadAntes) : null,
        payloadDepois ? JSON.stringify(payloadDepois) : null,
      ]
    );
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

  const { rows } = await pool.query(
    `
    UPDATE filiados
    SET
      arquivado_em = NOW(),
      arquivado_motivo = $1,
      atualizado_em = NOW()
    WHERE id = $2
    RETURNING ${FILIADO_COLUMNS}
  `,
    [motivo, id]
  );

  const depois = rows[0] || null;

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

  const { rows } = await pool.query(
    `
    UPDATE filiados
    SET
      arquivado_em = NULL,
      arquivado_motivo = NULL,
      atualizado_em = NOW()
    WHERE id = $1
    RETURNING ${FILIADO_COLUMNS}
  `,
    [id]
  );

  const depois = rows[0] || null;

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
  const { rows } = await pool.query(
    `
    UPDATE filiados
    SET twofa_secret = $1, atualizado_em = NOW()
    WHERE id = $2
    RETURNING ${FILIADO_COLUMNS}
  `,
    [secret, userId]
  );
  return anexarEstadoCadastro(rows[0]) || null;
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
};
