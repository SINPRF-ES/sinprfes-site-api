require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Porta: em produção o Render injeta process.env.PORT
const PORT = process.env.PORT || 3000;

// Configuração opcional de banco
const connectionString = process.env.DATABASE_URL;
let pool = null;

if (connectionString) {
  let ssl = false;
  if (process.env.DB_SSL === 'true') {
    ssl = { rejectUnauthorized: false };
  }

  pool = new Pool({
    connectionString,
    ssl
  });
  console.log('🟢 Pool de conexão PostgreSQL configurado.');
} else {
  console.log('🟡 DATABASE_URL não definida. Rotas que dependem de banco ficarão limitadas.');
}

app.use(cors());
app.use(express.json());

// Log básico
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// Rota raiz - só pra você ver algo bonitinho no navegador
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="utf-8" />
        <title>SINPRF-ES</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto;">
        <h1>SINPRF-ES - Ambiente em Render</h1>
        <p>Se você está vendo esta página, o servidor Node.js está rodando corretamente no Render.</p>
        <h2>Rotas úteis</h2>
        <ul>
          <li><a href="/health">/health</a> – status básico da API</li>
          <li><a href="/db-test">/db-test</a> – testa conexão com PostgreSQL (se configurado)</li>
        </ul>
        <p>Em breve: área restrita, autenticação, integração com app, etc.</p>
      </body>
    </html>
  `);
});

// Healthcheck – Render pode usar isso pra saber se a app está viva
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API SINPRF-ES rodando',
    timestamp: new Date().toISOString()
  });
});

// Teste de banco
app.get('/db-test', async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      status: 'no-db',
      message: 'DATABASE_URL não configurada. Configure o banco antes de usar esta rota.'
    });
  }

  try {
    const result = await pool.query('SELECT NOW() AS agora');
    res.json({
      status: 'ok',
      db_time: result.rows[0].agora
    });
  } catch (err) {
    console.error('Erro ao testar banco:', err);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

// Porta de escuta
app.listen(PORT, () => {
  console.log(`🚀 Servidor SINPRF-ES rodando na porta ${PORT}`);
});
