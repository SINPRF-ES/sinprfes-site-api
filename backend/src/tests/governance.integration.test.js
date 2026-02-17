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

    test('criarProposta should succeed in EM_CURSO state', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ass-1', estado: 'EM_CURSO' }] }) // FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 'prop-1', titulo: 'Nova Proposta' }] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }) // Audit
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await service.criarProposta({
        assembleia_id: 'ass-1',
        autor_id: 1,
        titulo: 'Título Válido',
        pauta: 'Descrição longa o suficiente'
      });

      expect(res.id).toBe('prop-1');
    });

    test('criarProposta should fail in ENCERRADA state', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ass-1', estado: 'ENCERRADA' }] }) // FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(service.criarProposta({
        assembleia_id: 'ass-1',
        autor_id: 1,
        titulo: 'Título Válido',
        pauta: 'Descrição longa o suficiente'
      })).rejects.toThrow(/Assembleia encerrada/);
    });
  });

  describe('Board (Mesa) Governance', () => {
    test('definirMesa should block if already established', async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 'ass-1', estado: 'ABERTA' }] }) // FOR UPDATE
            .mockResolvedValueOnce({ rows: [{ estabelecida_em: new Date() }] }) // Already established check
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

        await expect(service.definirMesa({
            assembleia_id: 'ass-1',
            presidente_user_id: 1,
            secretario_user_id: 2
        })).rejects.toThrow(/Mesa já estabelecida/);
    });

    test('substituirMesa should succeed with justification', async () => {
        // Pool queries (out of transaction currently in implementation)
        pool.query
            .mockResolvedValueOnce({ rows: [{ presidente_user_id: 10 }] }) // buscarMesa
            .mockResolvedValueOnce({ rows: [{ id: 'q1' }] }) // buscarUltimoQuorum
            .mockResolvedValueOnce({ rows: [{ 1: 1 }] }) // verificarElegibilidadePorQuorum P
            .mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // verificarElegibilidadePorQuorum S

        mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 'ass-1', estado: 'EM_CURSO' }] }) // FOR UPDATE
            .mockResolvedValueOnce({ rows: [{ id: 'mesa-1' }] }) // UPDATE mesa
            .mockResolvedValueOnce({ rows: [] }) // audit
            .mockResolvedValueOnce({ rows: [] }); // COMMIT

        const res = await service.substituirMesa({
            assembleia_id: 'ass-1',
            presidente_user_id: 2,
            secretario_user_id: 3,
            substituida_por_user_id: 1,
            justificativa: 'O presidente anterior perdeu a conexão e não retornou.'
        });

        expect(res.id).toBe('mesa-1');
    });

    test('substituirMesa should fail if justification is too short', async () => {
        await expect(service.substituirMesa({
            presidente_user_id: 2,
            secretario_user_id: 3,
            justificativa: 'curta'
        })).rejects.toThrow(/Justificativa obrigatória/);
    });
  });
});
