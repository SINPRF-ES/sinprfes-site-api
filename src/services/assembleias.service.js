// src/services/assembleias.service.js
const pool = require("../config/db");

const ASSEMBLEIA_COLUMNS = "id, tipo, titulo, descricao, estado, criado_por, aberta_em, encerrada_em, criado_em, data_hora_inicio, edital_url";

async function listar(perfilAcesso) {
  let query = `SELECT ${ASSEMBLEIA_COLUMNS} FROM assembleias`;
  const params = [];

  // Filiados agora podem ver todos os status (CRIADA, ABERTA, ENCERRADA)
  // para consultar pauta e horários antecipadamente.

  query += " ORDER BY criado_em DESC";

  const { rows } = await pool.query(query, params);
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await pool.query(`SELECT ${ASSEMBLEIA_COLUMNS} FROM assembleias WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function criar(dados) {
  const { tipo, titulo, descricao, criado_por, data_hora_inicio, edital_url } = dados;
  const { rows } = await pool.query(
    `INSERT INTO assembleias (tipo, titulo, descricao, criado_por, data_hora_inicio, edital_url)
     VALUES ($1, $2, $3, $4, NULLIF($5, '')::TIMESTAMP, NULLIF($6, ''))
     RETURNING ${ASSEMBLEIA_COLUMNS}`,
    [tipo, titulo, descricao, criado_por, data_hora_inicio, edital_url]
  );
  return rows[0];
}

async function abrir(id) {
  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'ABERTA', aberta_em = NOW() WHERE id = $1 RETURNING ${ASSEMBLEIA_COLUMNS}`,
    [id]
  );
  return rows[0];
}

async function encerrar(id) {
  const { rows } = await pool.query(
    `UPDATE assembleias SET estado = 'ENCERRADA', encerrada_em = NOW() WHERE id = $1 RETURNING ${ASSEMBLEIA_COLUMNS}`,
    [id]
  );
  return rows[0];
}

async function registrarAuditoria(assembleiaId, filiadoId, evento, payload) {
  try {
    await pool.query(
      "INSERT INTO assembleia_auditoria (assembleia_id, filiado_id, evento, payload) VALUES ($1, $2, $3, $4)",
      [assembleiaId, filiadoId, evento, payload ? JSON.stringify(payload) : null]
    );
  } catch (err) {
    console.error("Erro ao registrar auditoria de assembleia:", err);
  }
}

async function gerarQuorum(assembleiaId, token, validadeMinutos = 10) {
  const { rows } = await pool.query(
    `INSERT INTO assembleia_quoruns (assembleia_id, token, valido_ate)
     VALUES ($1, $2, NOW() + interval '1 minute' * $3)
     RETURNING id, token, valido_ate`,
    [assembleiaId, token, validadeMinutos]
  );
  return rows[0];
}

async function buscarQuorumPorToken(assembleiaId, token) {
  const { rows } = await pool.query(
    `SELECT id, valido_ate FROM assembleia_quoruns
     WHERE assembleia_id = $1 AND token = $2 AND valido_ate > NOW()
     ORDER BY criado_em DESC LIMIT 1`,
    [assembleiaId, token]
  );
  return rows[0];
}

async function realizarCheckin(quorumId, filiadoId) {
  const { rows } = await pool.query(
    `INSERT INTO assembleia_checkins (quorum_id, filiado_id)
     VALUES ($1, $2)
     ON CONFLICT (quorum_id, filiado_id) DO UPDATE SET registrado_em = NOW()
     RETURNING id`,
    [quorumId, filiadoId]
  );
  return rows[0];
}

