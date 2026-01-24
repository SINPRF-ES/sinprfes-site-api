// src/services/assembleias.service.js
const pool = require("../config/db");
const Textos = require("../utils/textos");

const ASSEMBLEIA_STATES = {
  CRIADA: 'CRIADA',
  ABERTA: 'ABERTA',
  EM_CURSO: 'EM_CURSO',
  ENCERRADA: 'ENCERRADA'
};

const ASSEMBLEIA_COLUMNS = `
  id, tipo, titulo, pauta, estado, criado_por as criada_por_user_id, aberta_em, encerrada_em, criado_em,
  data_hora_inicio, edital_url, data_evento, hora_primeira_chamada, hora_segunda_chamada
`;

/**
 * Registra um evento de auditoria no sistema de assembleias.
 * Tabela assembleia_auditoria é APPEND-ONLY: updates e deletes são proibidos por política de dados.
 */
async function registrarAuditoria(assembleiaId, userId, evento, payload, client = null) {
  const db = client || pool;
  try {
    await db.query(
      "INSERT INTO assembleia_auditoria (assembleia_id, user_id, evento, payload) VALUES ($1, $2, $3, $4)",
      [assembleiaId, userId, evento, payload ? JSON.stringify(payload) : null]
    );
  } catch (err) {
    console.error("Erro ao registrar auditoria de assembleia:", err);
  }
}

async function listar(perfilAcesso) {
  let query = `SELECT ${ASSEMBLEIA_COLUMNS} FROM assembleias`;
  query += " ORDER BY criado_em DESC";

  const { rows } = await pool.query(query);
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await pool.query(`SELECT ${ASSEMBLEIA_COLUMNS} FROM assembleias WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function criar(dados) {
  const { tipo, titulo, pauta, criado_por, data_hora_inicio, edital_url, data_evento, hora_primeira_chamada, hora_segunda_chamada } = dados;
  const { rows } = await pool.query(
    `INSERT INTO assembleias (tipo, titulo, pauta, criado_por, data_hora_inicio, edital_url, data_evento, hora_primeira_chamada, hora_segunda_chamada, estado)
     VALUES ($1, $2, $3, $4, NULLIF($5, '')::TIMESTAMP, NULLIF($6, ''), $7, $8, $9, 'CRIADA')
     RETURNING ${ASSEMBLEIA_COLUMNS}`,
    [tipo, titulo, pauta, criado_por, data_hora_inicio, edital_url, data_evento, hora_primeira_chamada, hora_segunda_chamada]
  );
  const nova = rows[0];
  await registrarAuditoria(nova.id, criado_por, 'ASSEMBLEIA_CRIADA', { tipo, titulo });
  return nova;
}

async function abrir(id, userId) {
  const assembleia = await buscarPorId(id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  if (assembleia.estado !== ASSEMBLEIA_STATES.CRIADA) {
    throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (${assembleia.estado} -> ABERTA)`);
  }

  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'ABERTA', aberta_em = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  const atualizada = rows[0];
  await registrarAuditoria(id, userId, 'ASSEMBLEIA_ABERTA', { de: assembleia.estado, para: 'ABERTA' });
  await registrarAuditoria(id, userId, 'TRANSICAO_STATUS', { de: assembleia.estado, para: 'ABERTA' });
  return atualizada;
}

async function contarFiliadosAtivosParaQuorum(client = null) {
  const db = client || pool;
  const { rows } = await db.query(
    `SELECT COUNT(*) as total
     FROM filiados
     WHERE arquivado_em IS NULL
       AND perfil_acesso IN ('DIRETORIA', 'FILIADO', 'ORGANIZADOR')`
  );
  return parseInt(rows[0].total);
}

