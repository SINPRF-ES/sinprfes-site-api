// src/services/assembleias.service.js
const pool = require("../config/db");
const Textos = require("../utils/textos");
const log = require("../utils/log");
const { escapeHtml, generateUuid } = require("../utils/format");
const socket = require("../websocket/assembleia.socket");
const Canon = require("../../shared/canon");

const ASSEMBLEIA_COLUMNS = `
  id, tipo, titulo, pauta, estado, criado_por as criada_por_user_id, aberta_em, encerrada_em, criado_em,
  data_hora_inicio, edital_url, data_evento, hora_primeira_chamada, hora_segunda_chamada,
  edital_public_id, edital_resource_type, edital_type, edital_format, edital_drive_file_id,
  suspensao_motivo, data_hora_retorno
`;

/**
 * Normaliza dados de uma assembleia.
 */
function normalizarAssembleia(assembleia) {
  if (!assembleia) return null;

  // Nunca retorna link direto do Cloudinary para o cliente (Diretriz TAREFA 1)
  // Se existe um edital, apontamos para o nosso proxy autenticado.
  if (assembleia.edital_url || assembleia.edital_public_id || assembleia.edital_drive_file_id) {
    assembleia.edital_url = `/api/assembleias/${assembleia.id}/edital`;
  }

  return assembleia;
}

// Cache simples em memória para Mesa (Performance Audit)
const mesaCache = new Map();
const MESA_CACHE_TTL = 30000; // 30 segundos

/**
 * Registra um evento de auditoria no sistema de assembleias.
 * Tabela assembleia_auditoria é APPEND-ONLY: updates e deletes são proibidos por política de dados.
 */
