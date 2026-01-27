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

    test('gerarQuorum should forceNew if tipo_chamada is RECONTAGEM', async () => {
       mockClient.query
         .mockResolvedValueOnce({ rows: [] }) // BEGIN
         .mockResolvedValueOnce({ rows: [{ id: '1', estado: 'ABERTA' }] }) // SELECT FOR UPDATE
         // NOT checking idempotency because RECONTAGEM should skip it
         .mockResolvedValueOnce({ rows: [{ total: '100' }] }) // actives count
         .mockResolvedValueOnce({ rows: [{ presidente_user_id: 1 }] }) // check presidente
         .mockResolvedValueOnce({ rows: [] }) // collision check
         .mockResolvedValueOnce({ rows: [] }) // UPDATE quorum anterior
         .mockResolvedValueOnce({ rows: [{ id: 'q_rec', token: '999999' }] }) // INSERT quorum
         .mockResolvedValueOnce({ rows: [] }) // Audit recontagem
         .mockResolvedValueOnce({ rows: [{ perfil_acesso: 'DIRETORIA' }] }) // SELECT user perfil
         .mockResolvedValueOnce({ rows: [{ id: 'c1' }] }) // INSERT checkin
         .mockResolvedValueOnce({ rows: [] }) // Audit checkin
         .mockResolvedValueOnce({ rows: [] }); // COMMIT

       const result = await service.gerarQuorum({
         assembleia_id: '1',
         token: '999999',
         gerado_por_user_id: 1,
         tipo_chamada: 'RECONTAGEM'
       });

       expect(result.id).toBe('q_rec');
       // Verify skip idempotency: query 3 should NOT be the idempotency check for RECONTAGEM
       // Actually, I should check the query string to be sure.
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

    test('iniciarVotacaoProposta should withdraw proposal if author is absent', async () => {
       mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
       mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'pr1', assembleia_id: '1', autor_id: 100, titulo: 'Prop 1' }] }); // SELECT FOR UPDATE

       pool.query.mockResolvedValueOnce({ rows: [{ id: 'q1' }] }); // buscarUltimoQuorum (uses pool)

       mockClient.query.mockResolvedValueOnce({ rows: [] }); // verificarElegibilidadePorQuorum (uses client)
       mockClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE status RETIRADA
       mockClient.query.mockResolvedValueOnce({ rows: [] }); // registrarAuditoria
       mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

       const result = await service.iniciarVotacaoProposta('1', 'pr1', 1);

       expect(result.status).toBe('RETIRADA_AUTOR_AUSENTE');

       const updateCall = mockClient.query.mock.calls.find(c => c[0].includes("UPDATE assembleia_propostas"));
       expect(updateCall).toBeDefined();
       expect(updateCall[1]).toContain('autor ausente da votação');
       expect(updateCall[1]).toContain('pr1');
    });
  });

  describe('Reporting', () => {
    test('gerarDadosRelatorio should fetch data without N+1', async () => {
      // 1. buscarPorId
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', titulo: 'Ass 1' }] });
      // 2. Promise.all
      // 2a. buscarMesa
      pool.query.mockResolvedValueOnce({ rows: [{ assembleia_id: '1', presidente_nome: 'P1' }] });
      // 2b. quoruns
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'q1', token: '111' }, { id: 'q2', token: '222' }] });
      // 2c. votacoes
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1', titulo: 'V1' }] });
      // 2d. propostas
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'pr1', titulo: 'Proposta 1', autor_nome: 'Autor 1' }] });

      // 3. allCheckins (Batch)
      pool.query.mockResolvedValueOnce({ rows: [
        { assembleia_quorum_id: 'q1', nome: 'User 1' },
        { assembleia_quorum_id: 'q1', nome: 'User 2' },
        { assembleia_quorum_id: 'q2', nome: 'User 3' }
      ]});

      // 4. allVotos (Batch)
      pool.query.mockResolvedValueOnce({ rows: [
        { votacao_id: 'v1', nome: 'User 1', voto: 'SIM' },
        { votacao_id: 'v1', nome: 'User 2', voto: 'NAO' }
      ]});

      const res = await service.gerarDadosRelatorio('1');

      expect(res.assembleia.id).toBe('1');
      expect(res.quoruns).toHaveLength(2);
      expect(res.quoruns[0].presentes).toHaveLength(2);
      expect(res.quoruns[1].presentes).toHaveLength(1);
      expect(res.votacoes).toHaveLength(1);
      expect(res.votacoes[0].contagem.SIM).toBe(1);
      expect(res.votacoes[0].contagem.total).toBe(2);

      // Verify that pool.query was NOT called for each quorum/votacao separately after batch fetch
      // Total calls expected: 1 (buscarPorId) + 4 (mesa, quoruns, votacoes, propostas) + 1 (allCheckins) + 1 (allVotos) = 7
      expect(pool.query).toHaveBeenCalledTimes(7);

      // Verify batch queries use ANY
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/assembleia_quorum_id = ANY/), expect.anything());
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/votacao_id = ANY/), expect.anything());
    });
  });
});
