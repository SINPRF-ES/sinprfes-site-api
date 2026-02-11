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

    // 1. Criar
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'CRIADO' }] }); // INSERT ass
    pool.query.mockResolvedValueOnce({ rows: [] }); // Audit
    const nova = await service.criar({ tipo: 'AGO', titulo: 'Ass Geral', criado_por: userId, edital_drive_file_id: 'drive-123' });
    expect(nova.estado).toBe('CRIADO');

    // 2. Abrir
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'CRIADO' }] }); // buscarPorId
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'EM_CREDENCIAMENTO' }] }); // UPDATE
    pool.query.mockResolvedValue({ rows: [] }); // Audits
    await service.abrir(assId, userId);

    // 3. Gerar Quorum (PRIMEIRA)
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'EM_CREDENCIAMENTO' }] }); // ass FOR UPDATE
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // Idempotency check
    mockClient.query.mockResolvedValueOnce({ rows: [{ total: 10 }] }); // counts
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // collision check
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // close previous
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: quorumId, token: '111222' }] }); // insert quorum
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // audit
    mockClient.query.mockResolvedValueOnce({ rows: [{ perfil_acesso: 'DIRETORIA' }] }); // user check-in perfil
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] }); // checkin
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    const quorum = await service.gerarQuorum({ assembleia_id: assId, token: '111222', gerado_por_user_id: userId, tipo_chamada: 'PRIMEIRA' });
    expect(quorum.token).toBe('111222');

    // 4. Definir Mesa
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'EM_CREDENCIAMENTO' }] }); // ass FOR UPDATE
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // mesaExistente check
    // mock for is_global check
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'global-q' }] });
    // mock for checkins
    mockClient.query.mockResolvedValueOnce({ rows: [{ user_id: pUserId }, { user_id: vpUserId }, { user_id: sUserId }, { user_id: s2UserId }] });

    mockClient.query.mockResolvedValueOnce({ rows: [{ assembleia_id: assId, presidente_user_id: pUserId, secretario_user_id: sUserId }] }); // INSERT mesa
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // Audit mesa
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE state
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // Audit state
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    await service.definirMesa({
        assembleia_id: assId,
        presidente_user_id: pUserId,
        vice_presidente_user_id: vpUserId,
        secretario_user_id: sUserId,
        secretario_2_user_id: s2UserId,
        definida_por_user_id: userId
    });

    // 5. Iniciar Execução (Now handled by definirMesa but let's test explicit if needed)
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'INICIADO' }] }); // buscarPorId
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'INICIADO' }] }); // already INICIADO returns
    await service.iniciarExecucao(assId, userId);

    // 6. Criar Votação
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'INICIADO' }] }); // ass FOR UPDATE
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // no active votations
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: votId, status: 'ATIVA' }] }); // insert vot
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // audit
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    await service.criarVotacao({ assembleia_id: assId, quorum_snapshot_id: quorumId, titulo: 'Item 1', iniciada_por_user_id: pUserId });

    // 7. Votar
    pool.query.mockResolvedValueOnce({ rows: [{ perfil_acesso: 'CONSELHEIRO' }] }); // perfil check
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'vote-1', voto: 'SIM' }] }); // insert vote
    pool.query.mockResolvedValueOnce({ rows: [] }); // Audit
    await service.registrarVoto(votId, sUserId, 'SIM', assId);

    // 8. Finalizar Votação
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ status: 'ATIVA', assembleia_id: assId }] }); // lock vot
    mockClient.query.mockResolvedValueOnce({ rowCount: 5 }); // abstenções snapshot
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: votId, status: 'ENCERRADA' }] }); // UPDATE vot
    mockClient.query.mockResolvedValue({ rows: [] }); // audits
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    await service.finalizarVotacao(votId, pUserId);

    // 9. Encerrar Assembleia
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'INICIADO' }] }); // lock ass
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // active items (none)
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'ENCERRADO' }] }); // UPDATE ass
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // close quorum
    mockClient.query.mockResolvedValue({ rows: [] }); // audits
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    const final = await service.encerrar(assId, userId);

    expect(final.estado).toBe('ENCERRADO');
  });
});
