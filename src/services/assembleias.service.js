// src/services/assembleias.service.js
const pool = require("../config/db");
const Textos = require("../utils/textos");
const log = require("../utils/log");
const { escapeHtml } = require("../utils/format");

const ASSEMBLEIA_STATES = {
  CRIADA: 'CRIADA',
  ABERTA: 'ABERTA',
  EM_CURSO: 'EM_CURSO',
  ENCERRADA: 'ENCERRADA'
};

const ASSEMBLEIA_COLUMNS = `
  id, tipo, titulo, pauta, estado, criado_por as criada_por_user_id, aberta_em, encerrada_em, criado_em,
  data_hora_inicio, edital_url, data_evento, hora_primeira_chamada, hora_segunda_chamada,
  edital_public_id, edital_resource_type, edital_type, edital_format
`;

/**
 * Normaliza dados de uma assembleia.
 */
function normalizarAssembleia(assembleia) {
  if (!assembleia) return null;

  // Nunca retorna link direto do Cloudinary para o cliente (Diretriz TAREFA 1)
  // Se existe um edital, apontamos para o nosso proxy autenticado.
  if (assembleia.edital_url || assembleia.edital_public_id) {
    assembleia.edital_url = `/api/assembleias/${assembleia.id}/edital`;
  }

  return assembleia;
}

/**
 * Registra um evento de auditoria no sistema de assembleias.
 * Tabela assembleia_auditoria é APPEND-ONLY: updates e deletes são proibidos por política de dados.
 */
async function registrarAuditoria(assembleiaId, userId, evento, payload, client = null) {
  const db = client || pool;
  const env = process.env.ASSEMBLEIA_ENV || "dev";
  try {
    const fullPayload = {
      ...payload,
      _env: env,
      _timestamp: new Date().toISOString()
    };
    await db.query(
      "INSERT INTO assembleia_auditoria (assembleia_id, user_id, evento, payload) VALUES ($1, $2, $3, $4)",
      [assembleiaId, userId, evento, JSON.stringify(fullPayload)]
    );
  } catch (err) {
    log.error("Erro ao registrar auditoria de assembleia", { assembleiaId, userId, evento, error: err.message });
  }
}

async function listar(perfilAcesso) {
  let query = `SELECT ${ASSEMBLEIA_COLUMNS} FROM assembleias`;
  query += " ORDER BY criado_em DESC";

  const { rows } = await pool.query(query);
  return rows.map(normalizarAssembleia);
}

async function buscarPorId(id) {
  const { rows } = await pool.query(`SELECT ${ASSEMBLEIA_COLUMNS} FROM assembleias WHERE id = $1`, [id]);
  return normalizarAssembleia(rows[0] || null);
}

async function criar(dados) {
  let {
    tipo, titulo, pauta, criado_por, data_hora_inicio, edital_url, data_evento,
    hora_primeira_chamada, hora_segunda_chamada,
    edital_public_id, edital_resource_type, edital_type, edital_format
  } = dados;

  // Sanitização contra XSS
  titulo = escapeHtml(titulo);
  pauta = escapeHtml(pauta);

  // Normalização do tipo para o padrão de banco (AGE/AGO) se necessário
  let tipoNorm = tipo;
  if (tipo === 'Assembleia Geral Ordinária') tipoNorm = 'AGO';
  if (tipo === 'Assembleia Geral Extraordinária') tipoNorm = 'AGE';

  const { rows } = await pool.query(
    `INSERT INTO assembleias (
        tipo, titulo, pauta, criado_por, data_hora_inicio, edital_url,
        data_evento, hora_primeira_chamada, hora_segunda_chamada, estado,
        edital_public_id, edital_resource_type, edital_type, edital_format
     )
     VALUES (
        $1, $2, $3, $4, NULLIF($5, '')::TIMESTAMP, NULLIF($6, ''),
        NULLIF($7, '')::DATE, NULLIF($8, '')::TIME, NULLIF($9, '')::TIME, 'CRIADA',
        $10, $11, $12, $13
     )
     RETURNING ${ASSEMBLEIA_COLUMNS}`,
    [
        tipoNorm, titulo, pauta, criado_por, data_hora_inicio, edital_url,
        data_evento, hora_primeira_chamada, hora_segunda_chamada,
        edital_public_id, edital_resource_type, edital_type, edital_format
    ]
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
    `SELECT COUNT(*)::INTEGER as total
     FROM filiados
     WHERE arquivado_em IS NULL
       AND perfil_acesso IN ('DIRETORIA', 'FILIADO', 'ORGANIZADOR')`
  );
  return parseInt(rows?.[0]?.total || 0);
}

