// src/app.js
const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// ==============================
// Importação de Rotas
// ==============================

// REMOVIDO: const primeiroAcessoRoutes = require("./routes/primeiroAcesso.routes");
const filieseRoutes = require("./routes/filiese.routes");
const filiadosRoutes = require("./routes/filiados.routes");
const senhaRoutes = require("./routes/senha.routes");
const authRoutes = require("./routes/auth.routes");
const ressarcimentoRoutes = require("./routes/ressarcimento.routes");

// ==============================
// Prefixos de API
// ==============================

// REMOVIDO: app.use("/api/primeiro-acesso", primeiroAcessoRoutes);

// Login moderno e rotas de autenticação (inclui /login, /2fa, /me etc.)
app.use("/api/auth", authRoutes);

// Filie-se
app.use("/api", filieseRoutes);

// Dados do filiado (CRUD e visualização)
app.use("/api/filiados", filiadosRoutes);

// Recuperação e redefinição de senha
app.use("/api/senha", senhaRoutes);

// Rota de ressarcimentos
app.use("/api/ressarcimentos", ressarcimentoRoutes);

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

module.exports = app;