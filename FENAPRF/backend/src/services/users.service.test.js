// src/services/users.service.test.js
const usersService = require('./users.service');
const pool = require('../config/db');

jest.mock('../config/db');

describe('Users Service', () => {
  describe('listarParaPerfil', () => {
    test('should include avatar_url for USER profile', async () => {
      const mockRows = [
        { id: 1, nome: 'User 1', avatar_url: 'url', situacao: 'ATIVO' }
      ];
      pool.query.mockResolvedValue({ rows: mockRows });

      const result = await usersService.listarParaPerfil('USER');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('f.avatar_url'),
        expect.any(Array)
      );
      expect(result[0]).toHaveProperty('avatar_url', 'url');
    });

    test('should include all fields for ADMIN profile', async () => {
        const mockRows = [
          { id: 1, nome: 'User 1', cpf: '123' }
        ];
        pool.query.mockResolvedValue({ rows: mockRows });

        const result = await usersService.listarParaPerfil('ADMIN');

        expect(pool.query).toHaveBeenCalledWith(
          expect.stringContaining('f.cpf'),
          expect.any(Array)
        );
        expect(result[0]).toHaveProperty('cpf', '123');
      });
  });
});
