// src/services/reports.service.js
const pool = require("../config/db");
const usersService = require("./users.service");
const repasseService = require("./repasse.service");
const { SITUACAO_FUNCIONAL, LOTACOES, LOTACOES_REPASSE } = require("../../shared/canon");

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
async function buscarDadosDossie(userId) {
  const user = await usersService.buscarPorId(userId);
  return user;
}

/**
 * Dados agregados para relatórios estatísticos.
 */
async function buscarDadosAgregados(tipo, valor) {
  let whereClause = "WHERE arquivado_em IS NULL";
  const params = [];

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
    whereClause += " AND UPPER(lotacao) LIKE $1 AND situacao = 'ATIVO'";
    params.push(`%${kw.toUpperCase()}%`);
  } else if (tipo === "SITUACAO") {
    whereClause += " AND situacao = $1";
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
    FROM users
    ${whereClause}
  `;

  const { rows } = await pool.query(query, params);
  const result = rows[0];

  // Adiciona dados do Repasse se for relatório por Lotação
  if (tipo === "LOTACAO") {
    const repasseData = await repasseService.getUltimosDadosParaRelatorio(valor);
    result.repasse = repasseData;
  }

  // Especial: Situação ATIVO deve consumir Repasse globalmente e por lotação
  if (tipo === "SITUACAO" && valor === "ATIVO") {
    const breakdown = [];
    for (const lot of LOTACOES_REPASSE) {
      const repData = await repasseService.getUltimosDadosParaRelatorio(lot);
      breakdown.push({ lotacao: lot, ...repData });
    }
    result.repasseBreakdown = breakdown;
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
  const ativo = await buscarDadosAgregados("SITUACAO", "ATIVO");

  // VETERANO com faixas etárias específicas (50-80+)
  const { rows: vetRows } = await pool.query(`
    SELECT
      COUNT(*)::INTEGER as total,
      COUNT(*) FILTER (WHERE sexo = 'M')::INTEGER as masc,
      COUNT(*) FILTER (WHERE sexo = 'F')::INTEGER as fem,
      COUNT(*) FILTER (WHERE data_nascimento IS NULL)::INTEGER as idade_desconhecida,
      COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) BETWEEN 50 AND 59)::INTEGER as range_50_59,
      COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) BETWEEN 60 AND 69)::INTEGER as range_60_69,
      COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) BETWEEN 70 AND 79)::INTEGER as range_70_79,
      COUNT(*) FILTER (WHERE data_nascimento IS NOT NULL AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, data_nascimento)) >= 80)::INTEGER as range_80_plus
    FROM users
    WHERE situacao = 'VETERANO' AND arquivado_em IS NULL
  `);

  // PENSIONISTA (Apenas sexo)
  const { rows: penRows } = await pool.query(`
    SELECT
      COUNT(*)::INTEGER as total,
      COUNT(*) FILTER (WHERE sexo = 'M')::INTEGER as masc,
      COUNT(*) FILTER (WHERE sexo = 'F')::INTEGER as fem
    FROM users
    WHERE situacao = 'PENSIONISTA' AND arquivado_em IS NULL
  `);

  return {
    ativo,
    veterano: vetRows[0],
    pensionista: penRows[0]
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
