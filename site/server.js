const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 8080;

// Health Check para o Service SITE
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'site' });
});

// Proxy do site -> API
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.sinprfes.org.br';

app.use('/api', createProxyMiddleware({
  target: API_BASE_URL,
  changeOrigin: true,
  logLevel: 'warn',
  pathRewrite: {
    '^/': '/api/', // Prepend /api back for the backend
  },
}));

// Servir arquivos estáticos do diretório 'public'
// Isso protege arquivos sensíveis como server.js e railway.toml
app.use(express.static(path.join(__dirname, 'public')));

// Fallback para arquivos em /shared (suporte para monorepo local)
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

// Fallback para index.html apenas para rotas que não sejam /api
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`SINPRF-ES Site rodando na porta ${port}`);
  console.log(`Proxy configurado: /api/* -> ${API_BASE_URL}/api/*`);
});
