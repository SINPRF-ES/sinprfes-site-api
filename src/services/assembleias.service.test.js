// src/services/assembleias.service.test.js
const pool = require('../config/db');
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

const service = require('./assembleias.service');

describe('Assembleias Service', () => {
  let mockClient;

  beforeAll(async () => {
    mockClient = await pool.connect();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockClient.query.mockReset();
  });

  describe('State Machine Transitions', () => {
    test('abrir should transition from CRIADA to ABERTA', async () => {
      // Mock buscarPorId (uses pool.query)
      pool.query.mockResolvedValueOnce({
        rows: [{ id: '1', estado: 'CRIADA' }]
      });
      // Mock UPDATE (uses pool.query)
      pool.query.mockResolvedValueOnce({
        rows: [{ id: '1', estado: 'ABERTA' }]
      });
      // Mock Audits (2 calls)
      pool.query.mockResolvedValue({ rows: [] });

      const result = await service.abrir('1', 1);
      expect(result.estado).toBe('ABERTA');
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/UPDATE assembleias SET estado = 'ABERTA'/), ['1']);
    });

    test('abrir should throw error if not in CRIADA state', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: '1', estado: 'ABERTA' }]
      });

      await expect(service.abrir('1', 1)).rejects.toThrow(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    });

    test('iniciarExecucao should transition from ABERTA to EM_CURSO if mesa is defined and present', async () => {
      // 1. buscarPorId
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'ABERTA' }] });
      // 2. buscarMesa
      pool.query.mockResolvedValueOnce({ rows: [{ assembleia_id: '1', presidente_user_id: 10, secretario_user_id: 20 }] });
      // 3. buscarUltimoQuorum
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'q1' }] });
      // 4. verificarElegibilidadePorQuorum (Presidente)
      pool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      // 5. verificarElegibilidadePorQuorum (Secretário)
      pool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      // 6. UPDATE
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'EM_CURSO' }] });
      // 7. Audit
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.iniciarExecucao('1', 1);
      expect(result.estado).toBe('EM_CURSO');
    });

    test('iniciarExecucao should fail if mesa is not defined', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'ABERTA' }] });
      pool.query.mockResolvedValueOnce({ rows: [] }); // No mesa

      await expect(service.iniciarExecucao('1', 1)).rejects.toThrow(Textos.ASSEMBLEIA.MESA_NAO_DEFINIDA);
    });

    test('encerrar should transition to ENCERRADA and auto-close active votations', async () => {
      // client.query calls
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: '1', estado: 'EM_CURSO' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 'v1' }] }) // active votations
        .mockResolvedValueOnce({ rowCount: 1 }) // abstenções
        .mockResolvedValueOnce({ rows: [] }) // UPDATE status item
        .mockResolvedValueOnce({ rows: [] }) // audit item
        .mockResolvedValueOnce({ rows: [{ id: '1', estado: 'ENCERRADA' }] }) // UPDATE assembleia
        .mockResolvedValueOnce({ rows: [] }) // UPDATE quorum
        .mockResolvedValueOnce({ rows: [] }) // audit ass 1
        .mockResolvedValueOnce({ rows: [] }) // audit ass 2
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.encerrar('1', 1);
      expect(result.estado).toBe('ENCERRADA');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/BEGIN/));
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/COMMIT/));
    });

  });

  describe('Quorum and Check-in', () => {
    test('gerarQuorum should calculate correct quorum for PRIMEIRA chamada', async () => {
       mockClient.query
         .mockResolvedValueOnce({ rows: [] }) // BEGIN
         .mockResolvedValueOnce({ rows: [{ id: '1', estado: 'ABERTA' }] }) // SELECT FOR UPDATE
         .mockResolvedValueOnce({ rows: [] }) // Idempotency check
         .mockResolvedValueOnce({ rows: [{ total: '100' }] }) // actives count
         .mockResolvedValueOnce({ rows: [] }) // collision check
         .mockResolvedValueOnce({ rows: [] }) // UPDATE quorum anterior
         .mockResolvedValueOnce({ rows: [{ id: 'q1', token: '123456' }] }) // INSERT quorum
         .mockResolvedValueOnce({ rows: [] }) // Audit
         .mockResolvedValueOnce({ rows: [{ perfil_acesso: 'DIRETORIA' }] }) // SELECT user perfil
         .mockResolvedValueOnce({ rows: [{ id: 'c1' }] }) // INSERT checkin
         .mockResolvedValueOnce({ rows: [] }); // COMMIT

       const result = await service.gerarQuorum({
         assembleia_id: '1',
         token: '123456',
         gerado_por_user_id: 1,
         tipo_chamada: 'PRIMEIRA'
       });

       expect(mockClient.query).toHaveBeenCalledWith(
         expect.stringMatching(/INSERT INTO assembleia_quoruns/),
         expect.arrayContaining(['PRIMEIRA', 100, 51])
       );
    });
  });

  describe('Blindage and Invariants', () => {
    test('realizarCheckin should block ADMIN or COMUNICADOR', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ perfil_acesso: 'ADMIN' }] });

      await expect(service.realizarCheckin({ filiado_id: 999 })).rejects.toThrow(Textos.AUTH.PERMISSAO_INSUFICIENTE);
    });

    test('criarVotacao should transition if authority is valid', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: '1', estado: 'EM_CURSO' }] }) // FOR UPDATE ass
        .mockResolvedValueOnce({ rows: [] }) // No active votations
        .mockResolvedValueOnce({ rows: [{ id: 'v1', titulo: 'Test' }] }) // INSERT votacao
        .mockResolvedValueOnce({ rows: [] }) // Audit
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.criarVotacao({
        assembleia_id: '1',
        iniciada_por_user_id: 10
      });
      expect(result.id).toBe('v1');
    });
  });
});
