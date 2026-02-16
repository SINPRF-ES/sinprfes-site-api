const authService = require('../services/auth.service');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

jest.mock('../config/db');
jest.mock('../utils/log');

describe('Auth Service - Refresh Tokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createRefreshToken should insert into DB and return formatted token', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'uuid-123' }] });

    const token = await authService.createRefreshToken(1, { deviceId: 'dev1' });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO auth_refresh_tokens'),
      expect.arrayContaining([1, expect.any(String), 'dev1'])
    );
    expect(token).toMatch(/^uuid-123\.[a-f0-9]+$/);
  });

  test('verifyRefreshToken should return record if valid', async () => {
    const rawToken = 'abc';
    const hash = await bcrypt.hash(rawToken, 10);
    const tokenId = '550e8400-e29b-41d4-a716-446655440000';

    pool.query.mockResolvedValue({
      rows: [{ id: tokenId, filiado_id: 1, token_hash: hash }]
    });

    const record = await authService.verifyRefreshToken(`${tokenId}.${rawToken}`);

    expect(record).toBeDefined();
    expect(record.filiado_id).toBe(1);
  });

  test('verifyRefreshToken should return null if hash does not match', async () => {
    const hash = await bcrypt.hash('different', 10);
    const tokenId = '550e8400-e29b-41d4-a716-446655440000';

    pool.query.mockResolvedValue({
      rows: [{ id: tokenId, filiado_id: 1, token_hash: hash }]
    });

    const record = await authService.verifyRefreshToken(`${tokenId}.abc`);

    expect(record).toBeNull();
  });
});
