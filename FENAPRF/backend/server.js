require("dotenv").config();

// Handlers globais para capturar erros fatais e logar no Render
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED_REJECTION] em:', promise, 'razão:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT_EXCEPTION] Fatal:', err?.stack || err);
    // Em caso de erro não tratado, o ideal é deixar o processo cair para o Render reiniciar
    setTimeout(() => process.exit(1), 1000);
});

// Validação de variáveis de ambiente críticas
const CRITICAL_ENV_VARS = ["DATABASE_URL", "JWT_SECRET"];
const missingVars = CRITICAL_ENV_VARS.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    console.error("❌ ERRO CRÍTICO: Variáveis de ambiente obrigatórias ausentes:");
    missingVars.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
}

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
