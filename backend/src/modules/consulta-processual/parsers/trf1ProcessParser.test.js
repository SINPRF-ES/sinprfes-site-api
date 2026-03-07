const { parseBrazilDateToIso, parseTrf1Rows } = require('./trf1ProcessParser');

describe('trf1ProcessParser', () => {
  test('parseBrazilDateToIso converte data/hora BR em ISO', () => {
    const iso = parseBrazilDateToIso('Conclusos para decisão (10/09/2025 14:27:38)');
    expect(iso).toBe('2025-09-10T14:27:38.000Z');
  });

  test('parseTrf1Rows normaliza estrutura mínima', () => {
    const items = parseTrf1Rows([
      {
        processNumber: '0003990-96.2012.4.01.3400',
        processClass: 'Cumprimento de Sentença',
        parties: 'AUTOR X RÉU',
        lastMovement: 'Conclusos para decisão',
        lastMovementText: 'Conclusos para decisão (10/09/2025 14:27:38)',
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source: 'trf1',
      sourceLabel: 'TRF1',
      processNumber: '0003990-96.2012.4.01.3400',
      processClass: 'Cumprimento de Sentença',
      parties: 'AUTOR X RÉU',
      lastMovement: 'Conclusos para decisão',
      rawLastMovementText: 'Conclusos para decisão (10/09/2025 14:27:38)',
      lastMovementAt: '2025-09-10T14:27:38.000Z',
    });
  });
});
