const cron = require('node-cron');
const log = require('../utils/log');
const { syncCloudflareEdge, getCloudflareEdgeConfig } = require('../services/cloudflareEdge.service');

function buildCron(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return '*/15 * * * *';
  if (value >= 60) return '0 * * * *';
  return `*/${Math.max(1, Math.floor(value))} * * * *`;
}

function initCloudflareEdgeSyncScheduler() {
  const cfg = getCloudflareEdgeConfig();
  if (!cfg.enabled) {
    log.info('CloudflareEdgeSchedulerDisabled');
    return;
  }

  const everyMin = Number(process.env.CF_EDGE_SYNC_INTERVAL_MIN || 15);
  const cronExpr = buildCron(everyMin);
  const timezone = process.env.ANALYTICS_TIMEZONE || 'America/Sao_Paulo';

  cron.schedule(cronExpr, () => {
    syncCloudflareEdge('cron');
  }, { timezone });

  setTimeout(() => {
    syncCloudflareEdge('boot');
  }, 20_000);

  log.info('CloudflareEdgeSchedulerStarted', { cronExpr, timezone });
}

module.exports = { initCloudflareEdgeSyncScheduler };