async function iniciarExecucao(id, userId) {
  const assembleia = await buscarPorId(id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  if (assembleia.estado !== ASSEMBLEIA_STATES.ABERTA) {
    throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (${assembleia.estado} -> EM_CURSO)`);
  }

  // Pré-condição: mesa definida e presentes
  const mesa = await buscarMesa(id);
  if (!mesa || !mesa.presidente_user_id || !mesa.secretario_user_id) {
    throw new Error(Textos.ASSEMBLEIA.MESA_NAO_DEFINIDA);
  }

  const quorumVigente = await buscarUltimoQuorum(id);
  if (!quorumVigente) throw new Error(Textos.ASSEMBLEIA.TOKEN_INVALIDO);

  const [presencaPresidente, presencaSecretario] = await Promise.all([
    verificarElegibilidadePorQuorum(quorumVigente.id, mesa.presidente_user_id),
    verificarElegibilidadePorQuorum(quorumVigente.id, mesa.secretario_user_id)
  ]);

  if (!presencaPresidente || !presencaSecretario) {
    throw new Error(Textos.ASSEMBLEIA.MESA_NAO_DEFINIDA);
  }

  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'EM_CURSO' WHERE id = $1 RETURNING *`,
    [id]
  );
  const atualizada = rows[0];
  await registrarAuditoria(id, userId, 'TRANSICAO_STATUS', { de: assembleia.estado, para: 'EM_CURSO' });
  return atualizada;
}

async function encerrar(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: assRows } = await client.query(`SELECT estado FROM assembleias WHERE id = $1 FOR UPDATE`, [id]);
    const assembleia = assRows[0];
    if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

    if (assembleia.estado === ASSEMBLEIA_STATES.ENCERRADA) {
      await client.query('COMMIT');
      return await buscarPorId(id);
    }

    if (assembleia.estado !== ASSEMBLEIA_STATES.ABERTA && assembleia.estado !== ASSEMBLEIA_STATES.EM_CURSO) {
      throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (${assembleia.estado} -> ENCERRADA)`);
    }

    // Estratégia A: encerrar votação ativa automaticamente
    const { rows: activeVotations } = await client.query(
      `SELECT id FROM assembleia_votacoes WHERE assembleia_id = $1 AND status = 'ATIVA' FOR UPDATE`,
      [id]
    );
    for (const v of activeVotations) {
      await client.query(
        `INSERT INTO assembleia_votos (votacao_id, filiado_id, voto)
         SELECT v.id, c.filiado_id, 'ABSTENCAO'
         FROM assembleia_votacoes v
         JOIN assembleia_checkins c ON v.quorum_snapshot_id = c.assembleia_quorum_id
         LEFT JOIN assembleia_votos vo ON v.id = vo.votacao_id AND c.filiado_id = vo.filiado_id
         WHERE v.id = $1 AND vo.id IS NULL
         ON CONFLICT (votacao_id, filiado_id) DO NOTHING`,
        [v.id]
      );
      await client.query(`UPDATE assembleia_votacoes SET status = 'ENCERRADA', finalizada_em = NOW() WHERE id = $1`, [v.id]);
      await registrarAuditoria(id, userId, 'VOTACAO_ENCERRADA', { votacao_id: v.id, motivo: 'ENCERRAMENTO_ASSEMBLEIA' }, client);
    }

    const { rows } = await client.query(
      `UPDATE assembleias SET estado = 'ENCERRADA', encerrada_em = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    const atualizada = rows[0];

    // Encerrar quórum vigente
    await client.query(
      `UPDATE assembleia_quoruns SET encerrado_em = NOW() WHERE assembleia_id = $1 AND encerrado_em IS NULL`,
      [id]
    );

    await registrarAuditoria(id, userId, 'ASSEMBLEIA_ENCERRADA', { de: assembleia.estado, para: 'ENCERRADA' }, client);
    await registrarAuditoria(id, userId, 'TRANSICAO_STATUS', { de: assembleia.estado, para: 'ENCERRADA' }, client);

    await client.query('COMMIT');
    return atualizada;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function gerarQuorum(dados) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { assembleia_id, gerado_por_user_id, tipo_chamada, observacao } = dados;
    let { token } = dados;

    const { rows: assRows } = await client.query(`SELECT estado FROM assembleias WHERE id = $1 FOR UPDATE`, [assembleia_id]);
    const assembleia = assRows[0];
    if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
    if (assembleia.estado !== ASSEMBLEIA_STATES.ABERTA && assembleia.estado !== ASSEMBLEIA_STATES.EM_CURSO) {
      throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    }

    const totalAtivos = await contarFiliadosAtivosParaQuorum(client);
    let quorumNecessario = tipo_chamada === 'PRIMEIRA' ? Math.floor(totalAtivos / 2) + 1 : 0;

    // Apenas Presidente pode solicitar RECONTAGEM
    if (tipo_chamada === 'RECONTAGEM') {
      const { rows: mesaRows } = await client.query(`SELECT presidente_user_id FROM assembleia_mesa WHERE assembleia_id = $1`, [assembleia_id]);
      if (!mesaRows[0] || mesaRows[0].presidente_user_id !== gerado_por_user_id) {
        throw new Error(Textos.ASSEMBLEIA.APENAS_PRESIDENTE);
      }
    }

    // Token collision check
    let attempts = 0;
    while (attempts < 5) {
      const { rows: collisionRows } = await client.query(
        `SELECT 1 FROM assembleia_quoruns WHERE assembleia_id = $1 AND token = $2 AND encerrado_em IS NULL`,
        [assembleia_id, token]
      );
      if (collisionRows.length === 0) break;
      token = Math.floor(100000 + Math.random() * 900000).toString();
      attempts++;
    }

    // Encerrar quórum anterior
    await client.query(
      `UPDATE assembleia_quoruns SET encerrado_em = NOW() WHERE assembleia_id = $1 AND encerrado_em IS NULL`,
      [assembleia_id]
    );

    const { rows: qRows } = await client.query(
      `INSERT INTO assembleia_quoruns (assembleia_id, token, gerado_por_user_id, tipo_chamada, quorum_total_ativos, quorum_necessario, observacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, token, criado_em, quorum_total_ativos, quorum_necessario`,
      [assembleia_id, token, gerado_por_user_id, tipo_chamada, totalAtivos, quorumNecessario, observacao]
    );
    const quorum = qRows[0];

    const auditEvent = tipo_chamada === 'RECONTAGEM' ? 'RECONTAGEM_INICIADA' : 'TOKEN_GERADO';
    await registrarAuditoria(assembleia_id, gerado_por_user_id, auditEvent, { token, tipo_chamada, quorum_total_ativos: totalAtivos, quorum_necessario: quorumNecessario }, client);

    // Auto-checkin
    if (gerado_por_user_id) {
       const { rows: userRows } = await client.query("SELECT perfil_acesso FROM filiados WHERE id = $1", [gerado_por_user_id]);
       const perfil = (userRows[0]?.perfil_acesso || "").toUpperCase();
       if (perfil !== 'ADMIN' && perfil !== 'COMUNICADOR') {
         const origem = tipo_chamada === 'RECONTAGEM' ? 'AUTO_PRESIDENTE' : 'AUTO_GERADOR';
         await client.query(
           `INSERT INTO assembleia_checkins (assembleia_quorum_id, filiado_id, origem)
            VALUES ($1, $2, $3) ON CONFLICT (assembleia_quorum_id, filiado_id) DO UPDATE SET registrado_em = NOW()`,
           [quorum.id, gerado_por_user_id, origem]
         );
       }
    }

    await client.query('COMMIT');
    return quorum;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function buscarQuorumPorToken(assembleiaId, token) {
  const { rows } = await pool.query(
    `SELECT id FROM assembleia_quoruns
     WHERE assembleia_id = $1 AND token = $2 AND encerrado_em IS NULL
     ORDER BY criado_em DESC LIMIT 1`,
    [assembleiaId, token]
  );
  return rows[0];
}

async function realizarCheckin(dados) {
  const { assembleia_quorum_id, filiado_id, origem, assembleia_id } = dados;

  // Blindagem de perfil: ADMIN e COMUNICADOR não fazem check-in
  const { rows: userRows } = await pool.query("SELECT perfil_acesso FROM filiados WHERE id = $1", [filiado_id]);
  const perfil = (userRows[0]?.perfil_acesso || "").toUpperCase();
  if (perfil === 'ADMIN' || perfil === 'COMUNICADOR') {
    throw new Error(Textos.AUTH.PERMISSAO_INSUFICIENTE);
  }

  // Idempotência de auditoria
  const { rows: existing } = await pool.query(
    `SELECT id FROM assembleia_checkins WHERE assembleia_quorum_id = $1 AND filiado_id = $2`,
    [assembleia_quorum_id, filiado_id]
  );

  const { rows } = await pool.query(
    `INSERT INTO assembleia_checkins (assembleia_quorum_id, filiado_id, origem)
     VALUES ($1, $2, $3)
     ON CONFLICT (assembleia_quorum_id, filiado_id) DO UPDATE SET registrado_em = NOW()
     RETURNING id`,
    [assembleia_quorum_id, filiado_id, origem]
  );
  const res = rows[0];

  if (assembleia_id && existing.length === 0) {
    await registrarAuditoria(assembleia_id, filiado_id, 'CHECKIN_REALIZADO', { assembleia_quorum_id, origem });
  }
  return res;
}

async function buscarUltimoQuorum(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT * FROM assembleia_quoruns WHERE assembleia_id = $1 AND encerrado_em IS NULL ORDER BY criado_em DESC LIMIT 1`,
    [assembleiaId]
  );
  return rows[0];
}

async function criarVotacao(dados) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, iniciada_por_user_id } = dados;

    const { rows: assRows } = await client.query(`SELECT estado FROM assembleias WHERE id = $1 FOR UPDATE`, [assembleia_id]);
    const assembleia = assRows[0];
    if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
    if (assembleia.estado !== ASSEMBLEIA_STATES.EM_CURSO) {
      throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    }

    // Unicidade de votação ativa
    const { rows: activeRows } = await client.query(
      `SELECT id FROM assembleia_votacoes WHERE assembleia_id = $1 AND status = 'ATIVA' FOR UPDATE`,
      [assembleia_id]
    );
    if (activeRows.length > 0) {
      throw new Error("Já existe uma votação ativa para esta assembleia.");
    }

    // Apenas Presidente pode iniciar votação
    const { rows: mesaRows } = await client.query(`SELECT presidente_user_id FROM assembleia_mesa WHERE assembleia_id = $1`, [assembleia_id]);
    if (!mesaRows[0] || mesaRows[0].presidente_user_id !== iniciada_por_user_id) {
      throw new Error(Textos.ASSEMBLEIA.APENAS_PRESIDENTE);
    }

    const { rows: vRows } = await client.query(
      `INSERT INTO assembleia_votacoes (assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, status, iniciada_por_user_id, aberta_em)
       VALUES ($1, $2, $3, $4, $5, 'ATIVA', $6, NOW())
       RETURNING *, (aberta_em + interval '1 second' * duracao_segundos) as encerra_em`,
      [assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, iniciada_por_user_id]
    );
    const votacao = vRows[0];

    await registrarAuditoria(assembleia_id, iniciada_por_user_id, 'VOTACAO_INICIADA', { votacao_id: votacao.id, titulo, quorum_snapshot_id, duracao_segundos }, client);

    await client.query('COMMIT');
    return votacao;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function buscarVotacaoAtiva(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT *, (aberta_em + interval '1 second' * duracao_segundos) as encerra_em
     FROM assembleia_votacoes
     WHERE assembleia_id = $1 AND status = 'ATIVA'
     LIMIT 1`,
    [assembleiaId]
  );
  const votacao = rows[0];

  if (votacao && new Date(votacao.encerra_em) < new Date()) {
    return await finalizarVotacao(votacao.id);
  }

  return votacao;
}

async function verificarElegibilidade(votacaoId, filiadoId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM assembleia_checkins c
     JOIN assembleia_votacoes v ON c.assembleia_quorum_id = v.quorum_snapshot_id
     WHERE v.id = $1 AND c.filiado_id = $2`,
    [votacaoId, filiadoId]
  );
  return rows.length > 0;
}

async function verificarElegibilidadePorQuorum(quorumId, filiadoId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM assembleia_checkins WHERE assembleia_quorum_id = $1 AND filiado_id = $2`,
    [quorumId, filiadoId]
  );
  return rows.length > 0;
}