async function registrarAuditoria(assembleiaId, userId, evento, payload, client = null) {
  const db = client || pool;
  const env = process.env.ASSEMBLEIA_ENV || "dev";
  try {
    // Otimização: Busca Mesa com cache para reduzir carga no DB em logs frequentes
    let mesa = mesaCache.get(assembleiaId);
    if (!mesa || (Date.now() - mesa._cachedAt > MESA_CACHE_TTL)) {
        const { rows } = await db.query(
            "SELECT presidente_user_id, vice_presidente_user_id, secretario_user_id, secretario_2_user_id FROM assembleia_mesa WHERE assembleia_id = $1",
            [assembleiaId]
        );
        mesa = rows[0] || { _none: true };
        mesa._cachedAt = Date.now();
        mesaCache.set(assembleiaId, mesa);
    }

    let actingAs = null;
    if (mesa && !mesa._none) {
      if (mesa.presidente_user_id === userId) {
        actingAs = "Presidente";
      } else if (mesa.vice_presidente_user_id === userId) {
        actingAs = "Por ordem do Presidente, o Vice-Presidente";
      } else if (mesa.secretario_user_id === userId) {
        actingAs = "Por ordem do Presidente, o 1º Secretário";
      } else if (mesa.secretario_2_user_id === userId) {
        actingAs = "Por ordem do Presidente, o 2º Secretário";
      }
    }

    const fullPayload = {
      ...payload,
      _env: env,
      _timestamp: new Date().toISOString(),
      _acting_as: actingAs
    };
    await db.query(
      "INSERT INTO assembleia_auditoria (id, assembleia_id, user_id, evento, payload) VALUES ($1, $2, $3, $4, $5)",
      [generateUuid(), assembleiaId, userId, evento, JSON.stringify(fullPayload)]
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
    edital_public_id, edital_resource_type, edital_type, edital_format, edital_drive_file_id
  } = dados;

  // Regra Canônica: Edital em PDF via Drive é obrigatório
  if (!edital_drive_file_id) {
      throw new Error("O edital em formato PDF (Biblioteca Digital) é obrigatório.");
  }

  // Sanitização contra XSS
  titulo = escapeHtml(titulo);
  pauta = escapeHtml(pauta);

  // Normalização do tipo para o padrão de banco (AGE/AGO) se necessário
  let tipoNorm = tipo;
  if (tipo === 'Assembleia Geral Ordinária') tipoNorm = 'AGO';
  if (tipo === 'Assembleia Geral Extraordinária') tipoNorm = 'AGE';

  const newId = generateUuid();
  const { rows } = await pool.query(
    `INSERT INTO assembleias (
        id, tipo, titulo, pauta, criado_por, data_hora_inicio, edital_url,
        data_evento, hora_primeira_chamada, hora_segunda_chamada, estado,
        edital_public_id, edital_resource_type, edital_type, edital_format,
        edital_drive_file_id
     )
     VALUES (
        $1, $2, $3, $4, $5, NULLIF($6, '')::TIMESTAMP, NULLIF($7, ''),
        NULLIF($8, '')::DATE, NULLIF($9, '')::TIME, NULLIF($10, '')::TIME, 'CRIADO',
        $11, $12, $13, $14, $15
     )
     RETURNING ${ASSEMBLEIA_COLUMNS}`,
    [
        newId, tipoNorm, titulo, pauta, criado_por, data_hora_inicio, edital_url,
        data_evento, hora_primeira_chamada, hora_segunda_chamada,
      edital_public_id, edital_resource_type, edital_type, edital_format,
      edital_drive_file_id
    ]
  );
  const nova = rows[0];
  await registrarAuditoria(nova.id, criado_por, 'ASSEMBLEIA_CRIADA', { tipo, titulo });
  return nova;
}

async function abrir(id, userId) {
  const assembleia = await buscarPorId(id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  if (assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.CRIADO) {
    throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (${assembleia.estado} -> EM_CREDENCIAMENTO)`);
  }

  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'EM_CREDENCIAMENTO', aberta_em = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  const atualizada = rows[0];
  await registrarAuditoria(id, userId, 'ASSEMBLEIA_ABERTA', { de: assembleia.estado, para: 'EM_CREDENCIAMENTO' });
  await registrarAuditoria(id, userId, 'TRANSICAO_STATUS', { de: assembleia.estado, para: 'EM_CREDENCIAMENTO' });
  return normalizarAssembleia(atualizada);
}

async function contarUsersAtivosParaQuorum(client = null) {
  const db = client || pool;
  // CANON: Apenas Membros do Conselho (CONSELHEIRO ou Presidente/Vice FENAPRF)
  // Sincronizado com Canon.isCouncilMember
  const { rows } = await db.query(
    `SELECT COUNT(*)::INTEGER as total
     FROM users
     WHERE arquivado_em IS NULL
       AND (
         perfil_acesso = 'CONSELHEIRO'
         OR (
           perfil_acesso = 'DIRETORIA'
           AND (
             cargo = 'Presidente da FENAPRF' OR cargo = 'Vice-Presidente da FENAPRF' OR
             cargo2 = 'Presidente da FENAPRF' OR cargo2 = 'Vice-Presidente da FENAPRF'
           )
         )
       )`
  );
  return parseInt(rows?.[0]?.total || 0);
}

/**
 * Realiza check-in automático para o emissor do token se ele for elegível.
 */
async function realizarAutoCheckin(client, quorumId, userId, tipoChamada) {
  if (!userId) return;

  const { rows: userRows } = await client.query(
    "SELECT perfil_acesso, cargo, cargo2 FROM users WHERE id = $1",
    [userId]
  );
  const user = userRows[0];
  if (!user) return false;

  const { rows: qRows } = await client.query("SELECT is_global FROM assembleia_quoruns WHERE id = $1", [quorumId]);
  const isGlobal = qRows[0]?.is_global;

  // CANON: Check-in Global para toda Gestão e Conselheiros.
  // Check-in de Quórum restrito ao Conselho de Representantes.
  const eligible = isGlobal
    ? Canon.canCheckInGlobal(user.perfil_acesso)
    : Canon.isCouncilMember(user);

  if (eligible) {
    const origem = tipoChamada === 'RECONTAGEM' ? 'AUTO_PRESIDENTE' : 'AUTO_GERADOR';
    await client.query(
      `INSERT INTO assembleia_checkins (id, assembleia_quorum_id, user_id, origem)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (assembleia_quorum_id, user_id) DO UPDATE SET registrado_em = NOW()`,
      [generateUuid(), quorumId, userId, origem]
    );
    return true;
  }
  return false;
}

async function iniciarExecucao(id, userId) {
  const assembleia = await buscarPorId(id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

  if (assembleia.estado === Canon.ASSEMBLEIA_ESTADOS.INICIADO) {
    return assembleia;
  }

  if (assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.EM_CREDENCIAMENTO) {
    throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (${assembleia.estado} -> INICIADO)`);
  }

  // Pré-condição: mesa definida
  const mesa = await buscarMesa(id);
  if (!mesa || !mesa.presidente_user_id) {
    throw new Error(Textos.ASSEMBLEIA.MESA_NAO_DEFINIDA);
  }

  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'INICIADO' WHERE id = $1 RETURNING *`,
    [id]
  );
  const atualizada = rows[0];
  await registrarAuditoria(id, userId, 'TRANSICAO_STATUS', { de: assembleia.estado, para: 'INICIADO' });
  return normalizarAssembleia(atualizada);
}

async function suspender(id, userId, motivo, dataHoraRetorno) {
  const assembleia = await buscarPorId(id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

  if (assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.INICIADO) {
    throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (${assembleia.estado} -> SUSPENSA)`);
  }

  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'SUSPENSA', suspensao_motivo = $1, data_hora_retorno = $2 WHERE id = $3 RETURNING *`,
    [escapeHtml(motivo), dataHoraRetorno, id]
  );
  const atualizada = rows[0];
  await registrarAuditoria(id, userId, 'ASSEMBLEIA_SUSPENSA', { motivo, data_hora_retorno: dataHoraRetorno });
  return normalizarAssembleia(atualizada);
}

async function retomar(id, userId) {
  const assembleia = await buscarPorId(id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

  if (assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.SUSPENSA) {
    throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (${assembleia.estado} -> INICIADO)`);
  }

  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'INICIADO', suspensao_motivo = NULL, data_hora_retorno = NULL WHERE id = $1 RETURNING *`,
    [id]
  );
  const atualizada = rows[0];
  await registrarAuditoria(id, userId, 'ASSEMBLEIA_RETOMADA', { de: 'SUSPENSA', para: 'INICIADO' });
  return normalizarAssembleia(atualizada);
}

async function encerrar(id, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: assRows } = await client.query(`SELECT estado FROM assembleias WHERE id = $1 FOR UPDATE`, [id]);
    const assembleia = assRows[0];
    if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

    if (assembleia.estado === Canon.ASSEMBLEIA_ESTADOS.ENCERRADO) {
      await client.query('COMMIT');
      return await buscarPorId(id);
    }

    if (assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.EM_CREDENCIAMENTO && assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.INICIADO && assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.SUSPENSA) {
      throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (${assembleia.estado} -> ENCERRADO)`);
    }

    // Estratégia A: encerrar votação ativa automaticamente
    const { rows: activeVotations } = await client.query(
      `SELECT id FROM assembleia_votacoes WHERE assembleia_id = $1 AND status = 'ATIVA' FOR UPDATE`,
      [id]
    );
    for (const v of activeVotations) {
      await client.query(
        `INSERT INTO assembleia_votos (votacao_id, user_id, voto)
         SELECT v.id, c.user_id, 'ABSTENCAO'
         FROM assembleia_votacoes v
         JOIN assembleia_checkins c ON v.quorum_snapshot_id = c.assembleia_quorum_id
         LEFT JOIN assembleia_votos vo ON v.id = vo.votacao_id AND c.user_id = vo.user_id
         WHERE v.id = $1 AND vo.id IS NULL
         ON CONFLICT (votacao_id, user_id) DO NOTHING`,
        [v.id]
      );
      await client.query(`UPDATE assembleia_votacoes SET status = 'ENCERRADA', finalizada_em = NOW() WHERE id = $1`, [v.id]);
      await registrarAuditoria(id, userId, 'VOTACAO_ENCERRADA', { votacao_id: v.id, motivo: 'ENCERRAMENTO_ASSEMBLEIA' }, client);
    }

    const { rows } = await client.query(
      `UPDATE assembleias SET estado = 'ENCERRADO', encerrada_em = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    const atualizada = rows[0];

    // Encerrar quórum vigente
    await client.query(
      `UPDATE assembleia_quoruns SET encerrado_em = NOW() WHERE assembleia_id = $1 AND encerrado_em IS NULL`,
      [id]
    );

    await registrarAuditoria(id, userId, 'ASSEMBLEIA_ENCERRADA', { de: assembleia.estado, para: 'ENCERRADO' }, client);
    await registrarAuditoria(id, userId, 'TRANSICAO_STATUS', { de: assembleia.estado, para: 'ENCERRADO' }, client);

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

    const { assembleia_id, gerado_por_user_id, tipo_chamada, observacao, forceNew, is_global } = dados;
    const { randomBytes } = require("crypto");
    let { token } = dados;

    // Canonização de Token: 10 chars alfanumérico para Global, 6 dígitos numéricos para Quórum
    if (!token) {
      if (is_global) {
        token = randomBytes(5).toString("hex").toUpperCase();
      } else {
        token = Math.floor(100000 + Math.random() * 900000).toString();
      }
    }

    // Lock na assembleia para garantir consistência de estado e evitar corridas
    const { rows: assRows } = await client.query(`SELECT estado FROM assembleias WHERE id = $1 FOR UPDATE`, [assembleia_id]);
    const assembleia = assRows[0];

    if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
    if (assembleia.estado === Canon.ASSEMBLEIA_ESTADOS.ENCERRADO) {
      throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    }

    // Se for Global, o estado muda para EM_CREDENCIAMENTO
    if (is_global && assembleia.estado === Canon.ASSEMBLEIA_ESTADOS.CRIADO) {
      await client.query("UPDATE assembleias SET estado = 'EM_CREDENCIAMENTO', aberta_em = NOW() WHERE id = $1", [assembleia_id]);
    }

    // Idempotência e Regras de Unicidade
    // Regra Global: Apenas 1 por assembleia, para sempre.
    if (is_global) {
      const { rows: existingGlobal } = await client.query(
        `SELECT id, token, criado_em, valido_ate, quorum_total_ativos, quorum_necessario, is_global
         FROM assembleia_quoruns
         WHERE assembleia_id = $1 AND is_global = TRUE`,
        [assembleia_id]
      );
      if (existingGlobal.length > 0) {
        const existing = existingGlobal[0];
        await realizarAutoCheckin(client, existing.id, gerado_por_user_id, tipo_chamada);
        await client.query('COMMIT');
        return { ...existing, isNew: false };
      }
    } else {
      // Regra Quórum: Se NÃO for forceNew e não for RECONTAGEM, pode retornar o ativo do mesmo tipo
      if (!forceNew && tipo_chamada !== 'RECONTAGEM') {
        const { rows: existingQuorum } = await client.query(
          `SELECT id, token, criado_em, valido_ate, quorum_total_ativos, quorum_necessario, is_global
           FROM assembleia_quoruns
           WHERE assembleia_id = $1 AND tipo_chamada = $2 AND encerrado_em IS NULL AND is_global = FALSE`,
          [assembleia_id, tipo_chamada]
        );
        if (existingQuorum.length > 0) {
          const existing = existingQuorum[0];
          await realizarAutoCheckin(client, existing.id, gerado_por_user_id, tipo_chamada);
          await client.query('COMMIT');
          return { ...existing, isNew: false };
        }
      }
    }

    const totalAtivos = await contarUsersAtivosParaQuorum(client);
    // 1ª Chamada: 50% + 1 dos ativos. Outras chamadas: qualquer número (0).
    let quorumNecessario = (tipo_chamada === 'PRIMEIRA') ? Math.floor(totalAtivos / 2) + 1 : 0;

    // Apenas Presidente pode solicitar RECONTAGEM
    if (tipo_chamada === 'RECONTAGEM') {
      const { rows: mesaRows } = await client.query(`SELECT presidente_user_id FROM assembleia_mesa WHERE assembleia_id = $1`, [assembleia_id]);
      if (!mesaRows[0] || mesaRows[0].presidente_user_id !== gerado_por_user_id) {
        throw new Error(Textos.ASSEMBLEIA.APENAS_PRESIDENTE);
      }
    }

    // Token collision check (evita colisões raras de tokens de 10 caracteres ativos)
    let attempts = 0;
    while (attempts < 5) {
      const { rows: collisionRows } = await client.query(
        `SELECT 1 FROM assembleia_quoruns WHERE token = $1 AND encerrado_em IS NULL`,
        [token]
      );
      if (collisionRows.length === 0) break;
      token = randomBytes(5).toString("hex").toUpperCase();
      attempts++;
    }

    // Encerrar quórum anterior antes de criar o novo (garante que só 1 esteja aberto por vez se for forceNew)
    // Se for um novo snapshot, ele "limpa" o anterior (snapshotting).
    // EXCEÇÃO: O QR Global não é encerrado por novos snapshots de quórum.
    if (!is_global) {
        await client.query(
            `UPDATE assembleia_quoruns SET encerrado_em = NOW() WHERE assembleia_id = $1 AND encerrado_em IS NULL AND is_global = FALSE`,
            [assembleia_id]
        );
    }

    // Regra Institucional: QR Global e Quórum Dinâmico não possuem validade temporal estrita (valido_ate IS NULL).
    // O Quórum Dinâmico permanece válido até o próximo ser gerado ou a assembleia encerrar.
    const validoAteValue = null;
    const newQuorumId = generateUuid();

    const { rows: qRows } = await client.query(
      `INSERT INTO assembleia_quoruns (id, assembleia_id, token, gerado_por_user_id, tipo_chamada, quorum_total_ativos, quorum_necessario, observacao, valido_ate, is_global)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, token, criado_em, valido_ate, quorum_total_ativos, quorum_necessario, tipo_chamada, is_global`,
      [newQuorumId, assembleia_id, token, gerado_por_user_id, tipo_chamada, totalAtivos, quorumNecessario, observacao, validoAteValue, !!is_global]
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
    `SELECT id, is_global, tipo_chamada FROM assembleia_quoruns
     WHERE assembleia_id = $1 AND token = $2 AND encerrado_em IS NULL
     ORDER BY criado_em DESC LIMIT 1`,
    [assembleiaId, token]
  );
  return rows[0];
}

async function contarPresentesNoQuorum(quorumId) {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::INTEGER as total FROM assembleia_checkins WHERE assembleia_quorum_id = $1",
    [quorumId]
  );
  return parseInt(rows[0].total || 0);
}

/**
 * Obtém informações de branch e hierarquia do membro delegando ao Canon.
 */
async function obterInfoBranchUser(userId, client = null) {
  const db = client || pool;
  // Prioriza tabela normalizada user_vinculos
  const { rows: vinculos } = await db.query(
    `SELECT branch, role, uf FROM user_vinculos
     WHERE user_id = $1 AND status = 'ATIVO'
     ORDER BY created_at DESC`,
    [userId]
  );

  // Fallback para campos legados em users
  const { rows: uRows } = await db.query("SELECT cargo, uf, cargo2, uf2, perfil_acesso FROM users WHERE id = $1", [userId]);
  const user = uRows[0];
  if (!user) return null;

  return Canon.obterInfoBranchUser({ ...user, vinculos });
}

async function realizarCheckin(dados) {
  const { assembleia_quorum_id, user_id, origem, assembleia_id } = dados;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: userRows } = await client.query("SELECT * FROM users WHERE id = $1", [user_id]);
    const userObj = userRows[0];
    if (!userObj) throw new Error(Textos.USERS.USER_NAO_ENCONTRADO);

    // Busca dados do Quorum
    const { rows: qRows } = await client.query("SELECT is_global FROM assembleia_quoruns WHERE id = $1", [assembleia_quorum_id]);
    const isGlobal = qRows[0]?.is_global;

    if (isGlobal) {
        const perfil = (userObj.perfil_acesso || "").toUpperCase();
        if (perfil !== 'DIRETORIA' && perfil !== 'CONSELHEIRO') {
            throw new Error("Perfil sem permissão para credenciamento.");
        }
      // Regra: Credenciamento único por evento
      const { rows: existingGlobalCheckin } = await client.query(
        `SELECT c.id
         FROM assembleia_checkins c
         JOIN assembleia_quoruns q ON c.assembleia_quorum_id = q.id
         WHERE q.assembleia_id = $1 AND q.is_global = TRUE AND c.user_id = $2`,
        [assembleia_id, user_id]
      );
      if (existingGlobalCheckin.length > 0) {
        throw new Error("Você já efetuou seu credenciamento para este evento.");
      }
    }

    // Regra Hierárquica por Branch (apenas para QUORUM, não GLOBAL)
    if (!isGlobal) {
      // CANON: Quórum Dinâmico/Snapshot restrito ao Conselho de Representantes.
      if (!Canon.isCouncilMember(userObj)) {
          throw new Error("Apenas membros do Conselho de Representantes (Conselheiros e Presidente/Vice FENAPRF) participam deste quórum.");
      }

      const info = await obterInfoBranchUser(user_id, client);
      if (info) {
        // Busca se já existe alguém do mesmo branch/UF no quorum
        const { rows: branchCheckins } = await client.query(
          `SELECT c.user_id, f.name as nome, f.cargo, f.uf
           FROM assembleia_checkins c
           JOIN users f ON c.user_id = f.id
           WHERE c.assembleia_quorum_id = $1`,
          [assembleia_quorum_id]
        );

        for (const bc of branchCheckins) {
          const bcInfo = await obterInfoBranchUser(bc.user_id, client);
          if (bcInfo && bcInfo.branch === info.branch && bcInfo.uf === info.uf && bc.user_id !== user_id) {
            // Conflito no mesmo branch da mesma UF
            if (info.rank < bcInfo.rank) {
              // Superior está entrando, subordinado está presente -> SUBSTITUIÇÃO
              const votacaoAtiva = await buscarVotacaoAtiva(assembleia_id);
              if (votacaoAtiva) {
                // LOCK DURANTE VOTAÇÃO: Cria pendência
                await client.query(
                  `INSERT INTO assembleia_checkins_pendentes (id, assembleia_id, quorum_id, user_id_superior, user_id_subordinado, branch)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT DO NOTHING`,
                  [generateUuid(), assembleia_id, assembleia_quorum_id, user_id, bc.user_id, info.branch]
                );
                await registrarAuditoria(assembleia_id, user_id, 'SUBSTITUICAO_PENDENTE_VOTACAO', { superior_id: user_id, subordinado_id: bc.user_id, branch: info.branch, uf: info.uf }, client);

                // WebSocket Emit for Pending Change
                const msgPending = `Seu ${info.role === 'PRESIDENTE' ? 'presidente' : 'delegado representante'} entrou; a troca ocorrerá ao final da votação em andamento.`;
                const payloadPending = {
                  uf: info.uf,
                  branch: info.branch,
                  removedUserId: bc.user_id,
                  subordinado_id: bc.user_id, // Compatibilidade mobile
                  addedUserId: user_id,
                  reason: 'SUPERIOR_ENTERED',
                  lockedUntilVoteEnd: true,
                  message: msgPending
                };
                socket.emitEvent(assembleia_id, 'assembleia:quorum_branch_changed', payloadPending);
                socket.emitEvent(assembleia_id, 'SUBSTITUICAO_BRANCH', payloadPending);

                await client.query('COMMIT');
                return { success: true, status: 'PENDING_VOTATION' };
              } else {
                // Substituição imediata
                await client.query("DELETE FROM assembleia_checkins WHERE assembleia_quorum_id = $1 AND user_id = $2", [assembleia_quorum_id, bc.user_id]);
                await registrarAuditoria(assembleia_id, user_id, 'SUBSTITUICAO_BRANCH', { superior_id: user_id, subordinado_id: bc.user_id, branch: info.branch, uf: info.uf }, client);

                // WebSocket Emit for Immediate Change
                const msg = `Seu ${info.role === 'PRESIDENTE' ? 'presidente' : 'delegado representante'} entrou na sessão, então você foi retirado do quorum.`;
                const payload = {
                  uf: info.uf,
                  branch: info.branch,
                  removedUserId: bc.user_id,
                  subordinado_id: bc.user_id, // Compatibilidade mobile
                  addedUserId: user_id,
                  reason: 'SUPERIOR_ENTERED',
                  lockedUntilVoteEnd: false,
                  message: msg
                };
                socket.emitEvent(assembleia_id, 'assembleia:quorum_branch_changed', payload);
                socket.emitEvent(assembleia_id, 'SUBSTITUICAO_BRANCH', payload);
              }
            } else if (info.rank > bcInfo.rank) {
              // Subordinado tentando entrar enquanto superior está presente -> BLOQUEAR
              const errorMsg = info.branch === 'CONSELHEIRO' ? Textos.ASSEMBLEIA.PRESIDENTE_PRESENTE : Textos.ASSEMBLEIA.DELEGADO_PRESENTE;
              const err = new Error(errorMsg);
              err.status = 409;
              throw err;
            }
          }
        }
      }
    }

    // Realiza o Check-in
    const { rows: existing } = await client.query(
      `SELECT id FROM assembleia_checkins WHERE assembleia_quorum_id = $1 AND user_id = $2`,
      [assembleia_quorum_id, user_id]
    );

    const { rows } = await client.query(
      `INSERT INTO assembleia_checkins (id, assembleia_quorum_id, user_id, origem)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (assembleia_quorum_id, user_id) DO UPDATE SET registrado_em = NOW()
       RETURNING id`,
      [generateUuid(), assembleia_quorum_id, user_id, origem]
    );
    const res = rows[0];

    if (assembleia_id && existing.length === 0) {
      await registrarAuditoria(assembleia_id, user_id, 'CHECKIN_REALIZADO', { assembleia_quorum_id, origem }, client);
    }

    await client.query('COMMIT');
    return res;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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
    if (assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.INICIADO) {
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
      `INSERT INTO assembleia_votacoes (id, assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, status, iniciada_por_user_id, aberta_em)
       VALUES ($1, $2, $3, $4, $5, $6, 'ATIVA', $7, NOW())
       RETURNING *, (aberta_em + interval '1 second' * duracao_segundos) as encerra_em`,
      [generateUuid(), assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, iniciada_por_user_id]
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

async function verificarElegibilidade(votacaoId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM assembleia_checkins c
     JOIN assembleia_votacoes v ON c.assembleia_quorum_id = v.quorum_snapshot_id
     WHERE v.id = $1 AND c.user_id = $2`,
    [votacaoId, userId]
  );
  return rows.length > 0;
}

