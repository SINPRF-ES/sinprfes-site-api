require("dotenv").config();
const { logDbSafeInfo } = require("./src/utils/dbLog");
const app = require("./src/app");
const http = require("http");
const assembleiaSocket = require("./src/websocket/assembleia.socket");

logDbSafeInfo("DATABASE"); // imprime apenas host/port/dbname

const server = http.createServer(app);

// Schedulers
const { initBirthdayScheduler } = require("./src/jobs/birthdayScheduler");
const { initPushCleanupScheduler } = require("./src/jobs/pushCleanupScheduler");
const { initReportCleanupScheduler } = require("./src/jobs/reportCleanupScheduler");

// Porta (obrigatório usar process.env.PORT em ambientes cloud)
const PORT = process.env.PORT || 3000;

/**
 * IMPORTANTE (Cloud Deployment):
 * - Precisamos abrir a porta o mais cedo possível para não estourar o port scan timeout.
 * - Depois do bind, inicializamos sockets e schedulers em background.
 */
server.listen(PORT, "0.0.0.0", () => {
  console.log(`SINPRF-ES rodando na porta ${PORT}`);

  setImmediate(() => {
    // Socket.IO / WebSocket da assembleia
    try {
      assembleiaSocket.init(server);
      console.log("[BOOT] assembleiaSocket inicializado");
    } catch (e) {
      console.error("[BOOT] assembleiaSocket init failed:", e?.message);
    }

    // Inicializa o scheduler de aniversariantes (cron + boot trigger)
    try {
      initBirthdayScheduler();
      console.log("[BOOT] birthdayScheduler inicializado");
    } catch (e) {
      console.error("[BOOT] birthdayScheduler init failed:", e?.message);
    }

    // Inicializa o scheduler de limpeza de push (60 dias)
    try {
      initPushCleanupScheduler();
      console.log("[BOOT] pushCleanupScheduler inicializado");
    } catch (e) {
      console.error("[BOOT] pushCleanupScheduler init failed:", e?.message);
    }

    // Inicializa o scheduler de limpeza de relatórios (30 dias)
    try {
      initReportCleanupScheduler();
      console.log("[BOOT] reportCleanupScheduler inicializado");
    } catch (e) {
      console.error("[BOOT] reportCleanupScheduler init failed:", e?.message);
    }
  });
});
