require("dotenv").config();
const { logDbSafeInfo } = require("./src/utils/dbLog");
const app = require("./src/app");

logDbSafeInfo("DATABASE"); // imprime apenas host/port/dbname

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SINPRF-ES rodando na porta ${PORT}`));
