const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 8080;
const APP_VERSION = process.env.APP_VERSION || process.env.DEPLOY_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.SOURCE_VERSION || `dev-${Date.now()}`;
const SW_DEBUG = process.env.PWA_DEBUG === '1';
const publicDir = path.join(__dirname, 'public');

const versionedAssetPattern = /\b(href|src)="(\/(?:css|js|img|icons)\/[^"]+|\/manifest\.webmanifest|\/config\.js)(?:\?[^\"]*)?"/g;

function addVersionToAssetUrl(url) {
  const parsedUrl = new URL(url, 'http://localhost');
  parsedUrl.searchParams.set('v', APP_VERSION);
  return `${parsedUrl.pathname}${parsedUrl.search}`;
}

function injectVersionIntoHtml(html) {
  return html.replace(versionedAssetPattern, (_full, attr, assetUrl) => `${attr}="${addVersionToAssetUrl(assetUrl)}"`);
}

async function sendVersionedHtml(res, fileName) {
  const htmlFilePath = path.join(publicDir, fileName);
  const html = await fs.readFile(htmlFilePath, 'utf8');
  const versionedHtml = injectVersionIntoHtml(html);

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-App-Version', APP_VERSION);
  res.type('html');
  return res.send(versionedHtml);
}

// Health Check para o Service SITE
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'site', appVersion: APP_VERSION });
});


app.get('/version.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.json({ appVersion: APP_VERSION, generatedAt: new Date().toISOString() });
});

// 1.1 Inserir rota explícita /config.js ANTES do proxy e do static
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.send(`(function () {
  const host = window.location.hostname || "";
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local");

  const LOCAL_API = "http://localhost:3000";
  const PROD_API = "https://api.sinprfes.org.br";

  const apiUrl = String(isLocal ? LOCAL_API : PROD_API).replace(/\\/+$/, "");

  window.API_BASE_URL = apiUrl;
  window.APP_VERSION = "${APP_VERSION}";
  window.ENV_CONFIG = window.ENV_CONFIG || {};
  window.ENV_CONFIG.API_URL = apiUrl;
  window.ENV_CONFIG.APP_VERSION = window.APP_VERSION;
})();`);
});

app.get('/service-worker.js', async (req, res, next) => {
  try {
    const swFilePath = path.join(publicDir, 'service-worker.js');
    const swTemplate = await fs.readFile(swFilePath, 'utf8');

    res.type('application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Service-Worker-Allowed', '/');
    const swPayload = swTemplate
      .replace(/__APP_VERSION__/g, APP_VERSION)
      .replace(/__SW_DEBUG__/g, SW_DEBUG ? 'true' : 'false');
    return res.send(swPayload);
  } catch (error) {
    return next(error);
  }
});

app.get('/', async (_req, res, next) => {
  try {
    return await sendVersionedHtml(res, 'index.html');
  } catch (error) {
    return next(error);
  }
});

app.get(/^\/[^/]+\.html$/, async (req, res, next) => {
  try {
    const fileName = path.basename(req.path);
    const htmlFilePath = path.join(publicDir, fileName);
    await fs.access(htmlFilePath);
    return await sendVersionedHtml(res, fileName);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).send('Not Found');
    }
    return next(error);
  }
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

app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const hasVersionParam = typeof req.query.v === 'string' && req.query.v.length > 0;

  if (req.path === '/service-worker.js' || req.path === '/config.js' || req.path === '/version.json') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  } else if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else if (req.path === '/manifest.webmanifest') {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  } else if (ext === '.css' || ext === '.js' || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.svg' || ext === '.webp' || ext === '.woff2' || ext === '.woff') {
    if (hasVersionParam) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }

  next();
});


// Servir arquivos estáticos do diretório 'public' com headers customizados
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    const fileName = path.basename(filePath);

    // Headers críticos para PWA e Configurações
    if (fileName === 'manifest.webmanifest') {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    // 1.3 Ajustar cache header para config.js e service-worker.js e scripts em geral
    } else if (fileName === 'service-worker.js' || fileName === 'config.js') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
    return sendVersionedHtml(res, 'index.html').catch(() => res.status(500).send('Internal Server Error'));
  }

  // 4. Se não for navegação HTML e não existir no static, 404 real
  res.status(404).send('Not Found');
});

app.listen(port, () => {
  console.log(`SINPRF-ES Site rodando na porta ${port}`);
  console.log(`Proxy configurado: /api/* -> ${API_BASE_URL}/api/*`);
  console.log(`[cache] APP_VERSION=${APP_VERSION}`);
  console.log(`[cache] SW_DEBUG=${SW_DEBUG}`);
});