async function contarElegiveisNaVotacao(votacaoId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::INTEGER as total
     FROM assembleia_checkins c
     JOIN assembleia_votacoes v ON c.assembleia_quorum_id = v.quorum_snapshot_id
     WHERE v.id = $1`,
    [votacaoId]
  );
  return parseInt(rows[0].total || 0);
}

async function verificarElegibilidadePorQuorum(quorumId, userId, client = null) {
  const db = client || pool;
  const { rows } = await db.query(
    `SELECT 1 FROM assembleia_checkins WHERE assembleia_quorum_id = $1 AND user_id = $2`,
    [quorumId, userId]
  );
  return rows.length > 0;
}

async function registrarVoto(votacaoId, userId, voto, assembleiaId) {
  if (voto !== 'SIM' && voto !== 'NAO') {
    throw new Error("Apenas votos SIM ou NAO são permitidos manualmente.");
  }

  const { rows: userRows } = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  const user = userRows[0];

  if (!Canon.isCouncilMember(user)) {
    throw new Error("Voto restrito aos membros do Conselho de Representantes.");
  }

  const { rows } = await pool.query(
    `INSERT INTO assembleia_votos (id, votacao_id, user_id, voto)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (votacao_id, user_id) DO UPDATE SET voto = $4, registrado_em = NOW()
     RETURNING *`,
    [generateUuid(), votacaoId, userId, voto]
  );
  const res = rows[0];
  if (assembleiaId) {
    await registrarAuditoria(assembleiaId, userId, 'VOTO_REGISTRADO', { votacao_id: votacaoId, voto });
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
    `SELECT v.user_id, f.name as nome, v.voto, v.registrado_em
     FROM assembleia_votos v
     JOIN users f ON v.user_id = f.id
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
      `INSERT INTO assembleia_votos (votacao_id, user_id, voto)
       SELECT v.id, c.user_id, 'ABSTENCAO'
       FROM assembleia_votacoes v
       JOIN assembleia_checkins c ON v.quorum_snapshot_id = c.assembleia_quorum_id
       LEFT JOIN assembleia_votos vo ON v.id = vo.votacao_id AND c.user_id = vo.user_id
       WHERE v.id = $1 AND vo.id IS NULL
       ON CONFLICT (votacao_id, user_id) DO NOTHING`,
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

    // Processar substituições pendentes (Hierarquia Branch)
    const { rows: pendentes } = await client.query(
      "SELECT * FROM assembleia_checkins_pendentes WHERE assembleia_id = $1",
      [votacao.assembleia_id]
    );

    for (const p of pendentes) {
      // Remove subordinado
      await client.query(
        "DELETE FROM assembleia_checkins WHERE assembleia_quorum_id = $1 AND user_id = $2",
        [p.quorum_id, p.user_id_subordinado]
      );
      // Garante que superior está dentro
      await client.query(
        `INSERT INTO assembleia_checkins (id, assembleia_quorum_id, user_id, origem)
         VALUES ($1, $2, $3, 'AUTO_SUBSTITUICAO_POS_VOTO')
         ON CONFLICT (assembleia_quorum_id, user_id) DO UPDATE SET registrado_em = NOW()`,
        [generateUuid(), p.quorum_id, p.user_id_superior]
      );

      // Busca nomes para o WebSocket
      const { rows: names } = await client.query(
        "SELECT id, name FROM users WHERE id IN ($1, $2)",
        [p.user_id_superior, p.user_id_subordinado]
      );
      const sup = names.find(n => n.id === p.user_id_superior);
      const sub = names.find(n => n.id === p.user_id_subordinado);

      const msg = `Votação encerrada. Seu titular entrou na sessão, então você foi retirado do quorum.`;
      const payload = {
        uf: sup?.uf || sub?.uf,
        branch: p.branch,
        removedUserId: p.user_id_subordinado,
        subordinado_id: p.user_id_subordinado, // Compatibilidade mobile
        addedUserId: p.user_id_superior,
        reason: 'VOTATION_ENDED_SUBSTITUTION',
        lockedUntilVoteEnd: false,
        message: msg
      };

      socket.emitEvent(votacao.assembleia_id, 'assembleia:quorum_branch_changed', payload);
      socket.emitEvent(votacao.assembleia_id, 'SUBSTITUICAO_BRANCH', payload);

      await registrarAuditoria(votacao.assembleia_id, p.user_id_superior, 'SUBSTITUICAO_BRANCH_APLICADA', { superior_id: p.user_id_superior, subordinado_id: p.user_id_subordinado, branch: p.branch }, client);
    }

    // Limpa pendências
    await client.query("DELETE FROM assembleia_checkins_pendentes WHERE assembleia_id = $1", [votacao.assembleia_id]);

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

async function registrarRejeicaoMesa(assembleiaId, userId, cargo, client = null) {
  const db = client || pool;
  await db.query(
    "INSERT INTO assembleia_mesa_rejeicoes (id, assembleia_id, user_id, cargo) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
    [generateUuid(), assembleiaId, userId, cargo]
  );
}

async function verificarRejeicaoMesa(assembleiaId, userId, cargo) {
  const { rows } = await pool.query(
    "SELECT 1 FROM assembleia_mesa_rejeicoes WHERE assembleia_id = $1 AND user_id = $2 AND cargo = $3",
    [assembleiaId, userId, cargo]
  );
  return rows.length > 0;
}

async function definirMesa(dados) {
  const {
    assembleia_id,
    presidente_user_id,
    vice_presidente_user_id,
    secretario_user_id,
    secretario_2_user_id,
    definida_por_user_id
  } = dados;

  const ids = [presidente_user_id, vice_presidente_user_id, secretario_user_id, secretario_2_user_id];
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw new Error("Os membros da mesa devem ser pessoas diferentes");
  }

  // Verificar se algum já foi rejeitado para o mesmo cargo
  const rejeicoes = await Promise.all([
    verificarRejeicaoMesa(assembleia_id, presidente_user_id, 'PRESIDENTE'),
    verificarRejeicaoMesa(assembleia_id, vice_presidente_user_id, 'VICE_PRESIDENTE'),
    verificarRejeicaoMesa(assembleia_id, secretario_user_id, 'PRIMEIRO_SECRETARIO'),
    verificarRejeicaoMesa(assembleia_id, secretario_2_user_id, 'SEGUNDO_SECRETARIO')
  ]);

  if (rejeicoes.some(r => r)) {
    throw new Error("Um ou mais indicados já foram rejeitados para os cargos propostos neste evento.");
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: assRows } = await client.query(`SELECT estado FROM assembleias WHERE id = $1 FOR UPDATE`, [assembleia_id]);
    const assembleia = assRows[0];
    if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

    if (assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.EM_CREDENCIAMENTO && assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.INICIADO) {
      throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    }

    const { rows: mesaExistente } = await client.query(`SELECT estabelecida_em FROM assembleia_mesa WHERE assembleia_id = $1`, [assembleia_id]);
    if (mesaExistente[0]?.estabelecida_em && assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.INICIADO) {
       // Se já está estabelecida, só permite re-definição se for via substituição ou se for a transição inicial
      throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (Mesa já estabelecida.)`);
    }

    // Validar presença dos escolhidos no quórum GLOBAL
    const { rows: qGlobalRows } = await client.query(
        "SELECT id FROM assembleia_quoruns WHERE assembleia_id = $1 AND is_global = TRUE",
        [assembleia_id]
    );
    const quorumGlobal = qGlobalRows[0];
    if (!quorumGlobal) throw new Error("O Check-in Global ainda não foi aberto.");

    const checkins = await client.query(
        "SELECT user_id FROM assembleia_checkins WHERE assembleia_quorum_id = $1 AND user_id = ANY($2)",
        [quorumGlobal.id, ids]
    ).then(r => r.rows.map(row => row.user_id));

    const missing = [];
    if (!checkins.includes(presidente_user_id)) missing.push("Presidente");
    if (!checkins.includes(vice_presidente_user_id)) missing.push("Vice-Presidente");
    if (!checkins.includes(secretario_user_id)) missing.push("1º Secretário");
    if (!checkins.includes(secretario_2_user_id)) missing.push("2º Secretário");

    if (missing.length > 0) {
        throw new Error(`Os seguintes indicados não realizaram Check-in Global: ${missing.join(", ")}`);
    }

    const { rows } = await client.query(
      `INSERT INTO assembleia_mesa (id, assembleia_id, presidente_user_id, vice_presidente_user_id, secretario_user_id, secretario_2_user_id, definida_por_user_id, definida_em, estabelecida_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (assembleia_id) DO UPDATE SET
         presidente_user_id = $3,
         vice_presidente_user_id = $4,
         secretario_user_id = $5,
         secretario_2_user_id = $6,
         definida_por_user_id = $7,
         definida_em = NOW(),
         estabelecida_em = COALESCE(assembleia_mesa.estabelecida_em, NOW())
       RETURNING *`,
      [generateUuid(), assembleia_id, presidente_user_id, vice_presidente_user_id, secretario_user_id, secretario_2_user_id, definida_por_user_id]
    );
    const mesa = rows[0];
    await registrarAuditoria(assembleia_id, definida_por_user_id, 'MESA_DEFINIDA', { presidente_user_id, vice_presidente_user_id, secretario_user_id, secretario_2_user_id }, client);

    // Transição para INICIADO
    await client.query(
      "UPDATE assembleias SET estado = 'INICIADO' WHERE id = $1",
      [assembleia_id]
    );
    await registrarAuditoria(assembleia_id, definida_por_user_id, 'ASSEMBLEIA_INICIADA', { estado: 'INICIADO', motivo: 'MESA_DEFINIDA' }, client);

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
  let {
    assembleia_id,
    presidente_user_id,
    vice_presidente_user_id,
    secretario_user_id,
    secretario_2_user_id,
    substituida_por_user_id,
    justificativa
  } = dados;

  // Sanitização contra XSS
  justificativa = escapeHtml(justificativa);

  const ids = [presidente_user_id, vice_presidente_user_id, secretario_user_id, secretario_2_user_id];
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw new Error("Os membros da mesa devem ser pessoas diferentes");
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

    if (assembleia.estado === Canon.ASSEMBLEIA_ESTADOS.ENCERRADO) {
      throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    }

    const mesaAnterior = await buscarMesa(assembleia_id);

    // Validar presença dos escolhidos no quórum GLOBAL
    const { rows: qGlobalRows } = await client.query(
        "SELECT id FROM assembleia_quoruns WHERE assembleia_id = $1 AND is_global = TRUE",
        [assembleia_id]
    );
    const quorumGlobal = qGlobalRows[0];
    if (!quorumGlobal) throw new Error("O Check-in Global ainda não foi aberto.");

    const checkins = await client.query(
        "SELECT user_id FROM assembleia_checkins WHERE assembleia_quorum_id = $1 AND user_id = ANY($2)",
        [quorumGlobal.id, ids]
    ).then(r => r.rows.map(row => row.user_id));

    if (checkins.length < ids.length) {
        throw new Error("Todos os novos membros da mesa devem ter realizado Check-in Global.");
    }

    const { rows } = await client.query(
      `UPDATE assembleia_mesa SET
         presidente_user_id = $2,
         vice_presidente_user_id = $3,
         secretario_user_id = $4,
         secretario_2_user_id = $5,
         definida_por_user_id = $6,
         definida_em = NOW()
       WHERE assembleia_id = $1
       RETURNING *`,
      [assembleia_id, presidente_user_id, vice_presidente_user_id, secretario_user_id, secretario_2_user_id, substituida_por_user_id]
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
    `SELECT m.*,
            fp.name as presidente_nome,
            fv.name as vice_presidente_nome,
            fs.name as secretario_nome,
            fs2.name as secretario_2_nome
     FROM assembleia_mesa m
     LEFT JOIN users fp ON m.presidente_user_id = fp.id
     LEFT JOIN users fv ON m.vice_presidente_user_id = fv.id
     LEFT JOIN users fs ON m.secretario_user_id = fs.id
     LEFT JOIN users fs2 ON m.secretario_2_user_id = fs2.id
     WHERE m.assembleia_id = $1`,
    [assembleiaId]
  );
  return rows[0];
}

async function pedirPalavra(assembleiaId, userId) {
  const assembleia = await buscarPorId(assembleiaId);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  if (assembleia.estado === Canon.ASSEMBLEIA_ESTADOS.ENCERRADO) {
    throw new Error("Assembleia encerrada");
  }

  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(ordem), 0) as max_ordem FROM assembleia_pedidos_palavra WHERE assembleia_id = $1`,
    [assembleiaId]
  );
  const novaOrdem = maxRows[0].max_ordem + 1;

  const { rows } = await pool.query(
    `INSERT INTO assembleia_pedidos_palavra (id, assembleia_id, user_id, ordem, status)
     VALUES ($1, $2, $3, $4, 'PENDENTE')
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [generateUuid(), assembleiaId, userId, novaOrdem]
  );
  return rows[0];
}

async function listarPedidosPalavra(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT p.*, f.name as user_nome, f.avatar_url
     FROM assembleia_pedidos_palavra p
     JOIN users f ON p.user_id = f.id
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
    await registrarAuditoria(assembleiaId, userId, 'PALAVRA_CONCEDIDA', { pedido_id: pedidoId, user_id: rows[0].user_id });
  }
  return rows[0];
}

async function criarProposta(dados) {
  const { assembleia_id, autor_id, pauta } = dados;
  let { titulo } = dados;

  const { rows: uRows } = await pool.query("SELECT * FROM users WHERE id = $1", [autor_id]);
  if (!Canon.isCouncilMember(uRows[0])) {
      throw new Error("Propostas são restritas aos membros do Conselho de Representantes.");
  }

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

    // Permitir propostas conforme novo fluxo
    if (assembleia.estado === Canon.ASSEMBLEIA_ESTADOS.ENCERRADO) {
      throw new Error("Assembleia encerrada");
    }

    if (assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.EM_CREDENCIAMENTO && assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.INICIADO && assembleia.estado !== Canon.ASSEMBLEIA_ESTADOS.SUSPENSA) {
      throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (Estado: ${assembleia.estado})`);
    }

    const { rows } = await client.query(
      `INSERT INTO assembleia_propostas (id, assembleia_id, autor_id, titulo, descricao, status)
       VALUES ($1, $2, $3, $4, $5, 'ATIVA')
       RETURNING *`,
      [generateUuid(), assembleia_id, autor_id, titulo.trim(), pautaSanitizada.trim()]
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
    `SELECT p.*, f.name as autor_nome, f.avatar_url
     FROM assembleia_propostas p
     JOIN users f ON p.autor_id = f.id
     WHERE p.assembleia_id = $1
     ORDER BY p.criado_em ASC`,
    [assembleiaId]
  );
  return rows;
}

