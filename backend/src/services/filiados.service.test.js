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

  describe('Parentesco OUTRO and Compaction', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('atualizarDadosProprios should persist parentesco_outro and compact', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1, nome: 'Filiado' }] });

      const dados = {
        dep3_nome: 'Dependente 3',
        dep3_parentesco: 'OUTRO',
        dep3_parentesco_outro: 'Sobrinho',
        dep5_nome: 'Dependente 5',
        dep5_parentesco: 'FILHO_ENTEADO'
      };

      await filiadosService.atualizarDadosProprios(1, dados);

      const queryCall = pool.query.mock.calls[0];
      const updateSql = queryCall[0];
      const updateValues = queryCall[1];

      expect(updateSql).toContain('dep1_nome = $');
      expect(updateSql).toContain('dep1_parentesco = $');
      expect(updateSql).toContain('dep1_parentesco_outro = $');
      expect(updateSql).toContain('dep2_nome = $');

      expect(updateValues).toContain('Dependente 3');
      expect(updateValues).toContain('OUTRO');
      expect(updateValues).toContain('Sobrinho');
      expect(updateValues).toContain('Dependente 5');
      expect(updateValues).toContain('FILHO_ENTEADO');
    });

    test('atualizarDadosProprios should clear parentesco_outro if parentesco is NOT OUTRO', async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1, nome: 'Filiado' }] });

      const dados = {
        dep1_nome: 'Dependente 1',
        dep1_parentesco: 'IRMAO',
        dep1_parentesco_outro: 'Custom Text'
      };

      await filiadosService.atualizarDadosProprios(1, dados);

      const queryCall = pool.query.mock.calls[0];
      const updateValues = queryCall[1];

      // IRMAO is not OUTRO, so parentesco_outro should be null.
      expect(updateValues).toContain(null);
    });
  });
});
