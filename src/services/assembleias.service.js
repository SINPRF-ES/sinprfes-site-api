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
  return rows[0];
}

async function abrir(id) {
  const assembleia = await buscarPorId(id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  if (assembleia.estado !== ASSEMBLEIA_STATES.CRIADA) {
    throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (${assembleia.estado} -> ABERTA)`);
  }

  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'ABERTA', aberta_em = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

async function contarFiliadosAtivosParaQuorum() {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as total
     FROM filiados
     WHERE arquivado_em IS NULL
       AND perfil_acesso IN ('DIRETORIA', 'FILIADO', 'ORGANIZADOR')`
  );
  return parseInt(rows[0].total);
}

async function iniciarExecucao(id) {
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
  if (!quorumVigente) throw new Error("Não há quórum ativo");

  const [presencaPresidente, presencaSecretario] = await Promise.all([
    verificarElegibilidadePorQuorum(quorumVigente.id, mesa.presidente_user_id),
    verificarElegibilidadePorQuorum(quorumVigente.id, mesa.secretario_user_id)
  ]);

  if (!presencaPresidente || !presencaSecretario) {
    throw new Error("Presidente e Secretário devem ter realizado check-in no quórum vigente");
  }

  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'EM_CURSO' WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

async function encerrar(id) {
  const assembleia = await buscarPorId(id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);

  if (assembleia.estado === ASSEMBLEIA_STATES.ENCERRADA) {
    throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
  }

  // Apenas ABERTA ou EM_CURSO podem ser encerradas
  if (assembleia.estado !== ASSEMBLEIA_STATES.ABERTA && assembleia.estado !== ASSEMBLEIA_STATES.EM_CURSO) {
    throw new Error(`${Textos.ASSEMBLEIA.TRANSICAO_INVALIDA} (${assembleia.estado} -> ENCERRADA)`);
  }

  // EM_CURSO -> ENCERRADA: não deve haver votação ativa
  if (assembleia.estado === ASSEMBLEIA_STATES.EM_CURSO) {
    const votacaoAtiva = await buscarVotacaoAtiva(id);
    if (votacaoAtiva) {
      throw new Error("Não é possível encerrar a assembleia com uma votação em curso");
    }
  }

  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'ENCERRADA', encerrada_em = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );

  // Encerrar quórum vigente se houver
  await pool.query(
    `UPDATE assembleia_quoruns SET encerrado_em = NOW() WHERE assembleia_id = $1 AND encerrado_em IS NULL`,
    [id]
  );

  return rows[0];
}

async function registrarAuditoria(assembleiaId, userId, evento, payload) {
  try {
    await pool.query(
      "INSERT INTO assembleia_auditoria (assembleia_id, user_id, evento, payload) VALUES ($1, $2, $3, $4)",
      [assembleiaId, userId, evento, payload ? JSON.stringify(payload) : null]
    );
  } catch (err) {
    console.error("Erro ao registrar auditoria de assembleia:", err);
  }
}

async function gerarQuorum(dados) {
  const { assembleia_id, token, gerado_por_user_id, tipo_chamada, observacao } = dados;

  const assembleia = await buscarPorId(assembleia_id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  if (assembleia.estado !== ASSEMBLEIA_STATES.ABERTA && assembleia.estado !== ASSEMBLEIA_STATES.EM_CURSO) {
    throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
  }

  const totalAtivos = await contarFiliadosAtivosParaQuorum();
  let quorumNecessario = 0;

  if (tipo_chamada === 'PRIMEIRA') {
    quorumNecessario = Math.floor(totalAtivos / 2) + 1;
  } else {
    // SEGUNDA ou RECONTAGEM: "Qualquer número de presentes"
    quorumNecessario = 0;
  }

  // Encerrar quórum anterior se houver
  await pool.query(
    `UPDATE assembleia_quoruns SET encerrado_em = NOW() WHERE assembleia_id = $1 AND encerrado_em IS NULL`,
    [assembleia_id]
  );

  const { rows } = await pool.query(
    `INSERT INTO assembleia_quoruns (assembleia_id, token, gerado_por_user_id, tipo_chamada, quorum_total_ativos, quorum_necessario, observacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, token, criado_em, quorum_total_ativos, quorum_necessario`,
    [assembleia_id, token, gerado_por_user_id, tipo_chamada, totalAtivos, quorumNecessario, observacao]
  );
  const quorum = rows[0];

  // Auto-checkin de quem gerou (Presidente ou Diretor)
  // Somente se não for ADMIN ou COMUNICADOR
  if (gerado_por_user_id) {
     const { rows: userRows } = await pool.query("SELECT perfil_acesso FROM filiados WHERE id = $1", [gerado_por_user_id]);
     const perfil = (userRows[0]?.perfil_acesso || "").toUpperCase();

     if (perfil !== 'ADMIN' && perfil !== 'COMUNICADOR') {
       const origem = tipo_chamada === 'RECONTAGEM' ? 'AUTO_PRESIDENTE' : 'AUTO_GERADOR';
       await realizarCheckin({
         assembleia_quorum_id: quorum.id,
         filiado_id: gerado_por_user_id,
         origem: origem
       });
     }
  }

  return quorum;
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
  const { assembleia_quorum_id, filiado_id, origem } = dados;
  const { rows } = await pool.query(
    `INSERT INTO assembleia_checkins (assembleia_quorum_id, filiado_id, origem)
     VALUES ($1, $2, $3)
     ON CONFLICT (assembleia_quorum_id, filiado_id) DO UPDATE SET registrado_em = NOW()
     RETURNING id`,
    [assembleia_quorum_id, filiado_id, origem]
  );
  return rows[0];
}

async function buscarUltimoQuorum(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT * FROM assembleia_quoruns WHERE assembleia_id = $1 AND encerrado_em IS NULL ORDER BY criado_em DESC LIMIT 1`,
    [assembleiaId]
  );
  return rows[0];
}

async function criarVotacao(dados) {
  const { assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, iniciada_por_user_id } = dados;

  const assembleia = await buscarPorId(assembleia_id);
  if (!assembleia) throw new Error(Textos.ASSEMBLEIA.NAO_ENCONTRADA);
  if (assembleia.estado !== ASSEMBLEIA_STATES.EM_CURSO) {
    throw new Error(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
  }

  const { rows } = await pool.query(
    `INSERT INTO assembleia_votacoes (assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, status, iniciada_por_user_id, aberta_em)
     VALUES ($1, $2, $3, $4, $5, 'ATIVA', $6, NOW())
     RETURNING *, (aberta_em + interval '1 second' * duracao_segundos) as encerra_em`,
    [assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_segundos, iniciada_por_user_id]
  );
  return rows[0];
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

async function registrarVoto(votacaoId, filiadoId, voto) {
  const { rows } = await pool.query(
    `INSERT INTO assembleia_votos (votacao_id, filiado_id, voto)
     VALUES ($1, $2, $3)
     ON CONFLICT (votacao_id, filiado_id) DO UPDATE SET voto = $3, registrado_em = NOW()
     RETURNING *`,
    [votacaoId, filiadoId, voto]
  );
  return rows[0];
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

async function finalizarVotacao(votacaoId) {
  // Snapshot de elegíveis que não votaram -> Abstenção
  await pool.query(
    `INSERT INTO assembleia_votos (votacao_id, filiado_id, voto)
     SELECT v.id, c.filiado_id, 'ABSTENCAO'
     FROM assembleia_votacoes v
     JOIN assembleia_checkins c ON v.quorum_snapshot_id = c.assembleia_quorum_id
     LEFT JOIN assembleia_votos vo ON v.id = vo.votacao_id AND c.filiado_id = vo.filiado_id
     WHERE v.id = $1 AND vo.id IS NULL`,
    [votacaoId]
  );

  const { rows } = await pool.query(
    `UPDATE assembleia_votacoes SET status = 'ENCERRADA', finalizada_em = NOW() WHERE id = $1 RETURNING *`,
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
  return rows[0];
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

     if (filiadoId) {
       elegivel = await verificarElegibilidade(votacaoAtiva.id, filiadoId);
       if (!elegivel) {
         const presencaNoQuorum = await verificarElegibilidadePorQuorum(votacaoAtiva.quorum_snapshot_id, filiadoId);
         if (!presencaNoQuorum) {
           motivo_inelegibilidade = "Ausente na chamada de quórum deste item.";
         } else {
           motivo_inelegibilidade = "Restrição de elegibilidade técnica.";
         }
       }
     }

    votacaoData = {
      ...votacaoAtiva,
      contagem,
       votos,
       user_eligibility: {
         elegivel,
         motivo: motivo_inelegibilidade
       }
    };
  }

  let totalPresentes = 0;
  let userHasCheckedIn = false;
  if (ultimoQuorum) {
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) as total FROM assembleia_checkins WHERE assembleia_quorum_id = $1',
      [ultimoQuorum.id]
    );
    totalPresentes = parseInt(countRows[0].total);

    if (filiadoId) {
      const { rows: checkRows } = await pool.query(
        'SELECT 1 FROM assembleia_checkins WHERE assembleia_quorum_id = $1 AND filiado_id = $2',
        [ultimoQuorum.id, filiadoId]
      );
      userHasCheckedIn = checkRows.length > 0;
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
      userHasCheckedIn
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
