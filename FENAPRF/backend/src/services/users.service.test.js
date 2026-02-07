// src/services/users.service.test.js
const usersService = require('./users.service');
const pool = require('../config/db');

jest.mock('../config/db');

describe('Users Service', () => {
  describe('listarParaPerfil', () => {
    test('should include lotacao for USER profile', async () => {
      const mockRows = [
        { id: 1, nome: 'User 1', lotacao: 'SEDE', avatar_url: null, situacao: 'ATIVO' }
      ];
      pool.query.mockResolvedValue({ rows: mockRows });

      const result = await usersService.listarParaPerfil('USER');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('f.lotacao'),
        expect.any(Array)
      );
      expect(result[0]).toHaveProperty('lotacao', 'SEDE');
    });

    test('should include all fields for ADMIN profile', async () => {
        const mockRows = [
          { id: 1, nome: 'User 1', lotacao: 'SEDE', cpf: '123' }
        ];
        pool.query.mockResolvedValue({ rows: mockRows });

        const result = await usersService.listarParaPerfil('ADMIN');

        expect(pool.query).toHaveBeenCalledWith(
          expect.stringContaining('f.cpf'),
          expect.any(Array)
        );
        expect(result[0]).toHaveProperty('lotacao', 'SEDE');
      });
  });
});
