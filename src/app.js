const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Rotas existentes
const primeiroAcessoRoutes = require("./routes/primeiroAcesso.routes");
const loginRoutes = require("./routes/login.routes");
const filieseRoutes = require("./routes/filiese.routes");
const filiadosRoutes = require("./routes/filiados.routes");

// 🔹 NOVA rota de senha
const senhaRoutes = require("./routes/senha.routes");

// Prefixos
app.use("/api/primeiro-acesso", primeiroAcessoRoutes);
app.use("/api", loginRoutes);
app.use("/api", filieseRoutes);
app.use("/api/filiados", filiadosRoutes);

// 🔹 Aqui:
app.use("/api/senha", senhaRoutes);

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
