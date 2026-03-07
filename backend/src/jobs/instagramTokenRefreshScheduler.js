const cron = require("node-cron");

const log = require("../utils/log");
const { getStatus, refreshLongLivedAccessToken } = require("../services/instagramOfficialService");

const CRON_EXPRESSION = "0 6 * * *";
const TIMEZONE = "America/Sao_Paulo";

let isRefreshing = false;

async function runRefresh(trigger = "cron") {
  if (isRefreshing) {
    return;
  }

  const status = getStatus();
  if (!status.configured || !status.hasAccessToken || !status.refreshEnabled) {
    return;
  }

  isRefreshing = true;
  log.info("InstagramOfficialTokenRefreshStarted", {
    trigger,
    refreshEnabled: status.refreshEnabled,
    tokenSource: status.tokenSource,
  });

  try {
    await refreshLongLivedAccessToken();
  } catch (error) {
    log.warn("InstagramOfficialTokenRefreshFailed", {
      trigger,
      errorMessage: error?.message,
      tokenSource: getStatus().tokenSource,
    });
  } finally {
    isRefreshing = false;
  }
}

function initInstagramTokenRefreshScheduler() {
  cron.schedule(CRON_EXPRESSION, () => {
    runRefresh("cron");
  }, { timezone: TIMEZONE });

  setTimeout(() => {
    runRefresh("boot");
  }, 15_000);
}

module.exports = {
  initInstagramTokenRefreshScheduler,
};
