const axios = require('axios');
const { io } = require('socket.io-client');

const API_BASE = 'http://localhost:3000/api';
const SOCKET_BASE = 'http://localhost:3000';

async function runSmokeTest() {
  console.log('--- INICIANDO SMOKE TEST ASSEMBLEIA ---');

  // 1. Login (usuário DIRETORIA)
  // Assumindo que temos um usuário de teste ou pegando do ambiente
  // Para o sandbox, vou tentar usar um login existente ou mockar
  // Mas para um script real, precisaríamos de credenciais.
  // Vou simular os requests assumindo que o servidor está rodando e temos bypass ou credenciais.

  // NOTE: Este script é uma coleção de exemplos de como testar o fluxo.
  // Para rodar de verdade, precisa de um token válido.

  const token = process.env.TEST_TOKEN;
  if (!token) {
    console.error('ERRO: TEST_TOKEN não informado.');
    return;
  }

  const api = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` }
  });

  try {
    // 1. Criar Assembleia
    console.log('1. Criando Assembleia...');
    const resAss = await api.post('/assembleias', {
      tipo: 'AGE',
      titulo: 'Assembleia de Teste E2E',
      pauta: 'Pauta de teste automatizado.',
      data_evento: '2026-01-24',
      hora_primeira_chamada: '10:00',
      hora_segunda_chamada: '10:30'
    });
    const assId = resAss.data.id;
    console.log(`Assembleia criada: ${assId}`);

    // Conectar Socket
    const socket = io(SOCKET_BASE, { auth: { token }, transports: ['websocket'] });
    socket.emit('join_assembleia', assId);
    socket.on('assembleia:status_changed', (data) => console.log('[Socket] Status alterado:', data));
    socket.on('votacao:iniciada', (data) => console.log('[Socket] Votação iniciada:', data.titulo));

    // 2. Abrir
    console.log('2. Abrindo Assembleia...');
    await api.post(`/assembleias/${assId}/abrir`);

    // 3. Gerar Token
    console.log('3. Gerando Token de Quórum...');
    const resToken = await api.post(`/assembleias/${assId}/token`, { tipo_chamada: 'PRIMEIRA' });
    const checkinToken = resToken.data.token;
    console.log(`Token gerado: ${checkinToken}`);

    // 4. Check-in (O gerador já fez auto-checkin, vamos simular outro se tivéssemos mais tokens)
    console.log('4. Realizando Check-in...');
    await api.post(`/assembleias/${assId}/checkin`, { token: checkinToken });

    // 5. Compor Mesa
    console.log('5. Definindo Mesa...');
    // Usando o próprio ID do usuário logado para Presidente e Secretário (apenas para teste)
    const me = await api.get('/auth/me'); // Ajustar se existir rota /me
    const myId = me.data.id;
    await api.post(`/assembleias/${assId}/mesa`, {
      presidente_user_id: myId,
      secretario_user_id: myId
    });

    // 6. Iniciar Execução
    console.log('6. Iniciando Execução...');
    await api.post(`/assembleias/${assId}/iniciar-execucao`);

    // 7. Iniciar Votação
    console.log('7. Iniciando Votação...');
    const resVot = await api.post(`/assembleias/${assId}/votacoes`, {
      titulo: 'Aprovação de Pauta',
      descricao: 'Você aprova a pauta?',
      duracao_segundos: 10
    });
    const votId = resVot.data.id;

    // 8. Votar
    console.log('8. Registrando Voto...');
    await api.post(`/assembleias/${assId}/votacoes/${votId}/voto`, { voto: 'SIM' });

    // 9. Encerrar Votação (antecipado)
    console.log('9. Encerrando Votação antecipadamente...');
    await api.post(`/assembleias/${assId}/votacoes/${votId}/encerrar`);

    // 10. Recontagem
    console.log('10. Solicitando Recontagem...');
    await api.post(`/assembleias/${assId}/token`, { tipo_chamada: 'RECONTAGEM' });

    // 11. Encerrar Assembleia
    console.log('11. Encerrando Assembleia...');
    await api.post(`/assembleias/${assId}/encerrar`);

    // 12. Solicitar Relatório
    console.log('12. Solicitando Relatório...');
    const resRel = await api.post(`/assembleias/${assId}/relatorio`);
    console.log('Relatório solicitado:', resRel.data);

    console.log('--- SMOKE TEST CONCLUÍDO COM SUCESSO ---');
    socket.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('ERRO NO SMOKE TEST:', err.response?.data || err.message);
    process.exit(1);
  }
}

runSmokeTest();