async function registrarVoto(votacaoId, filiadoId, voto, assembleiaId) {
  // Blindagem de perfil: ADMIN e COMUNICADOR não votam
  const { rows: userRows } = await pool.query("SELECT perfil_acesso FROM filiados WHERE id = $1", [filiadoId]);
  const perfil = (userRows[0]?.perfil_acesso || "").toUpperCase();
  if (perfil === 'ADMIN' || perfil === 'COMUNICADOR') {
    throw new Error(Textos.AUTH.PERMISSAO_INSUFICIENTE);
  }

  const { rows } = await pool.query(
    `INSERT INTO assembleia_votos (votacao_id, filiado_id, voto)
     VALUES ($1, $2, $3)
     ON CONFLICT (votacao_id, filiado_id) DO UPDATE SET voto = $3, registrado_em = NOW()
     RETURNING *`,
    [votacaoId, filiadoId, voto]
  );
  const res = rows[0];
  if (assembleiaId) {
    await registrarAuditoria(assembleiaId, filiadoId, 'VOTO_REGISTRADO', { votacao_id: votacaoId, voto });
  }
  return res;
}

async function contarVotos(votacaoId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE voto = 'SIM') as "SIM",
       COUNT(*) FILTER (WHERE voto = 'NAO') as "NAO",
       COUNT(*) FILTER (WHERE voto = 'ABSTENCAO') as "ABSTENCAO"
     FROM assembleia_votos WHERE votacao_id = $1`,
    [votacaoId]
  );
  const contagem = rows[0];
  return {
    SIM: parseInt(contagem.SIM || 0),
    NAO: parseInt(contagem.NAO || 0),
    ABSTENCAO: parseInt(contagem.ABSTENCAO || 0),
    total: parseInt(contagem.SIM || 0) + parseInt(contagem.NAO || 0) + parseInt(contagem.ABSTENCAO || 0)
  };
}

async function listarVotosNominais(votacaoId) {
  const { rows } = await pool.query(
    `SELECT v.filiado_id, f.nome, v.voto, v.registrado_em
     FROM assembleia_votos v
     JOIN filiados f ON v.filiado_id = f.id
     WHERE v.votacao_id = $1
     ORDER BY v.registrado_em DESC`,
    [votacaoId]
  );
  return rows;
}

async function finalizarVotacao(votacaoId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: vCheck } = await client.query(`SELECT status, assembleia_id FROM assembleia_votacoes WHERE id = $1 FOR UPDATE`, [votacaoId]);
    if (!vCheck[0]) throw new Error("Votação não encontrada");
    if (vCheck[0].status === 'ENCERRADA') {
      await client.query('COMMIT');
      return await buscarVotacaoPorId(votacaoId);
    }

    const { rowCount: abstençõesAplicadas } = await client.query(
      `INSERT INTO assembleia_votos (votacao_id, filiado_id, voto)
       SELECT v.id, c.filiado_id, 'ABSTENCAO'
       FROM assembleia_votacoes v
       JOIN assembleia_checkins c ON v.quorum_snapshot_id = c.assembleia_quorum_id
       LEFT JOIN assembleia_votos vo ON v.id = vo.votacao_id AND c.filiado_id = vo.filiado_id
       WHERE v.id = $1 AND vo.id IS NULL
       ON CONFLICT (votacao_id, filiado_id) DO NOTHING`,
      [votacaoId]
    );

    const { rows } = await client.query(
      `UPDATE assembleia_votacoes SET status = 'ENCERRADA', finalizada_em = NOW() WHERE id = $1 RETURNING *`,
      [votacaoId]
    );
    const votacao = rows[0];

    await registrarAuditoria(votacao.assembleia_id, userId, 'VOTACAO_ENCERRADA', { votacao_id: votacaoId }, client);

    if (abstençõesAplicadas > 0) {
      await registrarAuditoria(votacao.assembleia_id, userId, 'ABSTENCAO_AUTOMATICA_APLICADA', { votacao_id: votacaoId, contagem: abstençõesAplicadas }, client);
    }

    await client.query('COMMIT');
    return votacao;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function buscarVotacaoPorId(votacaoId) {
  const { rows } = await pool.query(
    `SELECT *, (aberta_em + interval '1 second' * duracao_segundos) as encerra_em FROM assembleia_votacoes WHERE id = $1`,
    [votacaoId]
  );
  return rows[0];
}

async function definirMesa(dados) {
  const { assembleia_id, presidente_user_id, secretario_user_id, definida_por_user_id } = dados;

  const assembleia = await buscarPorId(assembleia_id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  if (assembleia.estado !== ASSEMBLEIA_STATES.ABERTA) {
    throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
  }

  // Validar presença dos escolhidos no quórum vigente
  const quorumVigente = await buscarUltimoQuorum(assembleia_id);
  if (!quorumVigente) throw new Error(Textos.ASSEMBLEIA.TOKEN_INVALIDO);

  const [presencaP, presencaS] = await Promise.all([
    verificarElegibilidadePorQuorum(quorumVigente.id, presidente_user_id),
    verificarElegibilidadePorQuorum(quorumVigente.id, secretario_user_id)
  ]);

  if (!presencaP || !presencaS) {
    throw new Error(Textos.ASSEMBLEIA.MESA_NAO_DEFINIDA);
  }

  const { rows } = await pool.query(
    `INSERT INTO assembleia_mesa (assembleia_id, presidente_user_id, secretario_user_id, definida_por_user_id, definida_em)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (assembleia_id) DO UPDATE SET
       presidente_user_id = $2,
       secretario_user_id = $3,
       definida_por_user_id = $4,
       definida_em = NOW()
     RETURNING *`,
    [assembleia_id, presidente_user_id, secretario_user_id, definida_por_user_id]
  );
  const mesa = rows[0];
  await registrarAuditoria(assembleia_id, definida_por_user_id, 'MESA_DEFINIDA', { presidente_user_id, secretario_user_id });
  return mesa;
}

async function buscarMesa(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT m.*, fp.nome as presidente_nome, fs.nome as secretario_nome
     FROM assembleia_mesa m
     LEFT JOIN filiados fp ON m.presidente_user_id = fp.id
     LEFT JOIN filiados fs ON m.secretario_user_id = fs.id
     WHERE m.assembleia_id = $1`,
    [assembleiaId]
  );
  return rows[0];
}

