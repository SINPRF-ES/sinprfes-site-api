// src/services/reports.service.js
const pool = require("../config/db");
const usersService = require("./users.service");
const { generateUuid } = require("../utils/format");
const { UFS } = require("../../shared/canon");

/**
 * Registra um novo job de relatório para auditoria.
 */
async function registrarJob(report_type, params, requester) {
  // Garantir que requesterId seja uma string (UUID) ou null
  const requesterId = (requester?.id && typeof requester.id === 'string') ? requester.id : null;
  const newId = generateUuid();

  const { rows } = await pool.query(
    `INSERT INTO report_jobs (id, report_type, params, requester_id, requester_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [newId, report_type, JSON.stringify(params), requesterId, requester.nome]
  );
  return rows[0];
}

/**
 * Retorna o histórico de relatórios gerados.
 */
async function listarHistorico(requester_id = null) {
  // FENAPRF: SQL JOIN para evitar N+1 ao resolver nomes de alvos de relatórios individuais
  let query = `
    SELECT
      j.*,
      u.name as target_user_name
    FROM report_jobs j
    LEFT JOIN users u ON (
      j.report_type = 'INDIVIDUAL' AND
      (j.params->>'userId')::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND
      (j.params->>'userId')::uuid = u.id
    )
  `;
  const params = [];
  if (requester_id) {
    query += ` WHERE j.requester_id = $1`;
    params.push(requester_id);
  }
  query += ` ORDER BY j.created_at DESC LIMIT 50`;
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

  if (tipo === "UF") {
    whereClause += " AND uf = $1";
    params.push(valor);
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

  return result;
}

/**
 * Dados para o Relatório Global (Completo).
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
  // FENAPRF: Relatório Global consolidado por situação funcional
  const totalGeral = await buscarDadosAgregados("GLOBAL", null);

  // Busca detalhamento por situação funcional
  const { rows: situacoes } = await pool.query(`
    SELECT
      situacao,
      COUNT(*)::INTEGER as total,
      COUNT(*) FILTER (WHERE sexo = 'M')::INTEGER as masc,
      COUNT(*) FILTER (WHERE sexo = 'F')::INTEGER as fem
    FROM users
    WHERE arquivado_em IS NULL
    GROUP BY situacao
    ORDER BY total DESC
  `);

  // Monta estrutura compatível com o PDF e Controller
  const result = {
    membros: totalGeral,
    porSituacao: situacoes,
    // Fallbacks para compatibilidade com campos esperados no controller
    ativo: situacoes.find(s => s.situacao === 'ATIVO') || { total: 0, masc: 0, fem: 0 },
    veterano: situacoes.find(s => s.situacao === 'VETERANO') || { total: 0, masc: 0, fem: 0 },
    pensionista: situacoes.find(s => s.situacao === 'PENSIONISTA') || { total: 0, masc: 0, fem: 0 }
  };

  return result;
}

module.exports = {
  registrarJob,
  listarHistorico,
  buscarDadosDossie,
  buscarDadosAgregados,
  buscarDadosGlobal,
  cleanupOldReports
};
