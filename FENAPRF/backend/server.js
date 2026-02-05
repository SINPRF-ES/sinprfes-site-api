require("dotenv").config();
const { logDbSafeInfo } = require("./src/utils/dbLog");
const app = require("./src/app");
const http = require("http");
const assembleiaSocket = require("./src/websocket/assembleia.socket");

logDbSafeInfo("DATABASE"); // imprime apenas host/port/dbname

const server = http.createServer(app);
assembleiaSocket.init(server);
const { initBirthdayScheduler } = require("./src/jobs/birthdayScheduler");

logDbSafeInfo("DATABASE"); // imprime apenas host/port/dbname

// Inicializa o scheduler de aniversariantes (cron + boot trigger)
initBirthdayScheduler();

// Inicializa o scheduler de limpeza de push (60 dias)
const { initPushCleanupScheduler } = require("./src/jobs/pushCleanupScheduler");
initPushCleanupScheduler();

// Inicializa o scheduler de limpeza de relatórios (30 dias)
const { initReportCleanupScheduler } = require("./src/jobs/reportCleanupScheduler");
initReportCleanupScheduler();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`FENAPRF rodando na porta ${PORT}`));