async function pedirPalavra(assembleiaId, filiadoId) {
  const assembleia = await buscarPorId(assembleiaId);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  if (assembleia.estado === ASSEMBLEIA_STATES.ENCERRADA) {
    throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
  }

  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(ordem), 0) as max_ordem FROM assembleia_pedidos_palavra WHERE assembleia_id = $1`,
    [assembleiaId]
  );
  const novaOrdem = maxRows[0].max_ordem + 1;

  const { rows } = await pool.query(
    `INSERT INTO assembleia_pedidos_palavra (assembleia_id, filiado_id, ordem, status)
     VALUES ($1, $2, $3, 'PENDENTE')
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [assembleiaId, filiadoId, novaOrdem]
  );
  return rows[0];
}

async function listarPedidosPalavra(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT p.*, f.nome as filiado_nome
     FROM assembleia_pedidos_palavra p
     JOIN filiados f ON p.filiado_id = f.id
     WHERE p.assembleia_id = $1 AND p.status IN ('PENDENTE', 'EM_FALA')
     ORDER BY p.ordem ASC`,
    [assembleiaId]
  );
  return rows;
}

async function criarProposta(dados) {
  const { assembleia_id, autor_id, titulo, pauta } = dados;

  const assembleia = await buscarPorId(assembleia_id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  if (assembleia.estado !== ASSEMBLEIA_STATES.EM_CURSO) {
    throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
  }

  const { rows } = await pool.query(
    `INSERT INTO assembleia_propostas (assembleia_id, autor_id, titulo, descricao, status)
     VALUES ($1, $2, $3, $4, 'ATIVA')
     RETURNING *`,
    [assembleia_id, autor_id, titulo, pauta]
  );
  return rows[0];
}

async function listarPropostas(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT p.*, f.nome as autor_nome
     FROM assembleia_propostas p
     JOIN filiados f ON p.autor_id = f.id
     WHERE p.assembleia_id = $1
     ORDER BY p.criado_em ASC`,
    [assembleiaId]
  );
  return rows;
}

