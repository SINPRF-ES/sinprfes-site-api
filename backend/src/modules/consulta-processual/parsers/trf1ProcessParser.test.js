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

  test('parseTrf1Rows normaliza estrutura e usa última movimentação do detalhe', () => {
    const items = parseTrf1Rows([
      {
        processNumber: 'resultados encontrados',
        processClass: 'Linha inválida',
      },
      {
        processTitle: 'CumSen 0003990-96.2012.4.01.3400 - Índice de 28,86% Lei 8.622/1993 e 8.627/1993',
        processClass: 'CUMPRIMENTO DE SENTENÇA',
        parties: 'MARA REJANY DA SILVA TERTO NARCIZO e outros (50) X UNIÃO FEDERAL',
        lastMovement: 'Conclusos para decisão',
        rawLastMovementText: '10/09/2025 14:27:38 - Conclusos para decisão',
        listLastMovementText: 'Conclusos para decisão (10/09/2025 14:27:38)',
      },
      {
        processTitle: 'CumSenFaz 1061274-59.2023.4.01.3400 - Abono Pecuniário (Art. 78 Lei 8.112/1990)',
        processClass: 'CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA',
        parties: 'ADIR SERGIO MARGON e outros (49) X UNIÃO FEDERAL',
        lastMovement: 'Conclusos para decisão',
        rawLastMovementText: '03/09/2025 14:53:59 - Conclusos para decisão',
        listLastMovementText: 'Conclusos para decisão (03/09/2025 14:53:59)',
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      source: 'trf1',
      sourceLabel: 'TRF1',
      processNumber: '0003990-96.2012.4.01.3400',
      processClass: 'CUMPRIMENTO DE SENTENÇA',
      processTitle: 'CumSen 0003990-96.2012.4.01.3400 - Índice de 28,86% Lei 8.622/1993 e 8.627/1993',
      parties: 'MARA REJANY DA SILVA TERTO NARCIZO e outros (50) X UNIÃO FEDERAL',
      lastMovement: 'Conclusos para decisão',
      rawLastMovementText: '10/09/2025 14:27:38 - Conclusos para decisão',
      listLastMovementText: 'Conclusos para decisão (10/09/2025 14:27:38)',
      lastMovementAt: '2025-09-10T14:27:38.000Z',
    });

    expect(items[1]).toMatchObject({
      processNumber: '1061274-59.2023.4.01.3400',
      processClass: 'CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA',
      processTitle: 'CumSenFaz 1061274-59.2023.4.01.3400 - Abono Pecuniário (Art. 78 Lei 8.112/1990)',
      parties: 'ADIR SERGIO MARGON e outros (49) X UNIÃO FEDERAL',
      lastMovement: 'Conclusos para decisão',
      rawLastMovementText: '03/09/2025 14:53:59 - Conclusos para decisão',
      listLastMovementText: 'Conclusos para decisão (03/09/2025 14:53:59)',
      lastMovementAt: '2025-09-03T14:53:59.000Z',
    });
  });
});
