require("dotenv").config();
const { logDbSafeInfo } = require("./src/utils/dbLog");
const app = require("./src/app");
const http = require("http");
const assembleiaSocket = require("./src/websocket/assembleia.socket");

logDbSafeInfo("DATABASE"); // imprime apenas host/port/dbname

const { initBirthdayJob } = require("./src/jobs/birthdayCron");

const server = http.createServer(app);
assembleiaSocket.init(server);

// Inicializa Jobs
initBirthdayJob();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SINPRF-ES rodando na porta ${PORT}`));
