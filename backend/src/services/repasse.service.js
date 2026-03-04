const pool = require("../config/db");
const { LOTACOES_REPASSE, normalizeLotacao } = require('../shared/canon');

// Keywords para busca robusta se necessário, mas agora usamos a normalização canônica
const LOTACAO_KEYWORDS = {
  "SEDE": "SEDE",
  "DEL 01 - Viana": "VIANA",
  "DEL 02 - Serra": "SERRA",
  "DEL 03 - Guarapari": "GUARAPARI",
  "DEL 04 - Linhares": "LINHARES"
};

const factorFromPercentual = (percent) => {
  if (percent < 70) return 0;
  if (percent < 80) return 0.4;
  if (percent < 90) return 0.7;
  return 1.0;
};

const STATUS_EVENTO = {
  RASCUNHO: 'RASCUNHO',
  ABERTO: 'ABERTO',
  ENCERRADO: 'ENCERRADO'
};

const STATUS_ALOCACAO = {
  ATIVA: 'ATIVA',
  REVOGADA: 'REVOGADA'
};

function toLotacaoReal(value) {
  const normalized = normalizeLotacao(value);
  if (!normalized || normalized === 'NENHUMA') return 'SEM LOTAÇÃO';
  return normalized;
}

function computeConfig(configRow, ano) {
  const perCapitaGlobalAnual = Number(configRow?.per_capita_global_anual || 0);
  const perCapitaApoioOperacionalAnual = Number(configRow?.per_capita_apoio_operacional_anual || 0);

  return {
    ano_ref: ano,
    perCapitaGlobalAnual,
    perCapitaApoioOperacionalAnual,
    perCapitaEventoAtivoAnual: perCapitaGlobalAnual - perCapitaApoioOperacionalAnual,
    perCapitaEventoVeteranoAnual: perCapitaGlobalAnual
  };
}

function getAnoFromDate(dateStr) {
  return new Date(dateStr).getUTCFullYear();
}

async function getFiliadosAtivosCount(lotacaoKey) {
  const keyword = LOTACAO_KEYWORDS[lotacaoKey];
  if (!keyword) return 0;

  const { rows } = await pool.query(`
    SELECT COUNT(*) as count
    FROM filiados
    WHERE situacao = 'ATIVO'
      AND arquivado_em IS NULL
      AND UPPER(lotacao) LIKE $1
  `, [`%${keyword.toUpperCase()}%`]);

  return parseInt(rows[0].count);
}

async function listarResponsaveis(lotacaoKey = null) {
  let query = `
    SELECT id, nome, cpf, lotacao, perfil_acesso, situacao, arquivado_em
    FROM filiados
    WHERE arquivado_em IS NULL
  `;
  const params = [];

  if (lotacaoKey) {
    const keyword = LOTACAO_KEYWORDS[lotacaoKey];
    if (keyword) {
      query += ` AND UPPER(lotacao) LIKE $1`;
      params.push(`%${keyword.toUpperCase()}%`);
    }
  }

  query += ` ORDER BY nome ASC`;

  const { rows } = await pool.query(query, params);

  // Logging backend (obrigatório)
  const total = rows.length;
  const byLotacao = {};
  const organizadores = rows.filter(r => (r.perfil_acesso || '').toUpperCase() === 'ORGANIZADOR');

  rows.forEach(r => {
    const lot = r.lotacao || 'SEM LOTACAO';
    byLotacao[lot] = (byLotacao[lot] || 0) + 1;
  });

  console.info(`[REPASSE_RESP] total=${total} byLotacao=${JSON.stringify(byLotacao)}`);
  console.info(`[REPASSE_RESP] organizadores=${organizadores.length} lotacoes=${JSON.stringify(organizadores.map(o => o.lotacao))}`);

  return rows;
}