async function buscarUltimoQuorum(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT id FROM assembleia_quoruns WHERE assembleia_id = $1 ORDER BY criado_em DESC LIMIT 1`,
    [assembleiaId]
  );
  return rows[0];
}

async function criarVotacao(dados) {
  const { assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_minutos } = dados;
  const { rows } = await pool.query(
    `INSERT INTO assembleia_votacoes (assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_minutos, estado, aberta_em)
     VALUES ($1, $2, $3, $4, $5, 'EM_CURSO', NOW())
     RETURNING *, (aberta_em + interval '1 minute' * duracao_minutos) as encerra_em`,
    [assembleia_id, quorum_snapshot_id, titulo, descricao, duracao_minutos]
  );
  return rows[0];
}

async function buscarVotacaoAtiva(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT *, (aberta_em + interval '1 minute' * duracao_minutos) as encerra_em
     FROM assembleia_votacoes
     WHERE assembleia_id = $1 AND estado = 'EM_CURSO'
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
     JOIN assembleia_votacoes v ON c.quorum_id = v.quorum_snapshot_id
     WHERE v.id = $1 AND c.filiado_id = $2`,
    [votacaoId, filiadoId]
  );
  return rows.length > 0;
}

 async function verificarElegibilidadePorQuorum(quorumId, filiadoId) {
   const { rows } = await pool.query(
     `SELECT 1 FROM assembleia_checkins WHERE quorum_id = $1 AND filiado_id = $2`,
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

 async function atualizarEstadoProposta(propostaId, estado, motivo = null) {
   await pool.query(
     "UPDATE assembleia_propostas SET estado = $1, motivo_retirada = $2 WHERE id = $3",
     [estado, motivo, propostaId]
   );
 }

async function finalizarVotacao(votacaoId) {
   // Snapshot de elegíveis que não votaram -> Abstenção
  await pool.query(
    `INSERT INTO assembleia_votos (votacao_id, filiado_id, voto)
     SELECT v.id, c.filiado_id, 'ABSTENCAO'
     FROM assembleia_votacoes v
     JOIN assembleia_checkins c ON v.quorum_snapshot_id = c.quorum_id
     LEFT JOIN assembleia_votos vo ON v.id = vo.votacao_id AND c.filiado_id = vo.filiado_id
     WHERE v.id = $1 AND vo.id IS NULL`,
    [votacaoId]
  );

  const { rows } = await pool.query(
    `UPDATE assembleia_votacoes SET estado = 'CONCLUIDA', finalizada_em = NOW() WHERE id = $1 RETURNING *`,
    [votacaoId]
  );

   const finalizada = rows[0];
   if (finalizada) {
      await registrarAuditoria(finalizada.assembleia_id, null, "LAZY_CLOSE_VOTACAO", { votacao_id: votacaoId });
   }

   return finalizada;
}

async function pedirPalavra(assembleiaId, filiadoId) {
  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(ordem), 0) as max_ordem FROM assembleia_pedidos_palavra WHERE assembleia_id = $1`,
    [assembleiaId]
  );
  const novaOrdem = maxRows[0].max_ordem + 1;

  const { rows } = await pool.query(
    `INSERT INTO assembleia_pedidos_palavra (assembleia_id, filiado_id, ordem, estado)
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
     WHERE p.assembleia_id = $1 AND p.estado IN ('PENDENTE', 'EM_FALA')
     ORDER BY p.ordem ASC`,
    [assembleiaId]
  );
  return rows;
}

async function criarProposta(dados) {
  const { assembleia_id, autor_id, titulo, descricao } = dados;
  const { rows } = await pool.query(
    `INSERT INTO assembleia_propostas (assembleia_id, autor_id, titulo, descricao, estado)
     VALUES ($1, $2, $3, $4, 'PENDENTE')
     RETURNING *`,
    [assembleia_id, autor_id, titulo, descricao]
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

async function definirMesa(assembleiaId, filiadoId, cargo) {
  const { rows } = await pool.query(
    `INSERT INTO assembleia_mesa (assembleia_id, filiado_id, cargo)
     VALUES ($1, $2, $3)
     ON CONFLICT (assembleia_id, cargo) DO UPDATE SET filiado_id = $2
     RETURNING *`,
    [assembleiaId, filiadoId, cargo]
  );
  return rows[0];
}

async function buscarMesa(assembleiaId) {
  const { rows } = await pool.query(
    `SELECT m.*, f.nome as filiado_nome
     FROM assembleia_mesa m
     JOIN filiados f ON m.filiado_id = f.id
     WHERE m.assembleia_id = $1`,
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

  if (votacaoAtiva && votacaoAtiva.estado === 'EM_CURSO') {
    const [contagem, votos] = await Promise.all([
      contarVotos(votacaoAtiva.id),
      listarVotosNominais(votacaoAtiva.id)
    ]);

     let elegivel = false;
     let motivo_inelegibilidade = null;

     if (filiadoId) {
       elegivel = await verificarElegibilidade(votacaoAtiva.id, filiadoId);
       if (!elegivel) {
         // Tenta descobrir o motivo
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
      'SELECT COUNT(*) as total FROM assembleia_checkins WHERE quorum_id = $1',
      [ultimoQuorum.id]
    );
    totalPresentes = parseInt(countRows[0].total);

    if (filiadoId) {
      const { rows: checkRows } = await pool.query(
        'SELECT 1 FROM assembleia_checkins WHERE quorum_id = $1 AND filiado_id = $2',
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
   atualizarEstadoProposta,
   verificarElegibilidadePorQuorum,
  definirMesa,
  buscarMesa,
  buscarEstadoCompleto
};
