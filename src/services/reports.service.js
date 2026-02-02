// src/services/reports.service.js
const pool = require("../config/db");
const filiadosService = require("./filiados.service");
const repasseService = require("./repasse.service");
const { SITUACAO_FUNCIONAL, LOTACOES } = require("../../shared/canon");

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
    FROM filiados
    ${whereClause}
  `;

  const { rows } = await pool.query(query, params);
  const result = rows[0];

  // Adiciona dados do Repasse se for relatório por Lotação
  if (tipo === "LOTACAO") {
    const repasseData = await repasseService.getUltimosDadosParaRelatorio(valor);
    result.repasse = repasseData;
  }

  return result;
}

module.exports = {
  registrarJob,
  listarHistorico,
  buscarDadosDossie,
  buscarDadosAgregados
};
