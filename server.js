require("dotenv").config();
const { logDbSafeInfo } = require("./src/utils/dbLog");
const app = require("./src/app");
const http = require("http");
const assembleiaSocket = require("./src/websocket/assembleia.socket");

logDbSafeInfo("DATABASE"); // imprime apenas host/port/dbname

const server = http.createServer(app);
assembleiaSocket.init(server);
const { runBirthdayScan } = require("./src/jobs/birthdayCron");

logDbSafeInfo("DATABASE"); // imprime apenas host/port/dbname

// Nota: O scan de aniversários pode ser agendado aqui se usássemos node-cron,
// mas seguindo o padrão de "Job" do arquivo, ele é disparado manualmente ou via cron externo.
// O job possui trava de idempotência interna via banco de dados.
if (process.env.BIRTHDAY_SCAN_ON_BOOT === "true") {
  runBirthdayScan();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SINPRF-ES rodando na porta ${PORT}`));
