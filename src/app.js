// src/app.js
const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Rotas existentes
// REMOVER: const primeiroAcessoRoutes = require("./routes/primeiroAcesso.routes");
const filieseRoutes = require("./routes/filiese.routes");
const filiadosRoutes = require("./routes/filiados.routes");
const senhaRoutes = require("./routes/senha.routes");

// 🔹 NOVO: rotas de autenticação (login novo + 2FA + /me)
const authRoutes = require("./routes/auth.routes");

// 🔹 NOVO: rota de ressarcimento
const ressarcimentoRoutes = require("./routes/ressarcimento.routes");

// 🟢 CORREÇÃO: Importar a rota de Jogos (adicionada recentemente)
const jogosRoutes = require("./routes/jogos.routes");

// ==============================
// Prefixos de API
// ==============================

// REMOVER: app.use("/api/primeiro-acesso", primeiroAcessoRoutes);

// Login novo e rotas modernas de autenticação (inclui /login, /2fa, /me etc.)
app.use("/api/auth", authRoutes);

// Filie-se
app.use("/api", filieseRoutes);

// Dados do filiado
app.use("/api/filiados", filiadosRoutes);

// Recuperação e redefinição de senha
app.use("/api/senha", senhaRoutes);

// 🔹 Rota de ressarcimentos
app.use("/api/ressarcimentos", ressarcimentoRoutes);

// 🟢 REGISTRAR a rota de Jogos
app.use("/api/jogos", jogosRoutes);

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

module.exports = app;