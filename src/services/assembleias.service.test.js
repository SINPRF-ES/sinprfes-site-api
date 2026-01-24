// src/services/assembleias.service.test.js
const service = require('./assembleias.service');
const pool = require('../config/db');
const Textos = require('../utils/textos');

jest.mock('../config/db', () => ({
  query: jest.fn()
}));

describe('Assembleias Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('State Machine Transitions', () => {
    test('abrir should transition from CRIADA to ABERTA', async () => {
      // Mock buscarPorId
      pool.query.mockResolvedValueOnce({
        rows: [{ id: '1', estado: 'CRIADA' }]
      });
      // Mock UPDATE
      pool.query.mockResolvedValueOnce({
        rows: [{ id: '1', estado: 'ABERTA' }]
      });

      const result = await service.abrir('1');
      expect(result.estado).toBe('ABERTA');
      expect(pool.query).toHaveBeenCalledWith(expect.stringMatching(/UPDATE assembleias SET estado = 'ABERTA'/), ['1']);
    });

    test('abrir should throw error if not in CRIADA state', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: '1', estado: 'ABERTA' }]
      });

      await expect(service.abrir('1')).rejects.toThrow(Textos.ASSEMBLEIA.TRANSICAO_INVALIDA);
    });

    test('iniciarExecucao should transition from ABERTA to EM_CURSO if mesa is defined and present', async () => {
      // 1. buscarPorId
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'ABERTA' }] });
      // 2. buscarMesa
      pool.query.mockResolvedValueOnce({ rows: [{ assembleia_id: '1', presidente_user_id: 10, secretario_user_id: 20 }] });
      // 3. buscarUltimoQuorum
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'q1' }] });
      // 4. verificarElegibilidadePorQuorum (Presidente)
      pool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      // 5. verificarElegibilidadePorQuorum (Secretário)
      pool.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
      // 6. UPDATE
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'EM_CURSO' }] });

      const result = await service.iniciarExecucao('1');
      expect(result.estado).toBe('EM_CURSO');
    });

    test('iniciarExecucao should fail if mesa is not defined', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'ABERTA' }] });
      pool.query.mockResolvedValueOnce({ rows: [] }); // No mesa

      await expect(service.iniciarExecucao('1')).rejects.toThrow(Textos.ASSEMBLEIA.MESA_NAO_DEFINIDA);
    });

    test('encerrar should transition to ENCERRADA', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'EM_CURSO' }] });
      // buscarVotacaoAtiva
      pool.query.mockResolvedValueOnce({ rows: [] }); // no active votation
      // UPDATE assembleias
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'ENCERRADA' }] });
      // UPDATE quoruns
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.encerrar('1');
      expect(result.estado).toBe('ENCERRADA');
    });

    test('encerrar should fail if there is an active votation', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'EM_CURSO' }] });
      // buscarVotacaoAtiva
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 'v1', status: 'ATIVA', aberta_em: new Date(), duracao_segundos: 600 }]
      });

      await expect(service.encerrar('1')).rejects.toThrow('Não é possível encerrar a assembleia com uma votação em curso');
    });
  });

  describe('Quorum and Check-in', () => {
    test('gerarQuorum should calculate correct quorum for PRIMEIRA chamada', async () => {
       pool.query.mockResolvedValueOnce({ rows: [{ id: '1', estado: 'ABERTA' }] }); // buscarPorId
       pool.query.mockResolvedValueOnce({ rows: [{ total: '100' }] }); // contarFiliadosAtivos
       pool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE quoruns anteriores
       pool.query.mockResolvedValueOnce({ rows: [{ id: 'q1', token: '123456' }] }); // INSERT quorum
       pool.query.mockResolvedValueOnce({ rows: [{ perfil_acesso: 'DIRETORIA' }] }); // SELECT perfil
       pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] }); // INSERT checkin

       const result = await service.gerarQuorum({
         assembleia_id: '1',
         token: '123456',
         gerado_por_user_id: 1,
         tipo_chamada: 'PRIMEIRA'
       });

       expect(pool.query).toHaveBeenCalledWith(
         expect.stringMatching(/INSERT INTO assembleia_quoruns/),
         expect.arrayContaining(['PRIMEIRA', 100, 51])
       );
    });
  });
});
