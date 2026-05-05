// src/services/reports.service.js
const pool = require("../config/db");
const filiadosService = require("./filiados.service");
const repasseService = require("./repasse.service");
const { SITUACAO_FUNCIONAL, LOTACOES, LOTACOES_REPASSE, SITUACAO_SINDICAL } = require('../shared/canon');

function roundPercent(value) {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
}

function calcularPercentuaisSindicais({ efetivoTotal, filiadoSinprf, filiadoOutro }) {
  const filiadosTotais = filiadoSinprf + filiadoOutro;
  const naoFiliados = Math.max(efetivoTotal - filiadosTotais, 0);
  const percentual_filiacao_local = efetivoTotal > 0 ? roundPercent((filiadoSinprf / efetivoTotal) * 100) : 0;
  const percentual_filiacao_total = efetivoTotal > 0 ? roundPercent((filiadosTotais / efetivoTotal) * 100) : 0;
  const percentual_nao_filiacao = efetivoTotal > 0 ? roundPercent((naoFiliados / efetivoTotal) * 100) : 0;
  const base_local_ajustada = efetivoTotal - filiadoOutro;
  const percentual_base_ajustada = base_local_ajustada > 0
    ? roundPercent((filiadoSinprf / base_local_ajustada) * 100)
    : 0;

  return {
    filiados_totais: filiadosTotais,
    nao_filiados_estimados_no_efetivo: naoFiliados,
    percentual_filiacao_local,
    percentual_filiacao_total,
    percentual_nao_filiacao,
    // Compatibilidade retroativa
    percentual_total: percentual_filiacao_local,
    base_local_ajustada,
    percentual_base_ajustada
  };
}

/**
 * Registra um novo job de relatório para auditoria.
 */
