const axios = require('axios');
const { io } = require('socket.io-client');

const API_BASE = 'http://localhost:3000/api';
const SOCKET_BASE = 'http://localhost:3000';

async function runLoadTest(token, assId, numUsers = 10) {
  console.log(`--- INICIANDO TESTE DE CARGA (${numUsers} usuários simulados) ---`);

  const api = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` }
  });

  // 1. Simulando Check-ins massivos
  console.log(`Simulando ${numUsers} check-ins...`);
  const resToken = await api.post(`/assembleias/${assId}/token`, { tipo_chamada: 'PRIMEIRA' });
  const checkinToken = resToken.data.token;

  const startCheckin = Date.now();
  const promises = [];
  for (let i = 0; i < numUsers; i++) {
    // Em um teste real, cada usuário teria seu próprio token de auth.
    // Aqui simulamos a carga no endpoint com o mesmo usuário (idempotência).
    promises.push(api.post(`/assembleias/${assId}/checkin`, { token: checkinToken }));
  }

  await Promise.allSettled(promises);
  console.log(`Check-ins concluídos em ${Date.now() - startCheckin}ms`);

  // 2. Iniciar Votação
  const resVot = await api.post(`/assembleias/${assId}/votacoes`, {
    titulo: 'Votação sob Carga',
    descricao: 'Simulação de muitos votos simultâneos',
    duracao_segundos: 30
  });
  const votId = resVot.data.id;

  // 3. Simulando Votos massivos
  console.log(`Simulando ${numUsers} votos...`);
  const startVotos = Date.now();
  const votoPromises = [];
  for (let i = 0; i < numUsers; i++) {
    const v = i % 2 === 0 ? 'SIM' : 'NAO';
    votoPromises.push(api.post(`/assembleias/${assId}/votacoes/${votId}/voto`, { voto: v }));
  }
  await Promise.allSettled(votoPromises);
  console.log(`Votos concluídos em ${Date.now() - startVotos}ms`);

  console.log('--- TESTE DE CARGA CONCLUÍDO ---');
}

// Para rodar: TEST_TOKEN=... ASS_ID=... node scripts/assembleia-load/load_test.js
const token = process.env.TEST_TOKEN;
const assId = process.env.ASS_ID;

if (token && assId) {
  runLoadTest(token, assId, 50).catch(console.error);
} else {
  console.log('Informe TEST_TOKEN e ASS_ID para rodar o script.');
}
