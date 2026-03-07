const Trf1PublicaProvider = require('./trf1PublicaProvider');

describe('Trf1PublicaProvider', () => {
  it('retorna skipped quando playwright não está instalado', async () => {
    process.env.CONSULTA_PROCESSUAL_TRF1_ENABLED = 'true';

    const provider = new Trf1PublicaProvider();
    const result = await provider.consultarPorCpf({
      cpf: '12345678901',
      cpfMasked: '***6789**',
      requestId: 'req-1',
      userId: 1,
    });

    expect(result.status).toBe('skipped');
    expect(result.source).toBe('trf1');
    expect(result.items).toEqual([]);
  });
});
