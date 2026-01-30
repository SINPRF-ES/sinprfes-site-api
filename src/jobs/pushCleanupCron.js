const pushCampaignService = require("../services/pushCampaign.service");
const pool = require("../config/db");
const log = require("../utils/log");

/**
 * Job para limpar campanhas antigas (retenção de 60 dias)
 */
async function runPushCleanup() {
  const JOB_NAME = 'PUSH_CLEANUP';
  log.info("Job.PushCleanup.Iniciado");

  try {
    // 1. Verificar se já rodou hoje
    const checkSql = "SELECT last_run FROM job_runs WHERE job_name = $1";
    const { rows } = await pool.query(checkSql, [JOB_NAME]);

    if (rows.length > 0) {
      const lastRun = new Date(rows[0].last_run);
      const today = new Date();
      if (lastRun.toDateString() === today.toDateString()) {
        log.info("Job.PushCleanup.JaExecutadoHoje", { lastRun });
        return;
      }
    }

    // 2. Executar limpeza
    const deletedCount = await pushCampaignService.cleanupOldCampaigns();
    log.info("Job.PushCleanup.Sucesso", { deletedCount });

    // 3. Atualizar last_run
    await pool.query(
      "INSERT INTO job_runs (job_name, last_run) VALUES ($1, NOW()) ON CONFLICT (job_name) DO UPDATE SET last_run = NOW()",
      [JOB_NAME]
    );

  } catch (error) {
    log.error("Job.PushCleanup.Erro", { error: error.message });
  }
}

module.exports = { runPushCleanup };
