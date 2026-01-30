const pushCampaignService = require("../services/pushCampaign.service");
const pool = require("../config/db");
const log = require("../utils/log");

/**
 * Job para limpar campanhas antigas (retenção de 60 dias)
 * Segue o padrão BIRTHDAY_SCAN com a tabela job_runs.
 */
async function runPushCleanup() {
  const JOB_NAME = 'PUSH_CLEANUP';
  log.info("Job.PushCleanup.Iniciado");

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar se já rodou hoje com lock
    const res = await client.query(
      'SELECT last_run_date FROM job_runs WHERE job_name = $1 FOR UPDATE',
      [JOB_NAME]
    );

    if (res.rows.length === 0) {
      log.error("Job.PushCleanup.RegistroNaoEncontrado", { JOB_NAME });
      await client.query('ROLLBACK');
      return;
    }

    // Determina a data atual no timezone de Brasília
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    const lastRun = res.rows[0].last_run_date;
    if (lastRun === todayStr) {
      log.info("Job.PushCleanup.JaExecutadoHoje", { todayStr });
      await client.query('ROLLBACK');
      return;
    }

    // 2. Executar limpeza
    const deletedCount = await pushCampaignService.cleanupOldCampaigns();
    log.info("Job.PushCleanup.Sucesso", { deletedCount });

    // 3. Atualizar last_run_date
    await client.query(
      'UPDATE job_runs SET last_run_date = $1, updated_at = NOW() WHERE job_name = $2',
      [todayStr, JOB_NAME]
    );

    await client.query('COMMIT');
    log.info("Job.PushCleanup.Finalizado");

  } catch (error) {
    await client.query('ROLLBACK');
    log.error("Job.PushCleanup.Erro", { error: error.message, stack: error.stack });
  } finally {
    client.release();
  }
}

module.exports = { runPushCleanup };
