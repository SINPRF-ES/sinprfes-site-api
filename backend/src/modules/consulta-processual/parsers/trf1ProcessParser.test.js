const { parseBrazilDateToIso, parseTrf1Rows, extractCnj, isValidProcessNumber } = require('./trf1ProcessParser');

describe('trf1ProcessParser', () => {
  test('parseBrazilDateToIso converte data/hora BR em ISO', () => {
    const iso = parseBrazilDateToIso('Conclusos para decisão (10/09/2025 14:27:38)');
    expect(iso).toBe('2025-09-10T14:27:38.000Z');
  });

  test('extractCnj extrai CNJ válido de texto livre', () => {
    expect(extractCnj('Processo 0003990-96.2012.4.01.3400 - detalhe')).toBe('0003990-96.2012.4.01.3400');
  });

  test('isValidProcessNumber rejeita cabeçalhos/textos inválidos', () => {
    expect(isValidProcessNumber('resultados encontrados')).toBe(false);
    expect(isValidProcessNumber('Processo')).toBe(false);
    expect(isValidProcessNumber('0003990-96.2012.4.01.3400')).toBe(true);
  });

  test('parseTrf1Rows normaliza estrutura mínima e remove entradas inválidas', () => {
    const items = parseTrf1Rows([
      {
        processNumber: 'resultados encontrados',
        processClass: 'Linha inválida',
      },
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
