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
    const assId = 'ass-123';
    const userId = 1; // Gestor
    const quorumId = 'q-456';
    const votId = 'v-789';

    // 1. Criar
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'CRIADA' }] }); // INSERT ass
    pool.query.mockResolvedValueOnce({ rows: [] }); // Audit
    const nova = await service.criar({ tipo: 'AGO', titulo: 'Ass Geral', criado_por: userId });
    expect(nova.estado).toBe('CRIADA');

    // 2. Abrir
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'CRIADA' }] }); // buscarPorId
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'ABERTA' }] }); // UPDATE
    pool.query.mockResolvedValue({ rows: [] }); // Audits
    await service.abrir(assId, userId);

    // 3. Gerar Quorum (PRIMEIRA)
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'ABERTA' }] }); // ass FOR UPDATE
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
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'ABERTA' }] }); // buscarPorId
    pool.query.mockResolvedValueOnce({ rows: [{ id: quorumId }] }); // buscarUltimoQuorum
    pool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // presence P
    pool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // presence S
    pool.query.mockResolvedValueOnce({ rows: [{ assembleia_id: assId, presidente_user_id: 10, secretario_user_id: 20 }] }); // INSERT mesa
    pool.query.mockResolvedValueOnce({ rows: [] }); // Audit
    await service.definirMesa({ assembleia_id: assId, presidente_user_id: 10, secretario_user_id: 20, definida_por_user_id: userId });

    // 5. Iniciar Execução
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'ABERTA' }] }); // buscarPorId
    pool.query.mockResolvedValueOnce({ rows: [{ presidente_user_id: 10, secretario_user_id: 20 }] }); // buscarMesa
    pool.query.mockResolvedValueOnce({ rows: [{ id: quorumId }] }); // buscarUltimoQuorum
    pool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // presence P
    pool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // presence S
    pool.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'EM_CURSO' }] }); // UPDATE ass
    pool.query.mockResolvedValueOnce({ rows: [] }); // Audit
    await service.iniciarExecucao(assId, userId);

    // 6. Criar Votação
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'EM_CURSO' }] }); // ass FOR UPDATE
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // no active votations
    mockClient.query.mockResolvedValueOnce({ rows: [{ presidente_user_id: 10 }] }); // mesa check
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: votId, status: 'ATIVA' }] }); // insert vot
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // audit
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    await service.criarVotacao({ assembleia_id: assId, quorum_snapshot_id: quorumId, titulo: 'Item 1', iniciada_por_user_id: 10 });

    // 7. Votar
    pool.query.mockResolvedValueOnce({ rows: [{ perfil_acesso: 'FILIADO' }] }); // perfil check
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'vote-1', voto: 'SIM' }] }); // insert vote
    pool.query.mockResolvedValueOnce({ rows: [] }); // Audit
    await service.registrarVoto(votId, 30, 'SIM', assId);

    // 8. Finalizar Votação
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ status: 'ATIVA', assembleia_id: assId }] }); // lock vot
    mockClient.query.mockResolvedValueOnce({ rowCount: 5 }); // abstenções snapshot
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: votId, status: 'ENCERRADA' }] }); // UPDATE vot
    mockClient.query.mockResolvedValue({ rows: [] }); // audits
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    await service.finalizarVotacao(votId, 10);

    // 9. Encerrar Assembleia
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'EM_CURSO' }] }); // lock ass
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // active items (none)
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: assId, estado: 'ENCERRADA' }] }); // UPDATE ass
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // close quorum
    mockClient.query.mockResolvedValue({ rows: [] }); // audits
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    const final = await service.encerrar(assId, userId);

    expect(final.estado).toBe('ENCERRADA');
  });
});