async function getRepasseAno(year) {
  // BOLT: Parallelize initial queries and filiado counts to reduce sequential DB roundtrips.
  const [configRowsResult, lotacaoRowsResult, ...ativosCounts] = await Promise.all([
    pool.query(`SELECT * FROM repasse_mes WHERE year = $1`, [year]),
    pool.query(`SELECT rl.*, f.nome as responsavel_nome, f.cpf as responsavel_cpf
                FROM repasse_lotacao rl
                LEFT JOIN filiados f ON rl.responsavel_id = f.id
                WHERE rl.year = $1`, [year]),
    ...LOTACOES_REPASSE.map(lot => getFiliadosAtivosCount(lot))
  ]);

  const configRows = configRowsResult.rows;
  const lotacaoRows = lotacaoRowsResult.rows;

  // BOLT: Assemble ativosPorLotacao from parallel results.
  const ativosPorLotacao = {};
  LOTACOES_REPASSE.forEach((lot, i) => {
    ativosPorLotacao[lot] = ativosCounts[i];
  });

  // BOLT: Pre-index configurations and lotação data to avoid O(N*M) lookups inside loops.
  const configByMonth = new Map(configRows.map(r => [r.month, r]));
  const lotacaoDataMap = new Map();
  lotacaoRows.forEach(r => {
    lotacaoDataMap.set(`${r.month}_${r.lotacao_key}`, r);
  });

  const meses = [];
  for (let month = 1; month <= 12; month++) {
    const config = configByMonth.get(month) || { per_capita: 0 };
    const perCapita = parseFloat(config.per_capita);

    const localidades = LOTACOES_REPASSE.map(lot => {
      const data = lotacaoDataMap.get(`${month}_${lot}`) || {
        responsavel_id: null,
        responsavel_nome: null,
        responsavel_cpf: null,
        prf_total: 0,
        reembolso_mes: 0
      };

      const filiadosAtivos = ativosPorLotacao[lot];
      const prfTotal = parseInt(data.prf_total) || 0;

      let percentual = 0;
      let creditoMes = 0;

      if (prfTotal > 0) {
        percentual = (filiadosAtivos / prfTotal) * 100;
        const base = filiadosAtivos * perCapita;
        const factor = factorFromPercentual(percentual);
        creditoMes = base * factor;
      }

      return {
        lotacao: lot,
        responsavelId: data.responsavel_id,
        responsavelNome: data.responsavel_nome,
        responsavelCpf: data.responsavel_cpf,
        filiadosAtivos,
        prfTotal,
        percentual: prfTotal > 0 ? percentual : null,
        creditoMes,
        reembolsoMes: parseFloat(data.reembolso_mes || 0)
      };
    });

    const totalRepasseMes = localidades.reduce((acc, loc) => acc + loc.creditoMes, 0);

    meses.push({
      month,
      perCapita,
      localidades,
      totalRepasseMes
    });
  }

  // BOLT: Calculate accumulated values using O(N+M) instead of nested loops.
  const lotacoesAcumuladoMap = new Map(LOTACOES_REPASSE.map(lot => [lot, 0]));

  meses.forEach(m => {
    m.localidades.forEach(loc => {
      const current = lotacoesAcumuladoMap.get(loc.lotacao);
      lotacoesAcumuladoMap.set(loc.lotacao, current + loc.creditoMes - loc.reembolsoMes);
    });
  });

  // Anexar o acumulado em cada localidade de cada mês
  meses.forEach(m => {
    m.localidades.forEach(loc => {
      loc.acumuladoAno = lotacoesAcumuladoMap.get(loc.lotacao);
    });
  });

  const totalAcumuladoGeral = Array.from(lotacoesAcumuladoMap.values()).reduce((acc, val) => acc + val, 0);

  return {
    year,
    meses,
    totalAcumuladoGeral
  };
}

/**
 * Obtém os dados de repasse mais recentes para uma lotação específica.
 * Usado pelo módulo de Relatórios para evitar duplicação de lógica.
 */
async function getUltimosDadosParaRelatorio(lotacaoKey) {
  // BOLT: Parallelize independent queries to reduce latency.
  const [filiadosAtivos, prfRowsResult] = await Promise.all([
    getFiliadosAtivosCount(lotacaoKey),
    pool.query(`
      SELECT rl.year, rl.month, rl.prf_total
      FROM repasse_lotacao rl
      WHERE rl.lotacao_key = $1
      ORDER BY rl.year DESC, rl.month DESC
      LIMIT 1
    `, [lotacaoKey])
  ]);

  const rows = prfRowsResult.rows;

  if (rows.length === 0) {
    return {
      filiadosAtivos,
      prfTotal: null,
      percentual: null,
      competencia: null
    };
  }

  const { year, month, prf_total: prfTotal } = rows[0];
  let percentual = null;
  if (prfTotal > 0) {
    percentual = (filiadosAtivos / prfTotal) * 100;
  }

  return {
    filiadosAtivos,
    prfTotal,
    percentual,
    competencia: { year, month }
  };
}

