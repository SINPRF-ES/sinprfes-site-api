const repasseService = require('../services/repasse.service');
const pool = require('../config/db');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

describe('Repasse reform v2', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calcula resumo com apoio por lotação e recurso não alocado', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ ano_ref: 2026, per_capita_global_anual: 300, per_capita_apoio_operacional_anual: 100 }] })
      .mockResolvedValueOnce({
        rows: [
          { id: 1, nome: 'Ativo Viana', situacao: 'ATIVO', lotacao: 'DEL 01 - Viana' },
          { id: 2, nome: 'Ativo sem', situacao: 'ATIVO', lotacao: null },
          { id: 3, nome: 'Veterano', situacao: 'VETERANO', lotacao: 'DEL 04 - Linhares' }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ lotacao_id: 'DEL 01 - Viana', total: 30 }] })
      .mockResolvedValueOnce({ rows: [] });

    const resumo = await repasseService.getRepasseResumo(2026);
    expect(pool.query).toHaveBeenNthCalledWith(3, expect.stringContaining('AND deleted_at IS NULL'), [2026]);
    const viana = resumo.apoioPorLotacao.find((l) => l.lotacao === 'DEL 01 - Viana');
    const sem = resumo.apoioPorLotacao.find((l) => l.lotacao === 'SEM LOTAÇÃO');

    expect(viana.creditoApoioOperacional).toBe(100);
    expect(viana.debitosApoioOperacional).toBe(30);
    expect(viana.saldoApoioOperacional).toBe(70);
    expect(sem.qtdAtivos).toBe(1);

    // 1 veterano * 300 + 2 ativos * 200 - 0
    expect(resumo.recursoNaoAlocadoTotal).toBe(700);
  });

  it('valida update de configuração anual', async () => {
    await expect(repasseService.updateRepasseConfig(2026, 0, 10)).rejects.toThrow('maior que zero');
    await expect(repasseService.updateRepasseConfig(2026, 300, 400)).rejects.toThrow('inválido');
  });
});
