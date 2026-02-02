const cron = require("node-cron");
const { runReportCleanup } = require("./reportCleanupCron");
const log = require("../utils/log");

function initReportCleanupScheduler() {
  log.info("Job.ReportCleanup.SchedulerIniciado");

  // Rodar todos os dias às 03:30 da manhã (um pouco depois do push cleanup)
  cron.schedule("30 3 * * *", () => {
    runReportCleanup();
  });

  // Execução imediata no boot para garantir (se não rodou hoje)
  setTimeout(() => {
    runReportCleanup();
  }, 15000); // 15s após boot
}

module.exports = { initReportCleanupScheduler };
