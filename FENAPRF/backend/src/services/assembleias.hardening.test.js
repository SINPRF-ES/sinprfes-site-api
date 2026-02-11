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

describe('Assembleias Hardening and Concurrency', () => {
  let mockClient;

  beforeAll(async () => {
    mockClient = await pool.connect();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockClient.query.mockReset();
  });

  test('gerarQuorum should retry on token collision', async () => {
     mockClient.query
       .mockResolvedValueOnce({ rows: [] }) // BEGIN
       .mockResolvedValueOnce({ rows: [{ id: 'ass-1', estado: 'EM_CREDENCIAMENTO' }] }) // FOR UPDATE ass
       .mockResolvedValueOnce({ rows: [] }) // Idempotency check
       .mockResolvedValueOnce({ rows: [{ total: 10 }] }) // actives
       .mockResolvedValueOnce({ rows: [{ 1: 1 }] }) // COLLISION! (first check)
       .mockResolvedValueOnce({ rows: [] }) // NO COLLISION (second check)
       .mockResolvedValueOnce({ rows: [] }) // Close previous
       .mockResolvedValueOnce({ rows: [{ id: 'q1' }] }) // Insert
       .mockResolvedValueOnce({ rows: [] }) // Audit
       .mockResolvedValueOnce({ rows: [{ perfil_acesso: 'DIRETORIA' }] }) // user checkin profile
       .mockResolvedValueOnce({ rows: [{ id: 'c1' }] }) // checkin
       .mockResolvedValueOnce({ rows: [] }); // COMMIT

     await service.gerarQuorum({ assembleia_id: 'ass-1', token: '111111', gerado_por_user_id: 'u1' });

     // Should have checked for collision twice
     const collisionChecks = mockClient.query.mock.calls.filter(c => c[0].includes('SELECT 1 FROM assembleia_quoruns'));
     expect(collisionChecks.length).toBe(2);
  });

  test('criarVotacao should block if another is active', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ass-1', estado: 'INICIADO' }] }) // FOR UPDATE ass
        .mockResolvedValueOnce({ rows: [{ id: 'v-active' }] }); // ANOTHER ACTIVE!

      await expect(service.criarVotacao({ assembleia_id: 'ass-1' }))
        .rejects.toThrow("Já existe uma votação ativa");
  });

  test('finalizarVotacao should be idempotent', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: 'ENCERRADA' }] }); // ALREADY CLOSED

      // Need to mock buscarVotacaoPorId which is called at the end
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1', status: 'ENCERRADA' }] });

      const result = await service.finalizarVotacao('v1', 'u1');
      expect(result.status).toBe('ENCERRADA');
      // Should NOT have tried to insert abstentions
      const inserts = mockClient.query.mock.calls.filter(c => c[0].includes('INSERT INTO assembleia_votos'));
      expect(inserts.length).toBe(0);
  });
});
