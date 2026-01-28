const cron = require('node-cron');
const { runBirthdayScan } = require('./birthdayCron');

let isRunning = false;

async function executeJob(triggerType) {
  if (isRunning) {
    console.log(`[BirthdayScheduler] trigger start: ${triggerType} (skipped: already running)`);
    return;
  }

  isRunning = true;
  console.log(`[BirthdayScheduler] trigger start: ${triggerType}`);

  try {
    await runBirthdayScan();
  } catch (error) {
    console.error(`[BirthdayScheduler] error in ${triggerType}:`, error);
  } finally {
    isRunning = false;
    console.log(`[BirthdayScheduler] trigger end: ${triggerType}`);
  }
}

function initBirthdayScheduler() {
  // 1. Cron trigger: Daily at 08:00 America/Sao_Paulo
  const cronExpression = '0 8 * * *';
  const timezone = 'America/Sao_Paulo';

  cron.schedule(cronExpression, () => {
    executeJob('cron');
  }, {
    timezone: timezone
  });

  console.log(`[BirthdayScheduler] cron scheduled ${cronExpression} ${timezone}`);

  // 2. Boot trigger: Catch-up after 15s
  console.log(`[BirthdayScheduler] boot trigger scheduled`);
  setTimeout(() => {
    executeJob('boot');
  }, 15000);
}

module.exports = { initBirthdayScheduler };
