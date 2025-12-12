// src/app.js
const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// --- IMPORTAÇÃO DAS ROTAS ---
const filieseRoutes = require("./routes/filiese.routes");
const filiadosRoutes = require("./routes/filiados.routes");
const senhaRoutes = require("./routes/senha.routes");
const authRoutes = require("./routes/auth.routes");
const ressarcimentoRoutes = require("./routes/ressarcimento.routes");
const jogosRoutes = require("./routes/jogos.routes");
const instagramRoutes = require("./routes/instagram.routes");

// 🟢 NOVO: Rota de Publicações (Google Drive)
const publicacoesRoutes = require("./routes/publicacoes.routes"); 

// ==============================
// REGISTRO DE ROTAS (Prefixos)
// ==============================

// Rota de status do servidor
app.use('/api/status', require('./routes/statusRouter'));

// Autenticação (Login, 2FA, Me)
app.use("/api/auth", authRoutes);

// Filie-se (Público)
app.use("/api", filieseRoutes);

// Gestão de Filiados
app.use("/api/filiados", filiadosRoutes);

// Senha
app.use("/api/senha", senhaRoutes);

// Ressarcimentos
app.use("/api/ressarcimentos", ressarcimentoRoutes);

// Jogos
app.use("/api/jogos", jogosRoutes);

// Instagram (Feed)
app.use("/api/instagram", instagramRoutes);

// 🟢 NOVO: Registrar rota de publicações
app.use("/api/publicacoes", publicacoesRoutes);

// Health Check simples
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

module.exports = app;