/**
 * Realiza check-in automático para o emissor do token se ele for elegível.
 */
async function realizarAutoCheckin(client, quorumId, userId, tipoChamada) {
  if (!userId) return;

  const { rows: userRows } = await client.query("SELECT perfil_acesso FROM filiados WHERE id = $1", [userId]);
  const perfil = (userRows[0]?.perfil_acesso || "").toUpperCase();

  // ADMIN e COMUNICADOR não contam quórum nem votam, logo não fazem check-in
  if (perfil !== 'ADMIN' && perfil !== 'COMUNICADOR') {
    const origem = tipoChamada === 'RECONTAGEM' ? 'AUTO_PRESIDENTE' : 'AUTO_GERADOR';
    await client.query(
      `INSERT INTO assembleia_checkins (assembleia_quorum_id, filiado_id, origem)
       VALUES ($1, $2, $3)
       ON CONFLICT (assembleia_quorum_id, filiado_id) DO UPDATE SET registrado_em = NOW()`,
      [quorumId, userId, origem]
    );
    return true;
  }
  return false;
}

async function iniciarExecucao(id, userId) {
  const assembleia = await buscarPorId(id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

  if (assembleia.estado === ASSEMBLEIA_STATES.EM_CURSO) {
    return assembleia;
  }

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

    const { assembleia_id, gerado_por_user_id, tipo_chamada, observacao, forceNew } = dados;
    let { token } = dados;

    // Lock na assembleia para garantir consistência de estado e evitar corridas
    const { rows: assRows } = await client.query(`SELECT estado FROM assembleias WHERE id = $1 FOR UPDATE`, [assembleia_id]);
    const assembleia = assRows[0];

    if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
    if (assembleia.estado !== ASSEMBLEIA_STATES.ABERTA && assembleia.estado !== ASSEMBLEIA_STATES.EM_CURSO) {
      throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    }

    // Idempotência: Se NÃO for forceNew e já existe token ativo para este MESMO tipo_chamada, retorna ele
    if (!forceNew) {
      const { rows: existingRows } = await client.query(
        `SELECT id, token, criado_em, quorum_total_ativos, quorum_necessario
         FROM assembleia_quoruns
         WHERE assembleia_id = $1 AND tipo_chamada = $2 AND encerrado_em IS NULL`,
        [assembleia_id, tipo_chamada]
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];
        // Reforça check-in automático do emissor mesmo em retorno de token existente
        await realizarAutoCheckin(client, existing.id, gerado_por_user_id, tipo_chamada);
        await client.query('COMMIT');
        return { ...existing, isNew: false };
      }
    }

    const totalAtivos = await contarFiliadosAtivosParaQuorum(client);
    // 1ª Chamada: 50% + 1 dos ativos. Outras chamadas: qualquer número (0).
    let quorumNecessario = (tipo_chamada === 'PRIMEIRA') ? Math.floor(totalAtivos / 2) + 1 : 0;

    // Apenas Presidente pode solicitar RECONTAGEM
    if (tipo_chamada === 'RECONTAGEM') {
      const { rows: mesaRows } = await client.query(`SELECT presidente_user_id FROM assembleia_mesa WHERE assembleia_id = $1`, [assembleia_id]);
      if (!mesaRows[0] || mesaRows[0].presidente_user_id !== gerado_por_user_id) {
        throw new Error(Textos.ASSEMBLEIA.APENAS_PRESIDENTE);
      }
    }

    // Token collision check (evita colisões raras de tokens de 6 dígitos ativos)
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

    // Encerrar quórum anterior antes de criar o novo (garante que só 1 esteja aberto por vez se for forceNew)
    // Se for um novo snapshot, ele "limpa" o anterior (snapshotting).
    await client.query(
      `UPDATE assembleia_quoruns SET encerrado_em = NOW() WHERE assembleia_id = $1 AND encerrado_em IS NULL`,
      [assembleia_id]
    );

    const { rows: qRows } = await client.query(
      `INSERT INTO assembleia_quoruns (assembleia_id, token, gerado_por_user_id, tipo_chamada, quorum_total_ativos, quorum_necessario, observacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, token, criado_em, quorum_total_ativos, quorum_necessario, tipo_chamada`,
      [assembleia_id, token, gerado_por_user_id, tipo_chamada, totalAtivos, quorumNecessario, observacao]
    );
    const quorum = { ...qRows[0], isNew: true };

    // Auditoria obrigatória
    const auditEvent = tipo_chamada === 'RECONTAGEM' ? 'RECONTAGEM_INICIADA' : 'TOKEN_GERADO';
    await registrarAuditoria(assembleia_id, gerado_por_user_id, auditEvent, { token, tipo_chamada, quorum_total_ativos: totalAtivos, quorum_necessario: quorumNecessario }, client);

    if (forceNew) {
      await registrarAuditoria(assembleia_id, gerado_por_user_id, 'QUORUM_ATUALIZADO', { novo_quorum_id: quorum.id, tipo_chamada }, client);
    }

    // Auto-checkin do emissor
    const checkedIn = await realizarAutoCheckin(client, quorum.id, gerado_por_user_id, tipo_chamada);
    if (checkedIn) {
      await registrarAuditoria(assembleia_id, gerado_por_user_id, 'CHECKIN_AUTO_EMISSOR', { quorum_id: quorum.id }, client);
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

async function atualizarQuorum(id, userId) {
  // Gera um novo token com forceNew=true para encerrar o snapshot atual e iniciar um novo.
  // Mantém o tipo_chamada do último snapshot se existir, ou assume PRIMEIRA.
  const ultimo = await buscarUltimoQuorum(id);
  const tipoChamada = ultimo?.tipo_chamada || 'PRIMEIRA';
  const token = Math.floor(100000 + Math.random() * 900000).toString();

  return await gerarQuorum({
    assembleia_id: id,
    token,
    gerado_por_user_id: userId,
    tipo_chamada: tipoChamada,
    forceNew: true,
    observacao: 'Atualização de Quórum (Novo Snapshot)'
  });
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

async function criarVotacao(dados, externalClient = null) {
  const client = externalClient || await pool.connect();
  try {
    if (!externalClient) await client.query('BEGIN');

    let { assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, iniciada_por_user_id } = dados;

    // Sanitização contra XSS
    titulo = escapeHtml(titulo);
    descricao = escapeHtml(descricao);

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

    // Autoridade será validada no Controller para permitir DIRETORIA ou PRESIDENTE.
    // Aqui mantemos apenas um check básico de existência de mesa se necessário,
    // mas o controller já garante a lógica de negócio.

    const { rows: vRows } = await client.query(
      `INSERT INTO assembleia_votacoes (assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, status, iniciada_por_user_id, aberta_em)
       VALUES ($1, $2, $3, $4, $5, 'ATIVA', $6, NOW())
       RETURNING *, (aberta_em + interval '1 second' * duracao_segundos) as encerra_em`,
      [assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, iniciada_por_user_id]
    );
    const votacao = vRows[0];

    await registrarAuditoria(assembleia_id, iniciada_por_user_id, 'VOTACAO_INICIADA', { votacao_id: votacao.id, titulo, quorum_snapshot_id, duracao_segundos }, client);

    if (!externalClient) await client.query('COMMIT');
    return votacao;
  } catch (e) {
    if (!externalClient) await client.query('ROLLBACK');
    throw e;
  } finally {
    if (!externalClient) client.release();
  }
}

async function buscarVotacaoAtiva(assembleiaId) {
  try {
    const { rows } = await pool.query(
      `SELECT *, (aberta_em + interval '1 second' * duracao_segundos) as encerra_em
       FROM assembleia_votacoes
       WHERE assembleia_id = $1 AND status = 'ATIVA'
       LIMIT 1`,
      [assembleiaId]
    );
    const votacao = rows[0];

    // Se existe votação mas o tempo expirou, tenta finalizar
    if (votacao && votacao.encerra_em && new Date(votacao.encerra_em) < new Date()) {
      try {
        return await finalizarVotacao(votacao.id);
      } catch (err) {
        log.error("Erro ao finalizar votação expirada em buscarVotacaoAtiva", { votacaoId: votacao.id, error: err.message });
        return { ...votacao, tempo_expirado: true };
      }
    }

    return votacao || null;
  } catch (err) {
    log.error("Erro em buscarVotacaoAtiva", { assembleiaId, error: err.message });
    return null;
  }
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
  if (voto !== 'SIM' && voto !== 'NAO') {
    throw new Error("Apenas votos SIM ou NAO são permitidos manualmente.");
  }

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
  const contagem = rows[0] || {};
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

async function finalizarVotacao(votacaoId, userId = null) {
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

    // Se userId for null (ex: via timer automático), o auditoria registra sem user_id (sistema)
    await registrarAuditoria(votacao.assembleia_id, userId, 'VOTACAO_ENCERRADA', { votacao_id: votacaoId, motivo: userId ? 'MANUAL' : 'AUTOMATICO' }, client);

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

  if (presidente_user_id === secretario_user_id) {
    throw new Error("Presidente e Secretário devem ser pessoas diferentes");
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: assRows } = await client.query(`SELECT estado FROM assembleias WHERE id = $1 FOR UPDATE`, [assembleia_id]);
    const assembleia = assRows[0];
    if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

    if (assembleia.estado !== ASSEMBLEIA_STATES.ABERTA) {
      throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    }

    const { rows: mesaExistente } = await client.query(`SELECT estabelecida_em FROM assembleia_mesa WHERE assembleia_id = $1`, [assembleia_id]);
    if (mesaExistente[0]?.estabelecida_em) {
      throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (Mesa já estabelecida. Use substituição.)`);
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

    const { rows } = await client.query(
      `INSERT INTO assembleia_mesa (assembleia_id, presidente_user_id, secretario_user_id, definida_por_user_id, definida_em, estabelecida_em)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (assembleia_id) DO UPDATE SET
         presidente_user_id = $2,
         secretario_user_id = $3,
         definida_por_user_id = $4,
         definida_em = NOW(),
         estabelecida_em = COALESCE(assembleia_mesa.estabelecida_em, NOW())
       RETURNING *`,
      [assembleia_id, presidente_user_id, secretario_user_id, definida_por_user_id]
    );
    const mesa = rows[0];
    await registrarAuditoria(assembleia_id, definida_por_user_id, 'MESA_DEFINIDA', { presidente_user_id, secretario_user_id }, client);

    // Transição automática para EM_CURSO (Phase 3) conforme nova diretriz
    await client.query(
      "UPDATE assembleias SET estado = 'EM_CURSO' WHERE id = $1",
      [assembleia_id]
    );
    await registrarAuditoria(assembleia_id, definida_por_user_id, 'ASSEMBLEIA_INICIADA', { estado: 'EM_CURSO', motivo: 'MESA_DEFINIDA' }, client);

    await client.query('COMMIT');
    return mesa;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function substituirMesa(dados) {
  let { assembleia_id, presidente_user_id, secretario_user_id, substituida_por_user_id, justificativa } = dados;

  // Sanitização contra XSS
  justificativa = escapeHtml(justificativa);

  if (presidente_user_id === secretario_user_id) {
    throw new Error("Presidente e Secretário devem ser pessoas diferentes");
  }

  if (!justificativa || justificativa.trim().length < 20) {
    throw new Error("Justificativa obrigatória (mínimo 20 caracteres).");
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: assRows } = await client.query(`SELECT estado FROM assembleias WHERE id = $1 FOR UPDATE`, [assembleia_id]);
    const assembleia = assRows[0];
    if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

    if (assembleia.estado !== ASSEMBLEIA_STATES.ABERTA && assembleia.estado !== ASSEMBLEIA_STATES.EM_CURSO) {
      throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    }

    const mesaAnterior = await buscarMesa(assembleia_id);

    // Validar presença dos escolhidos no quórum vigente
    const quorumVigente = await buscarUltimoQuorum(assembleia_id);
    if (!quorumVigente) throw new Error(Textos.ASSEMBLEIA.TOKEN_INVALIDO);

    const [presencaP, presencaS] = await Promise.all([
      verificarElegibilidadePorQuorum(quorumVigente.id, presidente_user_id),
      verificarElegibilidadePorQuorum(quorumVigente.id, secretario_user_id)
    ]);

    if (!presencaP || !presencaS) {
      throw new Error("Os novos membros da mesa devem estar presentes (check-in realizado).");
    }

    const { rows } = await client.query(
      `UPDATE assembleia_mesa SET
         presidente_user_id = $2,
         secretario_user_id = $3,
         definida_por_user_id = $4,
         definida_em = NOW()
       WHERE assembleia_id = $1
       RETURNING *`,
      [assembleia_id, presidente_user_id, secretario_user_id, substituida_por_user_id]
    );
    const mesa = rows[0];

    await registrarAuditoria(assembleia_id, substituida_por_user_id, 'MESA_SUBSTITUIDA', {
      justificativa,
      anterior: {
        presidente_id: mesaAnterior?.presidente_user_id,
        secretario_id: mesaAnterior?.secretario_user_id
      },
      nova: {
        presidente_id: presidente_user_id,
        secretario_id: secretario_user_id
      }
    }, client);

    await client.query('COMMIT');
    return mesa;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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
    `SELECT p.*, f.nome as filiado_nome, f.avatar_url
     FROM assembleia_pedidos_palavra p
     JOIN filiados f ON p.filiado_id = f.id
     WHERE p.assembleia_id = $1 AND p.status IN ('PENDENTE', 'CONCEDIDO', 'EM_FALA')
     ORDER BY p.ordem ASC`,
    [assembleiaId]
  );
  return rows;
}

async function concederPalavra(assembleiaId, pedidoId, userId) {
  const { rows } = await pool.query(
    `UPDATE assembleia_pedidos_palavra
     SET status = 'CONCEDIDO'
     WHERE id = $1 AND assembleia_id = $2
     RETURNING *`,
    [pedidoId, assembleiaId]
  );
  if (rows[0]) {
    await registrarAuditoria(assembleiaId, userId, 'PALAVRA_CONCEDIDA', { pedido_id: pedidoId, filiado_id: rows[0].filiado_id });
  }
  return rows[0];
}

async function criarProposta(dados) {
  const { assembleia_id, autor_id, pauta } = dados;
  let { titulo } = dados;

  if (!titulo || titulo.trim().length < 5) {
    throw new Error("O título da proposta deve ter pelo menos 5 caracteres.");
  }
  if (!pauta || pauta.trim().length < 10) {
    throw new Error("A descrição (pauta) da proposta deve ter pelo menos 10 caracteres.");
  }

  // Sanitização contra XSS (após validação de tamanho)
  titulo = escapeHtml(titulo);
  const pautaSanitizada = escapeHtml(pauta);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock na assembleia para garantir estado
    const { rows: assRows } = await client.query(
      `SELECT estado FROM assembleias WHERE id = $1 FOR UPDATE`,
      [assembleia_id]
    );
    const assembleia = assRows[0];

    if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

    // Permitir propostas em ABERTA ou EM_CURSO (conforme CANON)
    if (assembleia.estado !== ASSEMBLEIA_STATES.ABERTA && assembleia.estado !== ASSEMBLEIA_STATES.EM_CURSO) {
      throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (Estado: ${assembleia.estado})`);
    }

    const { rows } = await client.query(
      `INSERT INTO assembleia_propostas (assembleia_id, autor_id, titulo, descricao, status)
       VALUES ($1, $2, $3, $4, 'ATIVA')
       RETURNING *`,
      [assembleia_id, autor_id, titulo.trim(), pautaSanitizada.trim()]
    );
    const proposta = rows[0];

    await registrarAuditoria(assembleia_id, autor_id, 'PROPOSTA_CRIADA', { proposta_id: proposta.id, titulo: proposta.titulo }, client);

    await client.query('COMMIT');
    return proposta;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function listarPropostas(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT p.*, f.nome as autor_nome, f.avatar_url
     FROM assembleia_propostas p
     JOIN filiados f ON p.autor_id = f.id
     WHERE p.assembleia_id = $1
     ORDER BY p.criado_em ASC`,
    [assembleiaId]
  );
  return rows;
}

async function iniciarVotacaoProposta(assembleiaId, propostaId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: propRows } = await client.query(
      `SELECT * FROM assembleia_propostas WHERE id = $1 AND assembleia_id = $2 FOR UPDATE`,
      [propostaId, assembleiaId]
    );
    const proposta = propRows[0];
    if (!proposta) throw new Error("Proposta não encontrada.");

    const quorum = await buscarUltimoQuorum(assembleiaId);
    if (!quorum) throw new Error(Textos.ASSEMBLEIA.TOKEN_INVALIDO);

    // Criar a votação baseada na proposta
    const votacao = await criarVotacao({
      assembleia_id: assembleiaId,
      quorum_snapshot_id: quorum.id,
      titulo: `Votação: ${proposta.titulo}`,
      descricao: proposta.descricao,
      duracao_segundos: 120, // Propostas costumam ter tempo maior
      iniciada_por_user_id: userId
    }, client);

    // Atualizar status da proposta
    await client.query(
      `UPDATE assembleia_propostas SET status = 'EM_VOTACAO' WHERE id = $1`,
      [propostaId]
    );

    await registrarAuditoria(assembleiaId, userId, 'PROPOSTA_EM_VOTACAO', { proposta_id: propostaId, votacao_id: votacao.id }, client);

    await client.query('COMMIT');
    return votacao;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function buscarDiagnostico(assembleiaId) {
  const socket = require("../websocket/assembleia.socket");

  // Otimização Bolt: Busca inicial paralela para reduzir latência de rede e DB
  const [assembleia, mesa, ultimoQuorum, votacaoAtiva] = await Promise.all([
    buscarPorId(assembleiaId),
    buscarMesa(assembleiaId).catch(() => null),
    buscarUltimoQuorum(assembleiaId).catch(() => null),
    buscarVotacaoAtiva(assembleiaId).catch(() => null)
  ]);

  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

  let totalCheckins = 0;
  if (ultimoQuorum) {
    const { rows } = await pool.query("SELECT COUNT(*) as total FROM assembleia_checkins WHERE assembleia_quorum_id = $1", [ultimoQuorum.id]);
    totalCheckins = parseInt(rows[0].total);
  }

  const inconsistencias = [];
  if (assembleia.estado === ASSEMBLEIA_STATES.EM_CURSO) {
    if (!mesa) inconsistencias.push("Mesa não definida em assembleia em curso.");
    if (ultimoQuorum && totalCheckins < (ultimoQuorum.quorum_necessario || 0)) {
       inconsistencias.push("Quórum abaixo do necessário para o tipo de chamada.");
    }
  }

  return {
    timestamp: new Date().toISOString(),
    assembleia_id: assembleiaId,
    estado: assembleia.estado,
    sockets_conectados: socket.getRoomSocketCount(assembleiaId),
    quorum: ultimoQuorum ? {
      token: ultimoQuorum.token,
      total_presentes: totalCheckins,
      necessario: ultimoQuorum.quorum_necessario,
      tipo: ultimoQuorum.tipo_chamada
    } : null,
    mesa: mesa ? {
      presidente: mesa.presidente_nome,
      secretario: mesa.secretario_nome
    } : null,
    votacao_ativa: votacaoAtiva ? {
      id: votacaoAtiva.id,
      titulo: votacaoAtiva.titulo,
      status: votacaoAtiva.status
    } : null,
    inconsistencias,
    piloto: {
      ativo: process.env.ASSEMBLEIA_PILOTO_ATIVO === 'true',
      id_alvo: process.env.ASSEMBLEIA_PILOTO_ID,
      suporte: process.env.ASSEMBLEIA_SUPORTE_ATIVO === 'true'
    }
  };
}

async function buscarEstadoCompleto(assembleiaId, filiadoId = null) {
  try {
    // Otimização Bolt: Busca inicial paralela agressiva para reduzir latência de rede e DB
    const [assembleia, mesa, pedidosPalavra, propostas, ultimoQuorum, votacaoAtiva] = await Promise.all([
      buscarPorId(assembleiaId).catch(() => null),
      buscarMesa(assembleiaId).catch(() => null),
      listarPedidosPalavra(assembleiaId).catch(() => []),
      listarPropostas(assembleiaId).catch(() => []),
      buscarUltimoQuorum(assembleiaId).catch(() => null),
      buscarVotacaoAtiva(assembleiaId).catch(() => null)
    ]);

    if (!assembleia) return null;

    let votacaoData = null;
    let presentesNominais = [];
    let totalPresentes = 0;
    let userHasCheckedIn = false;

    // Otimização Bolt: Parallelize sub-queries para votação e quórum em um único bloco de latência
    const subTasks = [];
    let votacaoTaskIdx = -1;
    let quorumTaskIdx = -1;

    if (votacaoAtiva && (votacaoAtiva.status === 'ATIVA' || votacaoAtiva.tempo_expirado)) {
      votacaoTaskIdx = subTasks.length;
      subTasks.push(Promise.all([
        contarVotos(votacaoAtiva.id).catch(() => ({ SIM: 0, NAO: 0, ABSTENCAO: 0, total: 0 })),
        listarVotosNominais(votacaoAtiva.id).catch(() => []),
        filiadoId ? verificarElegibilidade(votacaoAtiva.id, filiadoId).catch(() => false) : Promise.resolve(false),
        filiadoId ? verificarElegibilidadePorQuorum(votacaoAtiva.quorum_snapshot_id, filiadoId).catch(() => false) : Promise.resolve(false)
      ]));
    }

    if (ultimoQuorum && ultimoQuorum.id) {
      quorumTaskIdx = subTasks.length;
      subTasks.push(pool.query(
        `SELECT f.id, f.nome, f.avatar_url, c.registrado_em
         FROM assembleia_checkins c
         JOIN filiados f ON c.filiado_id = f.id
         WHERE c.assembleia_quorum_id = $1
         ORDER BY f.nome ASC`,
        [ultimoQuorum.id]
      ).catch(() => ({ rows: [] })));
    }

    const subResults = await Promise.all(subTasks);

    if (votacaoTaskIdx !== -1) {
      const [contagem, votos, elegivel, presencaNoQuorum] = subResults[votacaoTaskIdx];

      let jaVotou = false;
      let motivo_inelegibilidade = null;

      if (filiadoId) {
        if (!elegivel) {
          motivo_inelegibilidade = !presencaNoQuorum ? "Ausente na chamada de quórum deste item." : "Restrição de elegibilidade técnica.";
        } else {
          jaVotou = (votos || []).some(v => v.filiado_id === filiadoId);
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

    if (quorumTaskIdx !== -1) {
      presentesNominais = subResults[quorumTaskIdx].rows || [];
      totalPresentes = presentesNominais.length; // Otimização Bolt: Evita query redundante de COUNT(*)
      if (filiadoId) {
        userHasCheckedIn = presentesNominais.some(p => p.id === filiadoId);
      }
    }

    return {
      assembleia,
      mesa: mesa || null,
      pedidosPalavra: pedidosPalavra || [],
      propostas: propostas || [],
      quorumVigente: ultimoQuorum ? {
        ...ultimoQuorum,
        total: totalPresentes,
        userHasCheckedIn,
        presentes: presentesNominais
      } : null,
      votacaoAtiva: votacaoData
    };
  } catch (err) {
    log.error("Erro fatal em buscarEstadoCompleto", { assembleiaId, error: err.message });
    // Retorna o mínimo possível para não quebrar o app completamente
    try {
      const basic = await buscarPorId(assembleiaId);
      if (basic) return { assembleia: basic, mesa: null, pedidosPalavra: [], propostas: [], quorumVigente: null, votacaoAtiva: null };
    } catch (inner) {}
    throw err; // Re-throw if even basic fails
  }
}

async function gerarDadosRelatorio(id) {
  const assembleia = await buscarPorId(id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

  const [mesa, quoruns, votacoes] = await Promise.all([
    buscarMesa(id),
    pool.query(`
      SELECT q.*, f.nome as gerado_por_nome
      FROM assembleia_quoruns q
      LEFT JOIN filiados f ON q.gerado_por_user_id = f.id
      WHERE q.assembleia_id = $1
      ORDER BY q.criado_em ASC
    `, [id]).then(r => r.rows),
    pool.query(`
      SELECT v.*, f.nome as iniciada_por_nome
      FROM assembleia_votacoes v
      LEFT JOIN filiados f ON v.iniciada_por_user_id = f.id
      WHERE v.assembleia_id = $1
      ORDER BY v.aberta_em ASC
    `, [id]).then(r => r.rows)
  ]);

  // Otimização Bolt: Resolve N+1 queries para quóruns e votações no relatório
  const quorumIds = quoruns.map(q => q.id);
  const votacaoIds = votacoes.map(v => v.id);

  const [allCheckins, allVotos] = await Promise.all([
    quorumIds.length > 0 ? pool.query(`
      SELECT c.assembleia_quorum_id, f.nome, c.registrado_em
      FROM assembleia_checkins c
      JOIN filiados f ON c.filiado_id = f.id
      WHERE c.assembleia_quorum_id = ANY($1)
      ORDER BY f.nome ASC
    `, [quorumIds]).then(r => r.rows) : Promise.resolve([]),
    votacaoIds.length > 0 ? pool.query(`
      SELECT v.votacao_id, v.filiado_id, f.nome, v.voto, v.registrado_em
      FROM assembleia_votos v
      JOIN filiados f ON v.filiado_id = f.id
      WHERE v.votacao_id = ANY($1)
      ORDER BY v.registrado_em DESC
    `, [votacaoIds]).then(r => r.rows) : Promise.resolve([])
  ]);

  // Agrupa checkins por quórum (O(M))
  const checkinsByQuorum = allCheckins.reduce((acc, c) => {
    if (!acc[c.assembleia_quorum_id]) acc[c.assembleia_quorum_id] = [];
    acc[c.assembleia_quorum_id].push(c);
    return acc;
  }, {});

  for (let q of quoruns) {
    q.presentes = checkinsByQuorum[q.id] || [];
  }

  // Agrupa votos por votação e calcula contagem (O(K))
  const votosByVotacao = allVotos.reduce((acc, v) => {
    if (!acc[v.votacao_id]) acc[v.votacao_id] = [];
    acc[v.votacao_id].push(v);
    return acc;
  }, {});

  for (let v of votacoes) {
    const nominals = votosByVotacao[v.id] || [];
    v.votosNominais = nominals;
    v.contagem = {
      SIM: nominals.filter(vote => vote.voto === 'SIM').length,
      NAO: nominals.filter(vote => vote.voto === 'NAO').length,
      ABSTENCAO: nominals.filter(vote => vote.voto === 'ABSTENCAO').length,
    };
    v.contagem.total = v.contagem.SIM + v.contagem.NAO + v.contagem.ABSTENCAO;
  }

  return {
    assembleia,
    mesa,
    quoruns,
    votacoes
  };
}

module.exports = {
  listar,
  buscarPorId,
  gerarDadosRelatorio,
  criar,
  abrir,
  iniciarExecucao,
  encerrar,
  registrarAuditoria,
  gerarQuorum,
  atualizarQuorum,
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
  concederPalavra,
  criarProposta,
  listarPropostas,
  iniciarVotacaoProposta,
  verificarElegibilidadePorQuorum,
  definirMesa,
  substituirMesa,
  buscarMesa,
  buscarEstadoCompleto,
  buscarDiagnostico,
  normalizarAssembleia
};
