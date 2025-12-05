const express = require('express');
const path = require('path');

const app = express();

// Servir arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Rota de saúde
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API SINPRF-ES rodando'
  });
});

// Rota principal - entrega o index.html do site
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Porta - Render usa process.env.PORT
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SINPRF-ES rodando na porta ${PORT}`);
});
