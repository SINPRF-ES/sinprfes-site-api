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
// Para paridade de funcionalidade sem adicionar dependências de cron pesadas:
runBirthdayScan(); // Dispara scan básico no boot

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SINPRF-ES rodando na porta ${PORT}`));
