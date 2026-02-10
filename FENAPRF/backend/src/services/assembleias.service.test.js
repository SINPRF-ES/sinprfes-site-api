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
    test('abrir should transition from CRIADO to EM_CREDENCIAMENTO', async () => {
      // Mock buscarPorId (uses pool.query)
      pool.query.mockResolvedValueOnce({
        rows: [{ id: '1', estado: 'CRIADO' }]
      });
      // Mock UPDATE (uses pool.query)
      pool.query.mockResolvedValueOnce({
        rows: [{ id: '1', estado: 'EM_CREDENCIAMENTO' }]
      });
      // Mock Audits
      pool.query.mockResolvedValue({ rows: [] });

      const result = await service.abrir('1', 1);
      expect(result.estado).toBe('EM_CREDENCIAMENTO');
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/UPDATE assembleias SET estado = 'EM_CREDENCIAMENTO'/), ['1']);
    });

    test('abrir should throw error if not in CRIADO state', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: '1', estado: 'EM_CREDENCIAMENTO' }]
      });

      await expect(service.abrir('1', 1)).rejects.toThrow(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    });

    test('iniciarExecucao should transition from EM_CREDENCIAMENTO to INICIADO if mesa is defined', async () => {
      // 1. buscarPorId
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'EM_CREDENCIAMENTO' }] });
      // 2. buscarMesa
      pool.query.mockResolvedValueOnce({ rows: [{ assembleia_id: '1', presidente_user_id: 10, secretario_user_id: 20 }] });
      // 3. UPDATE
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'INICIADO' }] });
      // 4. Audit
      pool.query.mockResolvedValue({ rows: [] });

      const result = await service.iniciarExecucao('1', 1);
      expect(result.estado).toBe('INICIADO');
    });

    test('iniciarExecucao should fail if mesa is not defined', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'EM_CREDENCIAMENTO' }] });
      pool.query.mockResolvedValueOnce({ rows: [] }); // No mesa

      await expect(service.iniciarExecucao('1', 1)).rejects.toThrow(Textos.ASSEMBLEIA.MESA_NAO_DEFINIDA);
    });

    test('encerrar should transition to ENCERRADO and auto-close active votations', async () => {
      // client.query calls
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: '1', estado: 'INICIADO' }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 'v1' }] }) // active votations
        .mockResolvedValueOnce({ rowCount: 1 }) // abstenções
        .mockResolvedValueOnce({ rows: [] }) // UPDATE status item
        .mockResolvedValueOnce({ rows: [] }) // audit item (1st call in finalize)
        .mockResolvedValueOnce({ rows: [] }) // audit item (2nd call in finalize)
        .mockResolvedValueOnce({ rows: [{ id: '1', estado: 'ENCERRADO' }] }) // UPDATE assembleia
        .mockResolvedValueOnce({ rows: [] }) // UPDATE quorum
        .mockResolvedValueOnce({ rows: [] }) // audit ass 1
        .mockResolvedValueOnce({ rows: [] }) // audit ass 2
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock for registrarAuditoria mesa checks (called within service)
      pool.query.mockResolvedValue({ rows: [] });

      const result = await service.encerrar('1', 1);
      expect(result.estado).toBe('ENCERRADO');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/BEGIN/));
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringMatching(/COMMIT/));
    });

  });

  describe('Quorum and Check-in', () => {
    test('gerarQuorum should calculate correct quorum for PRIMEIRA chamada', async () => {
       mockClient.query
         .mockResolvedValueOnce({ rows: [] }) // BEGIN
         .mockResolvedValueOnce({ rows: [{ id: '1', estado: 'EM_CREDENCIAMENTO' }] }) // SELECT FOR UPDATE
         .mockResolvedValueOnce({ rows: [] }) // Idempotency check
         .mockResolvedValueOnce({ rows: [{ total: '100' }] }) // actives count
         .mockResolvedValueOnce({ rows: [] }) // collision check
         .mockResolvedValueOnce({ rows: [] }) // UPDATE quorum anterior
         .mockResolvedValueOnce({ rows: [{ id: 'q1', token: '123456' }] }) // INSERT quorum
         .mockResolvedValueOnce({ rows: [] }) // Audit
         .mockResolvedValueOnce({ rows: [{ perfil_acesso: 'DIRETORIA' }] }) // SELECT user perfil
         .mockResolvedValueOnce({ rows: [{ id: 'c1' }] }) // INSERT checkin
         .mockResolvedValueOnce({ rows: [] }); // COMMIT

       // Mock for registrarAuditoria mesa checks
       pool.query.mockResolvedValue({ rows: [] });

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
         .mockResolvedValueOnce({ rows: [{ id: '1', estado: 'EM_CREDENCIAMENTO' }] }) // SELECT FOR UPDATE
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

       // Mock for registrarAuditoria mesa checks
       pool.query.mockResolvedValue({ rows: [] });

       const result = await service.gerarQuorum({
         assembleia_id: '1',
         token: '999999',
         gerado_por_user_id: 1,
         tipo_chamada: 'RECONTAGEM'
       });

       expect(result.id).toBe('q_rec');
    });
  });

  describe('Blindage and Invariants', () => {
    test('realizarCheckin should block ADMIN or COMUNICADOR', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ perfil_acesso: 'ADMIN' }] });

      await expect(service.realizarCheckin({ user_id: 999 })).rejects.toThrow(Textos.AUTH.PERMISSAO_INSUFICIENTE);
    });

    test('criarVotacao should transition if authority is valid', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: '1', estado: 'INICIADO' }] }) // FOR UPDATE ass
        .mockResolvedValueOnce({ rows: [] }) // No active votations
        .mockResolvedValueOnce({ rows: [{ id: 'v1', titulo: 'Test' }] }) // INSERT votacao
        .mockResolvedValueOnce({ rows: [] }) // Audit
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock for registrarAuditoria mesa checks
      pool.query.mockResolvedValue({ rows: [] });

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
      // 2e. presentesGlobal
      pool.query.mockResolvedValueOnce({ rows: [{ total: 3 }] });
      // 2f. auditoria
      pool.query.mockResolvedValueOnce({ rows: [] });
      // 2g. pedidosPalavra
      pool.query.mockResolvedValueOnce({ rows: [] });

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
      // Total calls expected: 1 (buscarPorId) + 7 (mesa, quoruns, votacoes, propostas, presentesGlobal, auditoria, pedidosPalavra) + 1 (allCheckins) + 1 (allVotos) = 10
      expect(pool.query).toHaveBeenCalledTimes(10);

      // Verify batch queries use ANY
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/assembleia_quorum_id = ANY/), expect.anything());
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/votacao_id = ANY/), expect.anything());
    });
  });

  describe('Lightweight State Tracking', () => {
    test('buscarEstadoResumido should return essentials only', async () => {
      // 1. pool.query for assembleia state
      pool.query.mockResolvedValueOnce({ rows: [{ estado: 'INICIADO' }] });
      // 2. buscarUltimoQuorum
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'q1', token: '123456', gerado_por_user_id: 'u1' }] });
      // 3. buscarVotacaoAtiva
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'v1', titulo: 'V1', encerra_em: new Date(Date.now() + 60000) }] });
      // 4. contarPresentesNoQuorum
      pool.query.mockResolvedValueOnce({ rows: [{ total: 5 }] });
      // 5. contarVotos
      pool.query.mockResolvedValueOnce({ rows: [{ SIM: 2, NAO: 1, ABSTENCAO: 0 }] });

      const res = await service.buscarEstadoResumido('1');
      expect(res.assembleia.estado).toBe('INICIADO');
      expect(res.quorumVigente.token).toBe('123456');
      expect(res.quorumVigente.total).toBe(5);
      expect(res.votacaoAtiva.tempoRestanteSegundos).toBeGreaterThan(0);
      expect(res.votacaoAtiva.contagem.SIM).toBe(2);
    });
  });
});