async function registrarJob(report_type, params, requester) {
  const { rows } = await pool.query(
    `INSERT INTO report_jobs (report_type, params, requester_id, requester_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [report_type, JSON.stringify(params), requester.id, requester.nome]
  );
  return rows[0];
}

/**
 * Retorna o histórico de relatórios gerados.
 */
async function listarHistorico(requester_id = null) {
  let query = `SELECT * FROM report_jobs`;
  const params = [];
  if (requester_id) {
    query += ` WHERE requester_id = $1`;
    params.push(requester_id);
  }
  query += ` ORDER BY created_at DESC LIMIT 50`;
  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Dados para Relatório Individual (Dossiê).
 */
async function buscarDadosDossie(filiadoId) {
  const filiado = await filiadosService.buscarPorId(filiadoId);
  return filiado;
}

/**
 * Dados agregados para relatórios estatísticos.
 */
async function buscarDadosAgregados(tipo, valor) {
  let whereClause = "WHERE arquivado_em IS NULL";
  const params = [];
  let lotacaoKeyword = null;

  if (tipo === "LOTACAO") {
    // Busca por keyword conforme padrão do projeto
    const keywords = {
        "SEDE": "SEDE",
        "DEL 01 - Viana": "VIANA",
        "DEL 02 - Serra": "SERRA",
        "DEL 03 - Guarapari": "GUARAPARI",
        "DEL 04 - Linhares": "LINHARES",
        "NENHUMA": "NENHUMA"
    };
    const kw = keywords[valor] || valor;
    lotacaoKeyword = kw.toUpperCase();
    whereClause += " AND UPPER(lotacao) LIKE $1 AND situacao = 'ATIVO' AND situacao_sindical = 'FILIADO_SINPRF_ES'";
    params.push(`%${lotacaoKeyword}%`);
  } else if (tipo === "SITUACAO") {
    whereClause += " AND situacao = $1 AND situacao_sindical = 'FILIADO_SINPRF_ES'";
    params.push(valor);
  }

  const query = `
    SELECT
      COUNT(*)::INTEGER as total,
      COUNT(*) FILTER (WHERE sexo = 'M')::INTEGER as masc,
      COUNT(*) FILTER (WHERE sexo = 'F')::INTEGER as fem,
      COUNT(*) FILTER (WHERE data_nascimento IS NULL)::INTEGER as idade_desconhecida,
      COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) BETWEEN 20 AND 29)::INTEGER as range_20_29,
      COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) BETWEEN 30 AND 39)::INTEGER as range_30_39,
      COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) BETWEEN 40 AND 49)::INTEGER as range_40_49,
      COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) BETWEEN 50 AND 59)::INTEGER as range_50_59,
      COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) >= 60)::INTEGER as range_60_plus
    FROM filiados
    ${whereClause}
  `;

  // BOLT: Hierarchical parallelization of all independent database queries.
  const tasks = [pool.query(query, params).then((res) => res.rows[0])];

  if (tipo === "LOTACAO") {
    tasks.push(repasseService.getUltimosDadosParaRelatorio(valor));
    tasks.push(
      pool
        .query(
          `
      SELECT
        COUNT(*) FILTER (WHERE situacao_sindical = $2)::INTEGER AS filiado_sinprf_es,
        COUNT(*) FILTER (WHERE situacao_sindical = $3)::INTEGER AS filiado_outro_sindicato,
        COUNT(*) FILTER (WHERE situacao_sindical = $4)::INTEGER AS nao_filiado,
        COUNT(*) FILTER (WHERE situacao_sindical = $5)::INTEGER AS desconhecido
      FROM filiados
      WHERE arquivado_em IS NULL
        AND situacao = 'ATIVO'
        AND UPPER(lotacao) LIKE $1
    `,
          [
            `%${lotacaoKeyword}%`,
            SITUACAO_SINDICAL.FILIADO_SINPRF_ES,
            SITUACAO_SINDICAL.FILIADO_OUTRO_SINDICATO,
            SITUACAO_SINDICAL.NAO_FILIADO,
            SITUACAO_SINDICAL.DESCONHECIDO,
          ]
        )
        .then((res) => res.rows[0])
    );
  } else if (tipo === "SITUACAO" && valor === "ATIVO") {
    tasks.push(
      pool
        .query(
          `
        SELECT
          COUNT(*) FILTER (WHERE situacao_sindical = $1)::INTEGER AS filiado_sinprf_es,
          COUNT(*) FILTER (WHERE situacao_sindical = $2)::INTEGER AS filiado_outro_sindicato,
          COUNT(*) FILTER (WHERE situacao_sindical = $3)::INTEGER AS nao_filiado,
          COUNT(*) FILTER (WHERE situacao_sindical = $4)::INTEGER AS desconhecido
        FROM filiados
        WHERE arquivado_em IS NULL
      `,
          [
            SITUACAO_SINDICAL.FILIADO_SINPRF_ES,
            SITUACAO_SINDICAL.FILIADO_OUTRO_SINDICATO,
            SITUACAO_SINDICAL.NAO_FILIADO,
            SITUACAO_SINDICAL.DESCONHECIDO,
          ]
        )
        .then((res) => res.rows[0])
    );
    tasks.push(
      pool
        .query(
          `
        SELECT COUNT(*)::INTEGER AS efetivo_total
        FROM filiados
        WHERE arquivado_em IS NULL
          AND situacao = 'ATIVO'
      `
        )
        .then((res) => res.rows[0])
    );
    tasks.push(
      Promise.all(
        LOTACOES_REPASSE.map(async (lot) => {
          const repData = await repasseService.getUltimosDadosParaRelatorio(lot);
          return { lotacao: lot, ...repData };
        })
      )
    );
  }

  const taskResults = await Promise.all(tasks);
  const result = taskResults[0];

  if (tipo === "LOTACAO") {
    const repasseData = taskResults[1];
    const sindical = taskResults[2] || {};
    const efetivoTotal = Number(repasseData?.prfTotal || 0);
    const filiadoSinprf = Number(sindical.filiado_sinprf_es || 0);
    const filiadoOutro = Number(sindical.filiado_outro_sindicato || 0);
    const percentuais = calcularPercentuaisSindicais({ efetivoTotal, filiadoSinprf, filiadoOutro });

    result.repasse = repasseData;
    result.situacaoSindicalLotacao = {
      efetivo_total_informado: efetivoTotal,
      filiado_sinprf_es: filiadoSinprf,
      filiado_outro_sindicato: filiadoOutro,
      nao_filiado: Number(sindical.nao_filiado || 0),
      desconhecido: Number(sindical.desconhecido || 0),
      ...percentuais,
    };
  } else if (tipo === "SITUACAO" && valor === "ATIVO") {
    const sindical = taskResults[1] || {};
    const efetivoTotal = Number(taskResults[2]?.efetivo_total || 0);
    const breakdown = taskResults[3];

    const filiadoSinprf = Number(sindical.filiado_sinprf_es || 0);
    const filiadoOutro = Number(sindical.filiado_outro_sindicato || 0);
    const percentuais = calcularPercentuaisSindicais({ efetivoTotal, filiadoSinprf, filiadoOutro });

    result.repasseBreakdown = breakdown;
    result.situacaoSindical = {
      efetivo_total_informado: efetivoTotal,
      filiado_sinprf_es: filiadoSinprf,
      filiado_outro_sindicato: filiadoOutro,
      nao_filiado: Number(sindical.nao_filiado || 0),
      desconhecido: Number(sindical.desconhecido || 0),
      ...percentuais,
    };
  }

  return result;
}

/**
 * Dados para o Relatório Global (Completo).
 * Agrega ATIVO (com Repasse), VETERANO (com faixas específicas) e PENSIONISTA.
 */
/**
 * Remove registros de jobs com mais de 30 dias.
 */
async function cleanupOldReports() {
  const sql = `DELETE FROM report_jobs WHERE created_at < NOW() - INTERVAL '30 days'`;
  const r = await pool.query(sql);
  return r.rowCount;
}

async function buscarDadosGlobal() {
  // BOLT: Parallelize independent database queries to reduce total latency.
  const [ativo, vetResult, penResult] = await Promise.all([
    buscarDadosAgregados("SITUACAO", "ATIVO"),
    // VETERANO com faixas etárias específicas (50-80+)
    pool.query(`
      SELECT
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE sexo = 'M')::INTEGER as masc,
        COUNT(*) FILTER (WHERE sexo = 'F')::INTEGER as fem,
        COUNT(*) FILTER (WHERE data_nascimento IS NULL)::INTEGER as idade_desconhecida,
        COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) BETWEEN 50 AND 59)::INTEGER as range_50_59,
        COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) BETWEEN 60 AND 69)::INTEGER as range_60_69,
        COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) BETWEEN 70 AND 79)::INTEGER as range_70_79,
        COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) >= 80)::INTEGER as range_80_plus
      FROM filiados
      WHERE situacao = 'VETERANO' AND arquivado_em IS NULL AND situacao_sindical = 'FILIADO_SINPRF_ES'
    `),
    // PENSIONISTA (Apenas sexo)
    pool.query(`
      SELECT
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE sexo = 'M')::INTEGER as masc,
        COUNT(*) FILTER (WHERE sexo = 'F')::INTEGER as fem
      FROM filiados
      WHERE situacao = 'PENSIONISTA' AND arquivado_em IS NULL AND situacao_sindical = 'FILIADO_SINPRF_ES'
    `)
  ]);

  return {
    ativo,
    veterano: vetResult.rows[0],
    pensionista: penResult.rows[0]
  };
}

module.exports = {
  registrarJob,
  listarHistorico,
  buscarDadosDossie,
  buscarDadosAgregados,
  buscarDadosGlobal,
  cleanupOldReports
};
