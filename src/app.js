// src/app.js
const express = require("express");
const path = require("path");
const app = express();

const cors = require("cors");

const allowedOrigins = [
  "https://sinprfes.org.br",
  "https://www.sinprfes.org.br",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite chamadas server-to-server/curl sem Origin
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Preflight
app.options("*", cors());

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/shared", express.static(path.join(process.cwd(), "shared")));

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

// 🟣 NOVO: Rota de Votações
const votacoesRoutes = require("./routes/votacoes.routes");

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

// 🟣 NOVO: Votações
app.use("/api/votacoes", votacoesRoutes);

// Push de votações
app.use("/api/push", pushRoutes);

// Push de eventos
app.use("/api/eventos", eventosRoutes);
app.use("/api/eventos", eventoVotacoesRoutes); // vai usar subrotas /:id/votacoes

// Health Check simples
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
