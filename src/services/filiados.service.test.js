// src/services/filiados.service.test.js
const filiadosService = require('./filiados.service');
const pool = require('../config/db');

jest.mock('../config/db');

describe('Filiados Service', () => {
  describe('listarParaPerfil', () => {
    test('should include lotacao for FILIADO profile', async () => {
      const mockRows = [
        { id: 1, nome: 'Filiado 1', lotacao: 'SEDE', avatar_url: null, situacao: 'ATIVO' }
      ];
      pool.query.mockResolvedValue({ rows: mockRows });

      const result = await filiadosService.listarParaPerfil('FILIADO');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('f.lotacao'),
        expect.any(Array)
      );
      expect(result[0]).toHaveProperty('lotacao', 'SEDE');
    });

    test('should include all fields for ADMIN profile', async () => {
        const mockRows = [
          { id: 1, nome: 'Filiado 1', lotacao: 'SEDE', cpf: '123' }
        ];
        pool.query.mockResolvedValue({ rows: mockRows });

        const result = await filiadosService.listarParaPerfil('ADMIN');

        expect(pool.query).toHaveBeenCalledWith(
          expect.stringContaining('f.dep1_nome'),
          expect.any(Array)
        );
        expect(result[0]).toHaveProperty('lotacao', 'SEDE');
      });
  });
});