async function buscarEstadoCompleto(assembleiaId, filiadoId = null) {
  const assembleia = await buscarPorId(assembleiaId);
  if (!assembleia) return null;

  const [mesa, pedidosPalavra, propostas, ultimoQuorum] = await Promise.all([
    buscarMesa(assembleiaId),
    listarPedidosPalavra(assembleiaId),
    listarPropostas(assembleiaId),
    buscarUltimoQuorum(assembleiaId)
  ]);

  const votacaoAtiva = await buscarVotacaoAtiva(assembleiaId);
  let votacaoData = null;

  if (votacaoAtiva && votacaoAtiva.status === 'ATIVA') {
    const [contagem, votos] = await Promise.all([
      contarVotos(votacaoAtiva.id),
      listarVotosNominais(votacaoAtiva.id)
    ]);

     let elegivel = false;
     let motivo_inelegibilidade = null;

     let jaVotou = false;
     if (filiadoId) {
       elegivel = await verificarElegibilidade(votacaoAtiva.id, filiadoId);
       if (!elegivel) {
         const presencaNoQuorum = await verificarElegibilidadePorQuorum(votacaoAtiva.quorum_snapshot_id, filiadoId);
         if (!presencaNoQuorum) {
           motivo_inelegibilidade = "Ausente na chamada de quórum deste item.";
         } else {
           motivo_inelegibilidade = "Restrição de elegibilidade técnica.";
         }
       } else {
          jaVotou = votos.some(v => v.filiado_id === filiadoId);
       }
     }

    votacaoData = {
      ...votacaoAtiva,
      contagem,
       votos,
       user_eligibility: {
         elegivel,
         motivo: motivo_inelegibilidade,
         jaVotou
       }
    };
  }

  let totalPresentes = 0;
  let userHasCheckedIn = false;
  let presentesNominais = [];
  if (ultimoQuorum) {
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) as total FROM assembleia_checkins WHERE assembleia_quorum_id = $1',
      [ultimoQuorum.id]
    );
    totalPresentes = parseInt(countRows[0].total);

    const { rows: presentesRows } = await pool.query(
      `SELECT f.id, f.nome, f.avatar_url, c.registrado_em
       FROM assembleia_checkins c
       JOIN filiados f ON c.filiado_id = f.id
       WHERE c.assembleia_quorum_id = $1
       ORDER BY f.nome ASC`,
      [ultimoQuorum.id]
    );
    presentesNominais = presentesRows;

    if (filiadoId) {
      userHasCheckedIn = presentesNominais.some(p => p.id === filiadoId);
    }
  }

  return {
    assembleia,
    mesa,
    pedidosPalavra,
    propostas,
    quorumVigente: ultimoQuorum ? {
      ...ultimoQuorum,
      total: totalPresentes,
      userHasCheckedIn,
      presentes: presentesNominais
    } : null,
    votacaoAtiva: votacaoData
  };
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  abrir,
  iniciarExecucao,
  encerrar,
  registrarAuditoria,
  gerarQuorum,
  buscarQuorumPorToken,
  realizarCheckin,
  buscarUltimoQuorum,
  criarVotacao,
  buscarVotacaoAtiva,
  verificarElegibilidade,
  registrarVoto,
  contarVotos,
  listarVotosNominais,
  finalizarVotacao,
  pedirPalavra,
  listarPedidosPalavra,
  criarProposta,
  listarPropostas,
  verificarElegibilidadePorQuorum,
  definirMesa,
  buscarMesa,
  buscarEstadoCompleto
};