async function confirmarBranchProposta(assembleiaId, propostaId, userId, acao) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: propRows } = await client.query(
      `SELECT * FROM assembleia_propostas WHERE id = $1 AND assembleia_id = $2 FOR UPDATE`,
      [propostaId, assembleiaId]
    );
    const proposta = propRows[0];
    if (!proposta) throw new Error("Proposta não encontrada.");

    if (acao === 'MANTER') {
      await client.query(
        "UPDATE assembleia_propostas SET autor_id = $1 WHERE id = $2",
        [userId, propostaId]
      );
      await registrarAuditoria(assembleiaId, userId, 'PROPOSTA_MANTIDA_POR_SUBSTITUICAO_BRANCH', { proposta_id: propostaId, acao: 'MANTER' }, client);
    } else {
      await client.query(
        "UPDATE assembleia_propostas SET status = 'CANCELADA_BRANCH', retirada_em = NOW() WHERE id = $1",
        [propostaId]
      );
      await registrarAuditoria(assembleiaId, userId, 'PROPOSTA_RETIRADA_POR_SUBSTITUICAO_BRANCH', { proposta_id: propostaId, acao: 'CANCELAR' }, client);
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
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

    // Regra: se o autor da proposta não responder o check-in da votação, a proposta deve ser retirada automaticamente
    const autorPresente = await verificarElegibilidadePorQuorum(quorum.id, proposta.autor_id, client);
    if (!autorPresente) {
        const motivo = 'autor ausente da votação';
        await client.query(
            `UPDATE assembleia_propostas
             SET status = 'RETIRADA', motivo_retirada = $1, retirada_em = NOW()
             WHERE id = $2`,
            [motivo, propostaId]
        );
        await registrarAuditoria(assembleiaId, userId, 'PROPOSTA_RETIRADA_AUTOMATICAMENTE', {
            proposta_id: propostaId,
            autor_id: proposta.autor_id,
            motivo
        }, client);

        await client.query('COMMIT');
        return { status: 'RETIRADA_AUTOR_AUSENTE', proposta_id: propostaId };
    }

    // Criar a votação baseada na proposta
    const votacao = await criarVotacao({
      assembleia_id: assembleiaId,
      quorum_snapshot_id: quorum.id,
      titulo: `Votação: ${proposta.titulo}`,
      descricao: proposta.descricao,
      duracao_segundos: 120, // Canonização: 120 segundos padrão
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
  if (assembleia.estado === Canon.ASSEMBLEIA_ESTADOS.INICIADO) {
    if (!mesa) inconsistencias.push("Mesa não definida em assembleia iniciada.");
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

async function buscarEstadoResumido(assembleiaId) {
  try {
    const [assembleia, ultimoQuorum, votacaoAtiva] = await Promise.all([
      pool.query(`SELECT estado FROM assembleias WHERE id = $1`, [assembleiaId]).then(r => r.rows[0]),
      buscarUltimoQuorum(assembleiaId).catch(() => null),
      buscarVotacaoAtiva(assembleiaId).catch(() => null)
    ]);

    if (!assembleia) return null;

    let totalPresentes = 0;
    if (ultimoQuorum) {
      const { rows } = await pool.query(
        "SELECT COUNT(*)::INTEGER as total FROM assembleia_checkins WHERE assembleia_quorum_id = $1",
        [ultimoQuorum.id]
      );
      totalPresentes = parseInt(rows[0].total);
    }

    let votacaoResumo = null;
    if (votacaoAtiva) {
        const [contagem, votos] = await Promise.all([
            contarVotos(votacaoAtiva.id),
            listarVotosNominais(votacaoAtiva.id)
        ]);
        const fim = new Date(votacaoAtiva.encerra_em).getTime();
        const agora = new Date().getTime();
        const tempoRestante = Math.max(0, Math.floor((fim - agora) / 1000));

        votacaoResumo = {
            id: votacaoAtiva.id,
            titulo: votacaoAtiva.titulo,
            status: votacaoAtiva.status,
            tempoRestanteSegundos: tempoRestante,
            contagem,
            votos
        };
    }

    return {
      assembleia: { id: assembleiaId, estado: assembleia.estado },
      quorumVigente: ultimoQuorum ? {
        id: ultimoQuorum.id,
        token: ultimoQuorum.token, // O controller deve filtrar se o membro pode ver
        total: totalPresentes,
        tipo_chamada: ultimoQuorum.tipo_chamada,
        gerado_por_user_id: ultimoQuorum.gerado_por_user_id,
        criado_em: ultimoQuorum.criado_em
      } : null,
      votacaoAtiva: votacaoResumo,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    log.error("Erro em buscarEstadoResumido", { assembleiaId, error: err.message });
    return null;
  }
}

async function buscarEstadoCompleto(assembleiaId, userId = null) {
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
        userId ? verificarElegibilidade(votacaoAtiva.id, userId).catch(() => false) : Promise.resolve(false),
        userId ? verificarElegibilidadePorQuorum(votacaoAtiva.quorum_snapshot_id, userId).catch(() => false) : Promise.resolve(false)
      ]));
    }

    if (ultimoQuorum && ultimoQuorum.id) {
      quorumTaskIdx = subTasks.length;
      subTasks.push(pool.query(
        `SELECT f.id, f.name as nome, f.avatar_url, c.registrado_em
         FROM assembleia_checkins c
         JOIN users f ON c.user_id = f.id
         WHERE c.assembleia_quorum_id = $1
         ORDER BY f.name ASC`,
        [ultimoQuorum.id]
      ).catch(() => ({ rows: [] })));
    }

    const subResults = await Promise.all(subTasks);

    if (votacaoTaskIdx !== -1) {
      const [contagem, votos, elegivel, presencaNoQuorum] = subResults[votacaoTaskIdx];

      let jaVotou = false;
      let motivo_inelegibilidade = null;

      if (userId) {
        if (!elegivel) {
          motivo_inelegibilidade = !presencaNoQuorum ? "Ausente na chamada de quórum deste item." : "Restrição de elegibilidade técnica.";
        } else {
          jaVotou = (votos || []).some(v => v.user_id === userId);
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
      if (userId) {
        userHasCheckedIn = presentesNominais.some(p => p.id === userId);
      }
    }

    // Verificação de Propostas Pendentes de Branch (A.2)
    let propostaPendenteBranch = null;
    if (userId && ultimoQuorum) {
      const info = await obterInfoBranchUser(userId);
      if (info && info.rank === 1) { // Titular
        const propPendentes = (propostas || []).filter(p => p.status === 'ATIVA');
        for (const p of propPendentes) {
          const estaNoQuorum = presentesNominais.some(pres => pres.id === p.autor_id);
          if (!estaNoQuorum) {
            const pInfo = await obterInfoBranchUser(p.autor_id);
            if (pInfo && pInfo.branch === info.branch && pInfo.uf === info.uf) {
              propostaPendenteBranch = {
                id: p.id,
                titulo: p.titulo,
                autor_nome: p.autor_nome
              };
              break;
            }
          }
        }
      }
    }

    return {
      assembleia,
      mesa: mesa || null,
      pedidosPalavra: pedidosPalavra || [],
      propostas: propostas || [],
      proposta_pendente_branch: propostaPendenteBranch,
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

  const [mesa, quoruns, votacoes, propostas, presentesGlobal, auditoria, pedidosPalavra] = await Promise.all([
    buscarMesa(id),
    pool.query(`
      SELECT q.*, f.name as gerado_por_nome
      FROM assembleia_quoruns q
      LEFT JOIN users f ON q.gerado_por_user_id = f.id
      WHERE q.assembleia_id = $1
      ORDER BY q.criado_em ASC
    `, [id]).then(r => r.rows),
    pool.query(`
      SELECT v.*, f.name as iniciada_por_nome
      FROM assembleia_votacoes v
      LEFT JOIN users f ON v.iniciada_por_user_id = f.id
      WHERE v.assembleia_id = $1
      ORDER BY v.aberta_em ASC
    `, [id]).then(r => r.rows),
    pool.query(`
      SELECT p.*, f.name as autor_nome
      FROM assembleia_propostas p
      LEFT JOIN users f ON p.autor_id = f.id
      WHERE p.assembleia_id = $1
      ORDER BY p.criado_em ASC
    `, [id]).then(r => r.rows),
    pool.query(`
      SELECT COUNT(DISTINCT c.user_id)::INTEGER as total
      FROM assembleia_checkins c
      JOIN assembleia_quoruns q ON c.assembleia_quorum_id = q.id
      WHERE q.assembleia_id = $1
    `, [id]).then(r => r.rows[0]),
    pool.query(`
      SELECT a.*, f.name as user_nome
      FROM assembleia_auditoria a
      LEFT JOIN users f ON a.user_id = f.id
      WHERE a.assembleia_id = $1
      ORDER BY a.criado_em ASC
    `, [id]).then(r => r.rows),
    pool.query(`
      SELECT p.*, f.name as user_nome
      FROM assembleia_pedidos_palavra p
      LEFT JOIN users f ON p.user_id = f.id
      WHERE p.assembleia_id = $1
      ORDER BY p.ordem ASC
    `, [id]).then(r => r.rows)
  ]);

  // Otimização Bolt: Resolve N+1 queries para quóruns e votações no relatório
  const quorumIds = quoruns.map(q => q.id);
  const votacaoIds = votacoes.map(v => v.id);

  const [allCheckins, allVotos] = await Promise.all([
    quorumIds.length > 0 ? pool.query(`
      SELECT c.assembleia_quorum_id, f.name as nome, c.registrado_em
      FROM assembleia_checkins c
      JOIN users f ON c.user_id = f.id
      WHERE c.assembleia_quorum_id = ANY($1)
      ORDER BY f.name ASC
    `, [quorumIds]).then(r => r.rows) : Promise.resolve([]),
    votacaoIds.length > 0 ? pool.query(`
      SELECT v.votacao_id, v.user_id, f.name as nome, v.voto, v.registrado_em
      FROM assembleia_votos v
      JOIN users f ON v.user_id = f.id
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
    votacoes,
    propostas,
    auditoria,
    pedidosPalavra,
    presentes_total: parseInt(presentesGlobal?.total || 0)
  };
}

async function buscarGlobalAtivo() {
  const query = `
    SELECT q.id, q.token, q.assembleia_id, a.titulo as assembleia_titulo
    FROM assembleia_quoruns q
    JOIN assembleias a ON q.assembleia_id = a.id
    WHERE q.is_global = TRUE
      AND q.encerrado_em IS NULL
      AND a.estado != 'ENCERRADO'
    ORDER BY q.criado_em DESC
    LIMIT 1
  `;
  const { rows } = await pool.query(query);
  return rows[0] || null;
}

async function buscarGlobalPorAssembleia(assembleiaId) {
  const query = `
    SELECT id, token, criado_em, is_global
    FROM assembleia_quoruns
    WHERE assembleia_id = $1 AND is_global = TRUE
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [assembleiaId]);
  return rows[0] || null;
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
  contarElegiveisNaVotacao,
  listarVotosNominais,
  finalizarVotacao,
  pedirPalavra,
  listarPedidosPalavra,
  concederPalavra,
  criarProposta,
  listarPropostas,
  confirmarBranchProposta,
  iniciarVotacaoProposta,
  verificarElegibilidadePorQuorum,
  definirMesa,
  substituirMesa,
  suspender,
  retomar,
  registrarRejeicaoMesa,
  verificarRejeicaoMesa,
  buscarMesa,
  buscarEstadoCompleto,
  contarPresentesNoQuorum,
  buscarEstadoResumido,
  buscarDiagnostico,
  normalizarAssembleia,
  buscarGlobalAtivo,
  buscarGlobalPorAssembleia
};
