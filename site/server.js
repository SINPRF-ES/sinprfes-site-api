const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 3000;

// Health Check para o Service B (Site)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'site' });
});

// Proxy interno para a API
// Evita problemas de CORS no navegador e centraliza as chamadas
app.use('/api', createProxyMiddleware({
  target: ''https://ovo8920a.up.railway.app'',
  changeOrigin: true,
  logLevel: 'debug'
}));

// Servir arquivos estáticos do diretório atual
app.use(express.static(path.join(__dirname)));

// Fallback para index.html se acessar rotas não encontradas (opcional, para comportamento amigável)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`SINPRF-ES Site rodando na porta ${port}`);
  console.log(`Proxy configurado: /api/* -> https://api.sinprfes.org.br/api/*`);
});
