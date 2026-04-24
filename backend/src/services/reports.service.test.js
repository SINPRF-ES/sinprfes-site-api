const reportsService = require('./reports.service');
const pool = require('../config/db');
const repasseService = require('./repasse.service');

jest.mock('../config/db');
jest.mock('./repasse.service');

describe('reports.service - situacao_sindical metrics', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calcula percentual total e base ajustada em SITUACAO ATIVO', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: 10, masc: 8, fem: 2 }] })
      .mockResolvedValueOnce({ rows: [{ filiado_sinprf_es: 40, filiado_outro_sindicato: 10, nao_filiado: 5, desconhecido: 2 }] })
      .mockResolvedValueOnce({ rows: [{ efetivo_total: 100 }] });

    repasseService.getEfetivoManualLotacoes.mockResolvedValue({ totais: { 'SEDE': 100 } });
    repasseService.getUltimosDadosParaRelatorioComOverride.mockResolvedValue({ prfTotal: 100, filiadosAtivos: 10, percentual: 10 });

    const data = await reportsService.buscarDadosAgregados('SITUACAO', 'ATIVO');

    expect(data.situacaoSindical.efetivo_total_informado).toBe(100);
    expect(data.situacaoSindical.base_local_ajustada).toBe(90);
    expect(data.situacaoSindical.percentual_total).toBe(40);
    expect(data.situacaoSindical.percentual_base_ajustada).toBeCloseTo(44.4, 1);
  });
});
