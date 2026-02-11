// src/tests/governance.integration.test.js
const service = require('../services/assembleias.service');
const pool = require('../config/db');
const Textos = require('../utils/textos');

jest.mock('../config/db', () => {
  const mClient = {
    query: jest.fn(),
    release: jest.fn()
  };
  return {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mClient),
    on: jest.fn()
  };
});

describe('Governance and Proposals Integration', () => {
  let mockClient;

  beforeAll(async () => {
    mockClient = await pool.connect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Proposals Governance', () => {
    test('criarProposta should fail if titulo is too short', async () => {
      await expect(service.criarProposta({ titulo: 'abc', pauta: 'Valid description with enough length' }))
        .rejects.toThrow("O título da proposta deve ter pelo menos 5 caracteres.");
    });

    test('criarProposta should fail if pauta is too short', async () => {
      await expect(service.criarProposta({ titulo: 'Valid Title', pauta: 'short' }))
        .rejects.toThrow("A descrição (pauta) da proposta deve ter pelo menos 10 caracteres.");
    });

    test('criarProposta should succeed in INICIADO state', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ass-1', estado: 'INICIADO' }] }) // FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 'prop-1', titulo: 'Nova Proposta' }] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }) // Audit
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await service.criarProposta({
        assembleia_id: 'ass-1',
        autor_id: 'u1',
        titulo: 'Título Válido',
        pauta: 'Descrição longa o suficiente'
      });

      expect(res.id).toBe('prop-1');
    });

    test('criarProposta should fail in ENCERRADO state', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ass-1', estado: 'ENCERRADO' }] }) // FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(service.criarProposta({
        assembleia_id: 'ass-1',
        autor_id: 'u1',
        titulo: 'Título Válido',
        pauta: 'Descrição longa o suficiente'
      })).rejects.toThrow(/Assembleia encerrada/);
    });
  });

  describe('Board (Mesa) Governance', () => {
    test('definirMesa should block if already established', async () => {
        const u1 = '00000000-0000-4000-a000-000000000001';
        const u2 = '00000000-0000-4000-a000-000000000002';
        const u3 = '00000000-0000-4000-a000-000000000003';
        const u4 = '00000000-0000-4000-a000-000000000004';

        // Mock verificarRejeicaoMesa (4 times)
        pool.query.mockResolvedValue({ rows: [] });

        mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 'ass-1', estado: 'EM_CREDENCIAMENTO' }] }) // FOR UPDATE
            .mockResolvedValueOnce({ rows: [{ estabelecida_em: new Date() }] }) // Already established check
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        await expect(service.definirMesa({
            assembleia_id: 'ass-1',
            presidente_user_id: u1,
            vice_presidente_user_id: u2,
            secretario_user_id: u3,
            secretario_2_user_id: u4,
            definida_por_user_id: 'u-boss'
        })).rejects.toThrow(/Mesa já estabelecida/);
    });

    test('substituirMesa should succeed with justification', async () => {
        const u1 = '00000000-0000-4000-a000-000000000001';
        const u2 = '00000000-0000-4000-a000-000000000002';
        const u3 = '00000000-0000-4000-a000-000000000003';
        const u4 = '00000000-0000-4000-a000-000000000004';
        const u5 = '00000000-0000-4000-a000-000000000005';

        // mock for buscarMesa (uses pool.query)
        pool.query.mockResolvedValue({ rows: [{ id: 'old-mesa' }] });

        mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // 1. BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 'ass-1', estado: 'INICIADO' }] }) // 2. SELECT estado
            .mockResolvedValueOnce({ rows: [{ id: 'global-q' }] }) // 3. is_global check
            .mockResolvedValueOnce({ rows: [{ user_id: u2 }, { user_id: u3 }, { user_id: u4 }, { user_id: u5 }] }) // 4. checkins check
            .mockResolvedValueOnce({ rows: [{ id: 'mesa-1' }] }) // 5. UPDATE mesa
            .mockResolvedValueOnce({ rows: [] }) // 6. audit
            .mockResolvedValueOnce({ rows: [] }); // 7. COMMIT

        const res = await service.substituirMesa({
            assembleia_id: 'ass-1',
            presidente_user_id: u2,
            vice_presidente_user_id: u3,
            secretario_user_id: u4,
            secretario_2_user_id: u5,
            substituida_por_user_id: u1,
            justificativa: 'O presidente anterior perdeu a conexão e não retornou mais para a sala.'
        });

        expect(res.id).toBe('mesa-1');
    });

    test('substituirMesa should fail if justification is too short', async () => {
        const u2 = '00000000-0000-4000-a000-000000000002';
        const u3 = '00000000-0000-4000-a000-000000000003';
        const u4 = '00000000-0000-4000-a000-000000000004';
        const u5 = '00000000-0000-4000-a000-000000000005';

        await expect(service.substituirMesa({
            presidente_user_id: u2,
            vice_presidente_user_id: u3,
            secretario_user_id: u4,
            secretario_2_user_id: u5,
            justificativa: 'curta'
        })).rejects.toThrow(/Justificativa obrigatória/);
    });
  });
});
