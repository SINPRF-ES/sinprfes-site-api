const reportsService = require('./reports.service');
const pool = require('../config/db');
const repasseService = require('./repasse.service');

jest.mock('../config/db');
jest.mock('./repasse.service');

describe('reports.service - situacao_sindical metrics', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calcula filiação local/total e não filiação em SITUACAO ATIVO', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: 10, masc: 8, fem: 2 }] })
      .mockResolvedValueOnce({ rows: [{ filiado_sinprf_es: 40, filiado_outro_sindicato: 10, nao_filiado: 5, desconhecido: 2 }] })
      .mockResolvedValueOnce({ rows: [{ efetivo_total: 100 }] });

    repasseService.getEfetivoManualLotacoes.mockResolvedValue({ totais: { 'SEDE': 100 } });
    repasseService.getUltimosDadosParaRelatorioComOverride.mockResolvedValue({ prfTotal: 100, filiadosAtivos: 10, percentual: 10 });

    const data = await reportsService.buscarDadosAgregados('SITUACAO', 'ATIVO');

    expect(data.situacaoSindical.efetivo_total_informado).toBe(100);
    expect(data.situacaoSindical.filiados_totais).toBe(50);
    expect(data.situacaoSindical.nao_filiados_estimados_no_efetivo).toBe(50);
    expect(data.situacaoSindical.percentual_filiacao_local).toBe(40);
    expect(data.situacaoSindical.percentual_filiacao_total).toBe(50);
    expect(data.situacaoSindical.percentual_nao_filiacao).toBe(50);
    expect(data.situacaoSindical.base_local_ajustada).toBe(90);
    expect(data.situacaoSindical.percentual_total).toBe(40);
    expect(data.situacaoSindical.percentual_base_ajustada).toBeCloseTo(44.4, 1);
  });

  test('em LOTACAO separa filiação local x outros sindicatos', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: 38, masc: 30, fem: 8 }] })
      .mockResolvedValueOnce({ rows: [{ filiado_sinprf_es: 38, filiado_outro_sindicato: 2, nao_filiado: 0, desconhecido: 0 }] });

    repasseService.getEfetivoManualLotacoes.mockResolvedValue({ totais: { 'SEDE': 40 } });
    repasseService.getUltimosDadosParaRelatorioComOverride.mockResolvedValue({ prfTotal: 40, filiadosAtivos: 38, percentual: 95 });

    const data = await reportsService.buscarDadosAgregados('LOTACAO', 'SEDE');

    expect(data.situacaoSindicalLotacao.filiado_sinprf_es).toBe(38);
    expect(data.situacaoSindicalLotacao.filiado_outro_sindicato).toBe(2);
    expect(data.situacaoSindicalLotacao.percentual_filiacao_local).toBe(95);
    expect(data.situacaoSindicalLotacao.percentual_filiacao_total).toBe(100);
    expect(data.situacaoSindicalLotacao.percentual_nao_filiacao).toBe(0);
  });
});
