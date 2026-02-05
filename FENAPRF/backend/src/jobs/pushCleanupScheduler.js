const cron = require("node-cron");
const { runPushCleanup } = require("./pushCleanupCron");
const log = require("../utils/log");

function initPushCleanupScheduler() {
  log.info("Job.PushCleanup.SchedulerIniciado");

  // Rodar todos os dias às 03:00 da manhã
  cron.schedule("0 3 * * *", () => {
    runPushCleanup();
  });

  // Execução imediata no boot para garantir (se não rodou hoje)
  setTimeout(() => {
    runPushCleanup();
  }, 10000); // 10s após boot
}

module.exports = { initPushCleanupScheduler };
