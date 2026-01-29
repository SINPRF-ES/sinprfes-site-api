// src/tests/security_xss.test.js
const service = require('../services/assembleias.service');
const pool = require('../config/db');

jest.mock('../config/db');
jest.mock('../utils/log');

describe('Security - XSS Sanitization', () => {
  test('criar and criarProposta should escape HTML', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'ass-1' }] });
    await service.criar({ tipo: 'AGE', titulo: '<script>', pauta: '<img>', criado_por: 1, edital_drive_file_id: 'drive-1' });
    const call = pool.query.mock.calls.find(c => c[0].includes('INSERT INTO assembleias'));
    expect(call[1][1]).toBe('&lt;script&gt;');
    expect(call[1][2]).toBe('&lt;img&gt;');

    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ estado: 'EM_CURSO' }] }) // SELECT
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] }), // INSERT
      release: jest.fn()
    };
    pool.connect.mockResolvedValue(mockClient);
    await service.criarProposta({ assembleia_id: 'a1', autor_id: 1, titulo: '<b>Title</b>', pauta: '<i>long enough pauta</i>' });
    const pCall = mockClient.query.mock.calls.find(c => c[0].includes('INSERT INTO assembleia_propostas'));
    expect(pCall[1][2]).toBe('&lt;b&gt;Title&lt;/b&gt;');
    expect(pCall[1][3]).toBe('&lt;i&gt;long enough pauta&lt;/i&gt;');
  });
});
