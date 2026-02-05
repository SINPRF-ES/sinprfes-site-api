// src/services/votacoes.service.test.js
const service = require('./votacoes.service');
const pool = require('../config/db');

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

describe('Votacoes Service', () => {
  let mockClient;

  beforeAll(async () => {
    mockClient = await pool.connect();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('criarVotacao should batch insert options', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'v-1', titulo: 'T', status: 'AGENDADA' }] }) // INSERT votacao
      .mockResolvedValueOnce({ rows: [{ id: 'o-1', texto: 'Op1', ordem: 1 }, { id: 'o-2', texto: 'Op2', ordem: 2 }] }) // INSERT options (batch)
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await service.criarVotacao({
      criadoPor: 1,
      titulo: 'Titulo',
      opcoes: [
        { texto: 'Op1', ordem: 1 },
        { texto: 'Op2', ordem: 2 }
      ]
    });

    expect(res.id).toBe('v-1');
    expect(res.opcoes).toHaveLength(2);
    expect(res.opcoes[0].texto).toBe('Op1');

    // Verify batch query
    const batchQueryCall = mockClient.query.mock.calls[2];
    expect(batchQueryCall[0]).toContain('INSERT INTO votacao_opcoes');
    expect(batchQueryCall[0]).toContain('VALUES ($1, $2, $3), ($1, $4, $5)');
    expect(batchQueryCall[1]).toEqual(['v-1', 'Op1', 1, 'Op2', 2]);
  });
});
