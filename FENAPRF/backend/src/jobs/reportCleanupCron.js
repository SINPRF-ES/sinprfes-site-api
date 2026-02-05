const reportsService = require("../services/reports.service");
const pool = require("../config/db");
const log = require("../utils/log");

/**
 * Job para limpar solicitações de relatórios antigas (retenção de 30 dias)
 * Segue o padrão PUSH_CLEANUP com a tabela job_runs.
 */
async function runReportCleanup() {
  const JOB_NAME = 'REPORT_CLEANUP';
  log.info("Job.ReportCleanup.Iniciado");

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar se já rodou hoje com lock
    const res = await client.query(
      'SELECT last_run_date FROM job_runs WHERE job_name = $1 FOR UPDATE',
      [JOB_NAME]
    );

    if (res.rows.length === 0) {
      // Se não existe, cria o registro inicial para permitir execuções futuras
      await client.query(
        'INSERT INTO job_runs (job_name, last_run_date, updated_at) VALUES ($1, $2, NOW())',
        [JOB_NAME, '1900-01-01']
      );
      log.info("Job.ReportCleanup.RegistroCriado", { JOB_NAME });
    }

    // Determina a data atual no timezone de Brasília
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    const lastRun = res.rows.length > 0 ? res.rows[0].last_run_date : '1900-01-01';
    if (lastRun === todayStr) {
      log.info("Job.ReportCleanup.JaExecutadoHoje", { todayStr });
      await client.query('ROLLBACK');
      return;
    }

    // 2. Executar limpeza
    const deletedCount = await reportsService.cleanupOldReports();
    log.info("Job.ReportCleanup.Sucesso", { deletedCount });

    // 3. Atualizar last_run_date
    await client.query(
      'UPDATE job_runs SET last_run_date = $1, updated_at = NOW() WHERE job_name = $2',
      [todayStr, JOB_NAME]
    );

    await client.query('COMMIT');
    log.info("Job.ReportCleanup.Finalizado");

  } catch (error) {
    await client.query('ROLLBACK');
    log.error("Job.ReportCleanup.Erro", { error: error.message, stack: error.stack });
  } finally {
    client.release();
  }
}

module.exports = { runReportCleanup };
