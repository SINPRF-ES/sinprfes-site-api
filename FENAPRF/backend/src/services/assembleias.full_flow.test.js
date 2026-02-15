// src/services/assembleias.full_flow.test.js
const pool = require('../config/db');
const service = require('./assembleias.service');
const Textos = require('../utils/textos');

jest.mock('../config/db', () => {
  const mClient = {
    query: jest.fn(),
    release: jest.fn()
  };
  return {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mClient)
  };
});

describe('Assembleias Full Flow (Service Layer Integration)', () => {
  let mockClient;

  beforeAll(async () => {
    mockClient = await pool.connect();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockClient.query.mockReset();
    pool.query.mockReset();
  });

  test('Should execute a complete assembly lifecycle', async () => {
    const assId = '00000000-0000-4000-a000-000000000001';
    const userId = '00000000-0000-4000-a000-000000000002';
    const quorumId = '00000000-0000-4000-a000-000000000003';
    const votId = '00000000-0000-4000-a000-000000000004';
    const pUserId = '00000000-0000-4000-a000-000000000010';
    const vpUserId = '00000000-0000-4000-a000-000000000011';
    const sUserId = '00000000-0000-4000-a000-000000000020';
    const s2UserId = '00000000-0000-4000-a000-000000000021';

    // Set up a more flexible pool.query mock
    pool.query.mockImplementation((q, p) => {
        if (q.includes('INSERT INTO assembleias')) return Promise.resolve({ rows: [{ id: assId, estado: 'CRIADO' }] });
        if (q.includes('SELECT') && q.includes('FROM assembleias')) return Promise.resolve({ rows: [{ id: assId, estado: 'EM_CREDENCIAMENTO' }] });
        if (q.includes('UPDATE assembleias')) return Promise.resolve({ rows: [{ id: assId, estado: 'EM_CREDENCIAMENTO' }] });
        if (q.includes('SELECT * FROM users')) return Promise.resolve({ rows: [{ id: p[0], perfil_acesso: 'CONSELHEIRO' }] });
        if (q.includes('INSERT INTO assembleia_votos')) return Promise.resolve({ rows: [{ id: 'vote-1', voto: 'SIM' }] });
        if (q.includes('INSERT INTO auditoria')) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [] });
    });

    // 1. Criar
    const nova = await service.criar({ tipo: 'AGO', titulo: 'Ass Geral', criado_por: userId, edital_drive_file_id: 'drive-123' });
    expect(nova.estado).toBe('CRIADO');

    // 2. Abrir
    pool.query.mockImplementationOnce((q) => Promise.resolve({ rows: [{ id: assId, estado: 'CRIADO' }] })); // buscarPorId
    pool.query.mockImplementationOnce((q) => Promise.resolve({ rows: [{ id: assId, estado: 'EM_CREDENCIAMENTO' }] })); // UPDATE
    await service.abrir(assId, userId);

    // 3. Gerar Quorum (PRIMEIRA)
    mockClient.query.mockImplementation((q) => {
        if (q.includes('BEGIN')) return Promise.resolve({ rows: [] });
        if (q.includes('SELECT estado')) return Promise.resolve({ rows: [{ id: assId, estado: 'EM_CREDENCIAMENTO' }] });
        if (q.includes('SELECT id, is_global')) return Promise.resolve({ rows: [] }); // Idempotency
        if (q.includes('COUNT(*)') && q.includes('users')) return Promise.resolve({ rows: [{ total: 10 }] });
        if (q.includes('assembleia_mesa')) return Promise.resolve({ rows: [{ presidente_user_id: pUserId }] });
        if (q.includes('token = $1')) return Promise.resolve({ rows: [] }); // collision
        if (q.includes('UPDATE assembleia_quoruns')) return Promise.resolve({ rows: [] }); // close previous
        if (q.includes('INSERT INTO assembleia_quoruns')) return Promise.resolve({ rows: [{ id: quorumId, token: '111222' }] });
        if (q.includes('SELECT perfil_acesso')) return Promise.resolve({ rows: [{ perfil_acesso: 'DIRETORIA', cargo: 'Presidente da FENAPRF' }] });
        if (q.includes('INSERT INTO assembleia_checkins')) return Promise.resolve({ rows: [{ id: 'c1' }] });
        if (q.includes('COMMIT')) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [] });
    });

    const quorum = await service.gerarQuorum({ assembleia_id: assId, token: '111222', gerado_por_user_id: userId, tipo_chamada: 'PRIMEIRA' });
    expect(quorum).toBeDefined();
    expect(quorum.token).toBe('111222');

    // 4. Definir Mesa
    mockClient.query.mockReset();
    mockClient.query.mockImplementation((q) => {
        if (q.includes('BEGIN')) return Promise.resolve({ rows: [] });
        if (q.includes('SELECT estado')) return Promise.resolve({ rows: [{ id: assId, estado: 'EM_CREDENCIAMENTO' }] });
        if (q.includes('SELECT estabelecida_em')) return Promise.resolve({ rows: [] });
        if (q.includes('is_global = TRUE')) return Promise.resolve({ rows: [{ id: 'global-q' }] });
        if (q.includes('SELECT user_id FROM assembleia_checkins')) return Promise.resolve({ rows: [{ user_id: pUserId }, { user_id: vpUserId }, { user_id: sUserId }, { user_id: s2UserId }] });
        if (q.includes('INSERT INTO assembleia_mesa')) return Promise.resolve({ rows: [{ assembleia_id: assId, presidente_user_id: pUserId }] });
        if (q.includes('UPDATE assembleias')) return Promise.resolve({ rows: [{ id: assId, estado: 'INICIADO' }] });
        return Promise.resolve({ rows: [] });
    });

    // pool.query needs to mock verificarRejeicaoMesa
    pool.query.mockResolvedValue({ rows: [] });

    await service.definirMesa({
        assembleia_id: assId,
        presidente_user_id: pUserId,
        vice_presidente_user_id: vpUserId,
        secretario_user_id: sUserId,
        secretario_2_user_id: s2UserId,
        definida_por_user_id: userId
    });

    // 5. Iniciar Execução
    pool.query.mockImplementation((q) => {
        if (q.includes('SELECT estado')) return Promise.resolve({ rows: [{ id: assId, estado: 'INICIADO' }] });
        return Promise.resolve({ rows: [{ id: assId, estado: 'INICIADO' }] });
    });
    await service.iniciarExecucao(assId, userId);

    // 6. Criar Votação
    mockClient.query.mockReset();
    mockClient.query.mockImplementation((q) => {
        if (q.includes('BEGIN')) return Promise.resolve({ rows: [] });
        if (q.includes('SELECT estado')) return Promise.resolve({ rows: [{ id: assId, estado: 'INICIADO' }] });
        if (q.includes('FROM assembleia_votacoes')) return Promise.resolve({ rows: [] });
        if (q.includes('INSERT INTO assembleia_votacoes')) return Promise.resolve({ rows: [{ id: votId, status: 'ATIVA' }] });
        return Promise.resolve({ rows: [] });
    });
    await service.criarVotacao({ assembleia_id: assId, quorum_snapshot_id: quorumId, titulo: 'Item 1', iniciada_por_user_id: pUserId });

    // 7. Votar
    pool.query.mockReset();
    pool.query.mockImplementation((q, p) => {
        if (q.includes('SELECT * FROM users')) return Promise.resolve({ rows: [{ id: p[0], perfil_acesso: 'CONSELHEIRO' }] });
        if (q.includes('INSERT INTO assembleia_votos')) return Promise.resolve({ rows: [{ id: 'vote-1', voto: 'SIM' }] });
        return Promise.resolve({ rows: [] });
    });
    await service.registrarVoto(votId, sUserId, 'SIM', assId);

    // 8. Finalizar Votação
    mockClient.query.mockReset();
    mockClient.query.mockImplementation((q) => {
        if (q.includes('BEGIN')) return Promise.resolve({ rows: [] });
        if (q.includes('FROM assembleia_votacoes')) return Promise.resolve({ rows: [{ status: 'ATIVA', assembleia_id: assId }] });
        if (q.includes('SELECT c.user_id') && q.includes('LEFT JOIN assembleia_votos')) return Promise.resolve({ rowCount: 5 });
        if (q.includes('UPDATE assembleia_votacoes')) return Promise.resolve({ rows: [{ id: votId, status: 'ENCERRADA' }] });
        return Promise.resolve({ rows: [] });
    });
    await service.finalizarVotacao(votId, pUserId);

    // 9. Encerrar Assembleia
    mockClient.query.mockReset();
    mockClient.query.mockImplementation((q) => {
        if (q.includes('BEGIN')) return Promise.resolve({ rows: [] });
        if (q.includes('SELECT estado')) return Promise.resolve({ rows: [{ id: assId, estado: 'INICIADO' }] });
        if (q.includes('FROM assembleia_votacoes')) return Promise.resolve({ rows: [] });
        if (q.includes('UPDATE assembleias')) return Promise.resolve({ rows: [{ id: assId, estado: 'ENCERRADO' }] });
        return Promise.resolve({ rows: [] });
    });
    const final = await service.encerrar(assId, userId);

    expect(final.estado).toBe('ENCERRADO');
  });
});
