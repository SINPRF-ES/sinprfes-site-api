// src/app.js
const express = require("express");
const path = require("path");
const app = express();

// Confia no proxy reverso (Render/Railway) para express-rate-limit
app.set('trust proxy', 1);

const cors = require("cors");

const allowedOrigins = [
  "https://sinprfes.org.br",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permite chamadas server-to-server/curl sem Origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(require("./middlewares/requestId"));
app.use(require("./middlewares/requestTracker")); // Rastreamento de requisições

// Configurações de Segurança de Cabeçalhos (Defense in Depth)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Limite de tamanho do corpo JSON (Proteção contra DoS)
app.use(express.json({ limit: "100kb" }));



// --- IMPORTAÇÃO DAS ROTAS ---
const filieseRoutes = require("./routes/filiese.routes");
const filiadosRoutes = require("./routes/filiados.routes");
const senhaRoutes = require("./routes/senha.routes");
const authRoutes = require("./routes/auth.routes");
const ressarcimentoRoutes = require("./routes/ressarcimento.routes");
const jogosRoutes = require("./routes/jogos.routes");
const instagramRoutes = require("./routes/instagram.routes");
const pushRoutes = require("./routes/push.routes");
const eventosRoutes = require("./routes/eventos.routes");
const eventoVotacoesRoutes = require("./routes/eventoVotacoes.routes");

// 🟢 Rota de Publicações (Google Drive)
const publicacoesRoutes = require("./routes/publicacoes.routes");
const noticiasRoutes = require("./routes/noticias.routes");
const repasseRoutes = require("./routes/repasse.routes");

// 🟣 NOVO: Rota de Votações
const votacoesRoutes = require("./routes/votacoes.routes");

// 🟦 NOVO: Rota de Assembleias
const assembleiasRoutes = require("./routes/assembleias.routes");

// 🛠️ NOVO: Rota de Diagnóstico
const diagnosticoRoutes = require("./routes/diagnostico.routes");

// 📊 NOVO: Rota de Relatórios
const reportsRoutes = require("./routes/reports.routes");

// ==============================
// REGISTRO DE ROTAS (Prefixos)
// ==============================

// Rota de status do servidor
app.use("/api/status", require("./routes/statusRouter"));

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

// Publicações
app.use("/api/publicacoes", publicacoesRoutes);
app.use("/api/noticias", noticiasRoutes);

// 💱 NOVO: Repasse
app.use("/api/repasse", repasseRoutes);

// 🟣 NOVO: Votações
app.use("/api/votacoes", votacoesRoutes);

// 🟦 NOVO: Assembleias
app.use("/api/assembleias", assembleiasRoutes);

// 🛠️ NOVO: Diagnóstico
app.use("/api/diagnostico", diagnosticoRoutes);

// Push de votações
app.use("/api/push", pushRoutes);

// 📊 NOVO: Relatórios
app.use("/api/reports", reportsRoutes);

// Push de eventos
app.use("/api/eventos", eventosRoutes);
app.use("/api/eventos", eventoVotacoesRoutes); // vai usar subrotas /:id/votacoes

// 🟧 NOVO: CMS-Lite para Blocos de Conteúdo
app.use("/api/content-blocks", require("./routes/contentBlock.routes"));

// Health Check e Root para o Service A (API)
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "api",
    message: "SINPRF-ES API"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/health", (_, res) => {
  res.json({
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString()
  });
});

// Catch-all 404 para API (Sempre JSON)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
    code: "ROUTE_NOT_FOUND"
  });
});

// Middleware Global de Erro
app.use(require("./middlewares/errorHandler"));

module.exports = app;
