const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 8080;

// Health Check para o Service SITE
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'site' });
});

// 1.1 Inserir rota explícita /config.js ANTES do proxy e do static
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.sendFile(path.join(__dirname, 'public', 'config.js'));
});

// Proxy do site -> API
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.sinprfes.org.br';

// 1.2 Corrigir o proxy /api removendo pathRewrite (evitar /api/api)
app.use('/api', createProxyMiddleware({
  target: API_BASE_URL,
  changeOrigin: true,
  logLevel: 'warn',

  // Express remove o prefixo "/api" ao montar o middleware.
  // Reanexamos para a API que expõe rotas sob "/api/*".
  pathRewrite: (path) => `/api${path}`,

  on: {
    proxyReq: (proxyReq, req) => {
      // req.url aqui já está sem o "/api" (ex.: "/filiese")
      console.log(`[proxy] ${req.method} ${req.originalUrl} -> ${API_BASE_URL}/api${req.url}`);
    }
  }
}));


// Servir arquivos estáticos do diretório 'public' com headers customizados
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    const fileName = path.basename(filePath);

    // Headers críticos para PWA e Configurações
    if (fileName === 'manifest.webmanifest') {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
    // 1.3 Ajustar cache header para config.js e service-worker.js
    } else if (fileName === 'service-worker.js' || fileName === 'config.js') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    } else if (fileName === 'index.html') {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Fallback para arquivos em /shared (suporte para monorepo local)
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

// Fallback inteligente para index.html (SPA/PWA)
app.get('*', (req, res) => {
  const pathname = req.path;
  const ext = path.extname(pathname).toLowerCase();

  // 1. Proteger rotas de API
  if (pathname.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  // 2. Bloquear fallback para QUALQUER coisa que pareça um arquivo (tenha extensão)
  // Isso evita que o browser receba HTML quando espera JS/CSS/Imagens.
  if (ext && ext.length > 1) {
    if (ext === '.js') {
      res.type('application/javascript');
      return res.status(404).send('/* 404: File Not Found */');
    }
    return res.status(404).send('Not Found');
  }

  // 3. Fallback apenas para rotas de navegação (sem extensão) que aceitam HTML
  if (req.accepts('html')) {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  // 4. Se não for navegação HTML e não existir no static, 404 real
  res.status(404).send('Not Found');
});

app.listen(port, () => {
  console.log(`SINPRF-ES Site rodando na porta ${port}`);
  console.log(`Proxy configurado: /api/* -> ${API_BASE_URL}/api/*`);
});