async function updateRepasseMes(year, month, perCapita, localidadesData) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update per_capita
    await client.query(`
      INSERT INTO repasse_mes (year, month, per_capita)
      VALUES ($1, $2, $3)
      ON CONFLICT (year, month) DO UPDATE SET per_capita = $3
    `, [year, month, perCapita]);

    // Update each location
    for (const loc of localidadesData) {
      // Proteção: Apenas lotações do repasse
      if (!LOTACOES_REPASSE.includes(loc.lotacaoKey)) continue;

      await client.query(`
        INSERT INTO repasse_lotacao (year, month, lotacao_key, responsavel_id, prf_total, reembolso_mes)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (year, month, lotacao_key) DO UPDATE SET
          responsavel_id = $4,
          prf_total = $5,
          reembolso_mes = $6
      `, [year, month, loc.lotacaoKey, loc.responsavelId, loc.prfTotal, loc.reembolsoMes]);
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function getRepasseResumo(ano, options = {}) {
  const [configResult, filiadosResult, debitosResult, eventosResult] = await Promise.all([
    pool.query(`SELECT * FROM repasse_config WHERE ano_ref = $1`, [ano]),
    pool.query(`
      SELECT id, nome, situacao, lotacao
      FROM filiados
      WHERE arquivado_em IS NULL
        AND UPPER(situacao) IN ('ATIVO', 'VETERANO')
    `),
    pool.query(`
      SELECT lotacao_id, COALESCE(SUM(valor), 0) AS total
      FROM repasse_movimentos
      WHERE ano_ref = $1
        AND tipo = 'APOIO_OPERACIONAL_DEBITO'
        AND deleted_at IS NULL
      GROUP BY lotacao_id
    `, [ano]),
    pool.query(`
      SELECT
        e.id, e.titulo, e.data_evento, e.data_limite_alocacao, e.status,
        e.deleted_at, e.delete_reason, e.deleted_by_user_id,
        df.nome AS deleted_by_nome,
        rf.id AS responsavel_id, rf.nome AS responsavel_nome,
        a.filiado_id, f.nome AS filiado_nome, f.situacao AS filiado_situacao, a.valor_alocado
      FROM repasse_eventos e
      LEFT JOIN filiados rf ON rf.id = e.responsavel_filiado_id
      LEFT JOIN filiados df ON df.id = e.deleted_by_user_id
      LEFT JOIN repasse_evento_alocacoes a
        ON a.evento_id = e.id
        AND a.ano_ref = $1
        AND a.status = 'ATIVA'
      LEFT JOIN filiados f ON f.id = a.filiado_id
      WHERE EXTRACT(YEAR FROM e.data_evento) = $1
      ORDER BY e.data_evento, e.titulo, f.nome
    `, [ano])
  ]);

  const config = computeConfig(configResult.rows[0], ano);
  const includeCancelados = Boolean(options?.includeCancelados);
  const debitosByLotacao = new Map(debitosResult.rows.map((r) => [r.lotacao_id || 'SEM LOTAÇÃO', Number(r.total || 0)]));

  const apoioCount = new Map();
  let qtdAtivosTotal = 0;
  let qtdVeteranosTotal = 0;

  filiadosResult.rows.forEach((f) => {
    const situacao = String(f.situacao || '').toUpperCase();
    const lotacaoReal = toLotacaoReal(f.lotacao);
    if (situacao === 'ATIVO') {
      qtdAtivosTotal += 1;
      apoioCount.set(lotacaoReal, (apoioCount.get(lotacaoReal) || 0) + 1);
    }
    if (situacao === 'VETERANO') qtdVeteranosTotal += 1;
  });

  const lotacoesResumo = [...LOTACOES_REPASSE, 'SEM LOTAÇÃO'];
  const apoioPorLotacao = lotacoesResumo.map((lotacao) => {
    const qtdAtivos = apoioCount.get(lotacao) || 0;
    const credito = qtdAtivos * config.perCapitaApoioOperacionalAnual;
    const debitos = debitosByLotacao.get(lotacao) || 0;
    return {
      lotacao,
      qtdAtivos,
      creditoApoioOperacional: credito,
      debitosApoioOperacional: debitos,
      saldoApoioOperacional: credito - debitos
    };
  });

  const eventosMap = new Map();

  eventosResult.rows.forEach((row) => {
    if (!eventosMap.has(row.id)) {
      eventosMap.set(row.id, {
        evento: {
          id: row.id,
          titulo: row.titulo,
          data_evento: row.data_evento,
          data_limite_alocacao: row.data_limite_alocacao,
          status: row.status,
          deleted_at: row.deleted_at,
          delete_reason: row.delete_reason,
          deleted_by_user_id: row.deleted_by_user_id,
          deleted_by_nome: row.deleted_by_nome,
          responsavel: row.responsavel_id ? { id: row.responsavel_id, nome: row.responsavel_nome } : null
        },
        totalAlocado: 0,
        contagemAtivos: 0,
        contagemVeteranos: 0,
        itens: []
      });
    }

    if (row.filiado_id) {
      const bucket = eventosMap.get(row.id);
      const valor = Number(row.valor_alocado || 0);
      const situacao = String(row.filiado_situacao || '').toUpperCase();
      bucket.totalAlocado += valor;
      if (situacao === 'ATIVO') bucket.contagemAtivos += 1;
      if (situacao === 'VETERANO') bucket.contagemVeteranos += 1;
      bucket.itens.push({
        filiadoId: row.filiado_id,
        nome: row.filiado_nome,
        situacao,
        valorAlocado: valor
      });
    }
  });

  const alocacoesTodas = Array.from(eventosMap.values());
  const alocacoesAtivas = alocacoesTodas.filter((g) => !g.evento.deleted_at);
  const alocacoesCanceladas = alocacoesTodas.filter((g) => g.evento.deleted_at);

  const totalAlocadoAtivo = alocacoesAtivas.reduce((acc, g) => acc + Number(g.totalAlocado || 0), 0);
  const recursoNaoAlocadoTotal =
    (config.perCapitaGlobalAnual * qtdVeteranosTotal) +
    (config.perCapitaEventoAtivoAnual * qtdAtivosTotal) -
    totalAlocadoAtivo;

  return {
    ano_ref: ano,
    config,
    apoioPorLotacao,
    recursoNaoAlocadoTotal,
    alocacoesPorEvento: alocacoesAtivas,
    ...(includeCancelados ? { alocacoesCanceladas } : {})
  };
}

async function updateRepasseConfig(ano, perCapitaGlobalAnual, perCapitaApoioOperacionalAnual) {
  if (!(perCapitaGlobalAnual > 0)) throw new Error('perCapitaGlobalAnual deve ser maior que zero');
  if (perCapitaApoioOperacionalAnual < 0 || perCapitaApoioOperacionalAnual > perCapitaGlobalAnual) {
    throw new Error('perCapitaApoioOperacionalAnual inválido');
  }

  await pool.query(`
    INSERT INTO repasse_config (ano_ref, per_capita_global_anual, per_capita_apoio_operacional_anual)
    VALUES ($1, $2, $3)
    ON CONFLICT (ano_ref) DO UPDATE SET
      per_capita_global_anual = EXCLUDED.per_capita_global_anual,
      per_capita_apoio_operacional_anual = EXCLUDED.per_capita_apoio_operacional_anual,
      updated_at = NOW()
  `, [ano, perCapitaGlobalAnual, perCapitaApoioOperacionalAnual]);

  const { rows } = await pool.query(`SELECT * FROM repasse_config WHERE ano_ref = $1`, [ano]);
  return computeConfig(rows[0], ano);
}

async function listarEventos(ano, status = null, options = {}) {
  const includeCancelados = Boolean(options?.includeCancelados);
  const params = [ano];
  let statusFilter = '';
  if (status) {
    params.push(String(status).toUpperCase());
    statusFilter = ` AND e.status = $2`;
  }

  const { rows } = await pool.query(`
    SELECT e.*, f.nome AS responsavel_nome, df.nome AS deleted_by_nome
    FROM repasse_eventos e
    LEFT JOIN filiados f ON f.id = e.responsavel_filiado_id
    LEFT JOIN filiados df ON df.id = e.deleted_by_user_id
    WHERE EXTRACT(YEAR FROM e.data_evento) = $1
      ${includeCancelados ? '' : 'AND e.deleted_at IS NULL'}
    ${statusFilter}
    ORDER BY e.data_evento ASC, e.titulo ASC
  `, params);

  return rows;
}

async function criarEvento(payload, userId) {
  const status = String(payload.status || STATUS_EVENTO.RASCUNHO).toUpperCase();
  if (!Object.values(STATUS_EVENTO).includes(status)) throw new Error('Status de evento inválido');
  if (payload.data_limite_alocacao > payload.data_evento) throw new Error('Data limite deve ser <= data do evento');

  const { rows } = await pool.query(`
    INSERT INTO repasse_eventos
      (titulo, descricao, responsavel_filiado_id, data_evento, data_limite_alocacao, status, created_by_user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [payload.titulo, payload.descricao || null, payload.responsavel_filiado_id || null, payload.data_evento, payload.data_limite_alocacao, status, userId]);

  return rows[0];
}

async function atualizarEvento(id, payload) {
  const status = payload.status ? String(payload.status).toUpperCase() : null;
  if (status && !Object.values(STATUS_EVENTO).includes(status)) throw new Error('Status de evento inválido');
  if (payload.data_evento && payload.data_limite_alocacao && payload.data_limite_alocacao > payload.data_evento) {
    throw new Error('Data limite deve ser <= data do evento');
  }

  const { rows } = await pool.query(`SELECT * FROM repasse_eventos WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!rows.length) throw new Error('Evento não encontrado');
  const atual = rows[0];

  const dataEvento = payload.data_evento || atual.data_evento;
  const dataLimite = payload.data_limite_alocacao || atual.data_limite_alocacao;
  if (dataLimite > dataEvento) throw new Error('Data limite deve ser <= data do evento');

  const updated = await pool.query(`
    UPDATE repasse_eventos
    SET titulo = $2,
        descricao = $3,
        responsavel_filiado_id = $4,
        data_evento = $5,
        data_limite_alocacao = $6,
        status = $7,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, payload.titulo || atual.titulo, payload.descricao ?? atual.descricao, payload.responsavel_filiado_id ?? atual.responsavel_filiado_id, dataEvento, dataLimite, status || atual.status]);

  return updated.rows[0];
}

async function alterarStatusEvento(id, status) {
  const nextStatus = String(status || '').toUpperCase();
  if (!Object.values(STATUS_EVENTO).includes(nextStatus)) throw new Error('Status de evento inválido');
  const { rows } = await pool.query(`
    UPDATE repasse_eventos SET status = $2, updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING *
  `, [id, nextStatus]);
  if (!rows.length) throw new Error('Evento não encontrado');
  return rows[0];
}

async function alocarEmEvento(eventoId, filiadoId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventoResult = await client.query(`SELECT * FROM repasse_eventos WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [eventoId]);
    if (!eventoResult.rows.length) throw new Error('Evento não encontrado');
    const evento = eventoResult.rows[0];

    const hoje = new Date().toISOString().slice(0, 10);
    if (evento.status !== STATUS_EVENTO.ABERTO || hoje > evento.data_limite_alocacao) {
      throw new Error('Evento fora do prazo de alocação');
    }

    const filiadoResult = await client.query(`
      SELECT id, situacao, arquivado_em
      FROM filiados
      WHERE id = $1
      FOR UPDATE
    `, [filiadoId]);
    if (!filiadoResult.rows.length) throw new Error('Filiado não encontrado');
    const filiado = filiadoResult.rows[0];
    if (filiado.arquivado_em) throw new Error('Filiado não elegível para alocação');
    const situacao = String(filiado.situacao || '').toUpperCase();
    if (!['ATIVO', 'VETERANO'].includes(situacao)) throw new Error('Filiado não elegível para alocação');

    const ano = getAnoFromDate(evento.data_evento);
    const configResult = await client.query(`SELECT * FROM repasse_config WHERE ano_ref = $1`, [ano]);
    const config = computeConfig(configResult.rows[0], ano);
    if (config.perCapitaGlobalAnual <= 0) throw new Error('Configuração anual de repasse não encontrada');

    const valor = situacao === 'ATIVO' ? config.perCapitaEventoAtivoAnual : config.perCapitaEventoVeteranoAnual;

    await client.query(`
      UPDATE repasse_evento_alocacoes
      SET status = $3,
          revogado_em = NOW(),
          revogado_motivo = 'Realocação automática para novo evento',
          revogado_por_user_id = $2
      WHERE ano_ref = $1
        AND filiado_id = $2
        AND status = $4
    `, [ano, filiadoId, STATUS_ALOCACAO.REVOGADA, STATUS_ALOCACAO.ATIVA]);

    const inserted = await client.query(`
      INSERT INTO repasse_evento_alocacoes (ano_ref, evento_id, filiado_id, valor_alocado, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [ano, eventoId, filiadoId, valor, STATUS_ALOCACAO.ATIVA]);

    await client.query('COMMIT');
    return inserted.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function retirarAlocacaoEvento(eventoId, filiadoId, payload = {}, atorId = null) {
  const motivo = String(payload?.justificativa || payload?.motivo || '').trim();
  const ignorarPrazo = Boolean(payload?.ignorarPrazo);
  if (motivo.length < 5 || motivo.length > 1000) {
    throw new Error('Justificativa deve ter entre 5 e 1000 caracteres.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventoResult = await client.query(`SELECT * FROM repasse_eventos WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [eventoId]);
    if (!eventoResult.rows.length) throw new Error('Evento não encontrado');
    const evento = eventoResult.rows[0];

    const hoje = new Date().toISOString().slice(0, 10);
    if (!ignorarPrazo && hoje > evento.data_limite_alocacao) {
      throw new Error('Prazo para retirar alocação encerrado');
    }

    const ano = getAnoFromDate(evento.data_evento);
    const revoked = await client.query(`
      UPDATE repasse_evento_alocacoes
      SET status = $4,
          revogado_em = NOW(),
          revogado_motivo = $6,
          revogado_por_user_id = $7
      WHERE ano_ref = $1
        AND evento_id = $2
        AND filiado_id = $3
        AND status = $5
      RETURNING *
    `, [ano, eventoId, filiadoId, STATUS_ALOCACAO.REVOGADA, STATUS_ALOCACAO.ATIVA, motivo, atorId || filiadoId]);

    if (!revoked.rows.length) throw new Error('Alocação ativa não encontrada para este filiado no evento informado.');

    await client.query('COMMIT');
    return revoked.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function excluirEvento(id, payload, userId) {
  const motivo = String(payload?.justificativa || payload?.motivo || '').trim();
  if (motivo.length < 5 || motivo.length > 1000) {
    throw new Error('Justificativa deve ter entre 5 e 1000 caracteres.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventoResult = await client.query(`
      SELECT *
      FROM repasse_eventos
      WHERE id = $1
        AND deleted_at IS NULL
      FOR UPDATE
    `, [id]);

    if (!eventoResult.rows.length) throw new Error('Evento não encontrado ou já excluído.');
    const evento = eventoResult.rows[0];
    const ano = getAnoFromDate(evento.data_evento);

    await client.query(`
      UPDATE repasse_evento_alocacoes
      SET status = $3,
          revogado_em = NOW(),
          revogado_motivo = $5,
          revogado_por_user_id = $4
      WHERE ano_ref = $1
        AND evento_id = $2
        AND status = $6
    `, [ano, id, STATUS_ALOCACAO.REVOGADA, userId, `Evento cancelado: ${motivo}`, STATUS_ALOCACAO.ATIVA]);

    const { rows } = await client.query(`
      UPDATE repasse_eventos
      SET deleted_at = NOW(),
          deleted_by_user_id = $2,
          delete_reason = $3,
          updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING *
    `, [id, userId, motivo]);

    if (!rows.length) throw new Error('Evento não encontrado ou já excluído.');

    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

function parseValorDebito(payload = {}) {
  const centavosRaw = payload.valor_centavos ?? payload.valorCentavos;
  if (centavosRaw !== undefined && centavosRaw !== null && String(centavosRaw).trim() !== '') {
    const centavos = Number(String(centavosRaw).replace(/\D/g, ''));
    if (!Number.isFinite(centavos) || centavos <= 0) return null;
    return centavos / 100;
  }

  const valor = Number(payload.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return valor;
}

async function listarMovimentos(ano, lotacaoId) {
  const { rows } = await pool.query(`
    SELECT m.*, f.nome as created_by_nome
    FROM repasse_movimentos m
    LEFT JOIN filiados f ON f.id = m.created_by_user_id
    WHERE m.ano_ref = $1
      AND m.lotacao_id = $2
      AND m.tipo = 'APOIO_OPERACIONAL_DEBITO'
      AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC
  `, [ano, lotacaoId]);
  return rows;
}

async function criarMovimento(payload, userId) {
  const { ano_ref, lotacao_id, observacao } = payload;
  const valor = parseValorDebito(payload);

  if (!ano_ref || !lotacao_id || !valor || valor <= 0) {
    throw new Error('Dados inválidos para lançamento de débito.');
  }
  if (!observacao || observacao.length < 3 || observacao.length > 1000) {
    throw new Error('Observação deve ter entre 3 e 1000 caracteres.');
  }

  const { rows } = await pool.query(`
    INSERT INTO repasse_movimentos (ano_ref, lotacao_id, tipo, valor, observacao, created_by_user_id)
    VALUES ($1, $2, 'APOIO_OPERACIONAL_DEBITO', $3, $4, $5)
    RETURNING *
  `, [ano_ref, lotacao_id, valor, observacao, userId]);

  return rows[0];
}

async function atualizarMovimento(id, payload, userId) {
  const { observacao } = payload;
  const valor = parseValorDebito(payload);

  if (!valor || valor <= 0) {
    throw new Error('Valor inválido.');
  }
  if (!observacao || observacao.length < 3 || observacao.length > 1000) {
    throw new Error('Observação deve ter entre 3 e 1000 caracteres.');
  }

  const { rows } = await pool.query(`
    UPDATE repasse_movimentos
    SET valor = $2,
        observacao = $3,
        updated_at = NOW(),
        updated_by_user_id = $4
    WHERE id = $1
      AND tipo = 'APOIO_OPERACIONAL_DEBITO'
      AND deleted_at IS NULL
    RETURNING *
  `, [id, valor, observacao, userId]);

  if (rows.length === 0) {
    throw new Error('Movimento não encontrado ou não permitido para edição.');
  }

  return rows[0];
}


async function excluirMovimento(id, payload, userId) {
  const motivo = String(payload?.justificativa || payload?.motivo || '').trim();

  if (motivo.length < 5 || motivo.length > 1000) {
    throw new Error('Justificativa deve ter entre 5 e 1000 caracteres.');
  }

  const { rows } = await pool.query(`
    UPDATE repasse_movimentos
    SET deleted_at = NOW(),
        deleted_by_user_id = $2,
        delete_reason = $3,
        updated_at = NOW(),
        updated_by_user_id = $2
    WHERE id = $1
      AND tipo = 'APOIO_OPERACIONAL_DEBITO'
      AND deleted_at IS NULL
    RETURNING *
  `, [id, userId, motivo]);

  if (rows.length === 0) {
    throw new Error('Movimento não encontrado ou já excluído.');
  }

  return rows[0];
}

async function listarResponsaveisComBusca(q = '') {
  const term = String(q || '').trim();

  if (!term) {
    const { rows } = await pool.query(`
      SELECT id, nome, cpf, lotacao, situacao
      FROM filiados
      WHERE arquivado_em IS NULL
      ORDER BY nome ASC
    `);
    return rows;
  }

  const digits = term.replace(/\D/g, '');
  const params = [term];
  let extraCond = '';

  if (digits) {
    params.push(`%${digits}%`);
    extraCond = ` OR cpf LIKE $2`;
  }

  const { rows } = await pool.query(`
    SELECT id, nome, cpf, lotacao, situacao
    FROM filiados
    WHERE arquivado_em IS NULL
      AND (unaccent(lower(nome)) LIKE '%' || unaccent(lower($1)) || '%' ${extraCond})
    ORDER BY
      CASE
        WHEN unaccent(lower(nome)) LIKE unaccent(lower($1)) || '%' THEN 0
        ELSE 1
      END,
      LENGTH(unaccent(lower(nome))) ASC,
      nome ASC
  `, params);

  return rows;
}

module.exports = {
  getRepasseAno,
  getUltimosDadosParaRelatorio,
  updateRepasseMes,
  listarResponsaveis,
  factorFromPercentual,
  getRepasseResumo,
  updateRepasseConfig,
  listarEventos,
  criarEvento,
  atualizarEvento,
  alterarStatusEvento,
  alocarEmEvento,
  retirarAlocacaoEvento,
  excluirEvento,
  listarResponsaveisComBusca,
  listarMovimentos,
  criarMovimento,
  atualizarMovimento,
  excluirMovimento
};
