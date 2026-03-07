// src/app.js
const express = require("express");
const path = require("path");
const app = express();

// Confia no proxy reverso (Render/Railway) para express-rate-limit
app.set('trust proxy', 1);

const cors = require("cors");

app.use(require("./middlewares/requestId"));
app.use(require("./middlewares/requestTracker")); // Rastreamento de requisições


const DEFAULT_PROD_ORIGINS = [
  "https://sinprfes.org.br",
  "https://www.sinprfes.org.br",
];

const DEFAULT_DEV_ORIGINS = [
  ...DEFAULT_PROD_ORIGINS,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

function parseAllowedOrigins() {
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (envOrigins.length > 0) return envOrigins;

  if (process.env.NODE_ENV === "production") {
    return DEFAULT_PROD_ORIGINS;
  }

  return DEFAULT_DEV_ORIGINS;
}

const allowedOrigins = parseAllowedOrigins();

if (process.env.NODE_ENV !== "production") {
  console.log("[CORS] Allowed origins:", allowedOrigins.join(", "));
}

const corsOptions = {
  origin: function (origin, callback) {
    // Permite chamadas server-to-server/curl sem Origin
    if (!origin) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[CORS] Origin ausente (permitido para server-to-server)");
      }
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[CORS] Origin permitido: ${origin}`);
      }
      return callback(null, true);
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(`[CORS] Origin bloqueado: ${origin}`);
    }

    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "Accept", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Configurações de Segurança de Cabeçalhos (Defense in Depth)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// Limite de tamanho do corpo JSON (Proteção contra DoS)
app.use(express.json({ limit: "100kb" }));

/**
 * ==============================
 * 🧪 TESTE MINIO (POST /api/test-upload)
 * ==============================
 * Requer variáveis:
 * - MINIO_ENDPOINT (ex: https://sindicato-files.sinprfes.org.br)
 * - MINIO_BUCKET   (ex: documentos)
 * - MINIO_ACCESS_KEY (ex: svc_sindicato)
 * - MINIO_SECRET_KEY (senha do svc)
 */
app.post("/api/test-upload", async (req, res) => {
  try {
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

    const endpoint = process.env.MINIO_ENDPOINT;
    const bucket = process.env.MINIO_BUCKET;
    const accessKeyId = process.env.MINIO_ACCESS_KEY;
    const secretAccessKey = process.env.MINIO_SECRET_KEY;

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      return res.status(500).json({
        success: false,
        error: "Variáveis MINIO_* ausentes (MINIO_ENDPOINT, MINIO_BUCKET, MINIO_ACCESS_KEY, MINIO_SECRET_KEY)."
      });
    }

    const s3 = new S3Client({
      region: "us-east-1",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `health/test-${Date.now()}.txt`,
      Body: "ok",
      ContentType: "text/plain",
    }));

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: String(e && e.message ? e.message : e)
    });
  }
});

// --- IMPORTAÇÃO DAS ROTAS ---
const filieseRoutes = require("./routes/filiese.routes");
const filiadosRoutes = require("./routes/filiados.routes");
const senhaRoutes = require("./routes/senha.routes");
const authRoutes = require("./routes/auth.routes");
const ressarcimentoRoutes = require("./routes/ressarcimento.routes");
const jogosRoutes = require("./routes/jogos.routes");
const pushRoutes = require("./routes/push.routes");
const eventosRoutes = require("./routes/eventos.routes");
const eventoVotacoesRoutes = require("./routes/eventoVotacoes.routes");

// 🟢 Rota de Publicações (Google Drive)
const publicacoesRoutes = require("./routes/publicacoes.routes");
const noticiasRoutes = require("./routes/noticias.routes");
const informesRoutes = require("./routes/informes.routes");
const repasseRoutes = require("./routes/repasse.routes");
const adminInstagramIntegrationRoutes = require("./routes/adminInstagramIntegration.routes");

// 🟣 NOVO: Rota de Votações
const votacoesRoutes = require("./routes/votacoes.routes");

// 🟦 NOVO: Rota de Assembleias
const assembleiasRoutes = require("./routes/assembleias.routes");

// 🛠️ NOVO: Rota de Diagnóstico
const diagnosticoRoutes = require("./routes/diagnostico.routes");

// 📊 NOVO: Rota de Relatórios
const reportsRoutes = require("./routes/reports.routes");
const consultaProcessualRoutes = require("./routes/consultaProcessual.routes");

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

// Instagram (Feed público + integração oficial Meta)
app.use("/api/public", require("./routes/publicInstagramFeed"));
app.use("/api/admin/integrations/instagram", adminInstagramIntegrationRoutes);

// Publicações
app.use("/api/publicacoes", publicacoesRoutes);
app.use("/api/noticias", noticiasRoutes);
app.use("/api/informes", informesRoutes);

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

// ⚖️ Consulta Processual
app.use("/api/consulta-processual", consultaProcessualRoutes);

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
