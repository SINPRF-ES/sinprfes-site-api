const { parseBrazilDateToIso, createPjeParser, extractCnj, isValidProcessNumber } = require('./pjeProcessParser');

const parseTrf1Rows = createPjeParser('trf1', 'TRF1');

describe('pjeProcessParser', () => {
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

  test('parseTrf1Rows (via createPjeParser) normaliza estrutura e usa última movimentação do detalhe', () => {
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
        detailsUrl: 'https://trf1.test/detalhe1',
      },
      {
        processTitle: 'CumSenFaz 1061274-59.2023.4.01.3400 - Abono Pecuniário (Art. 78 Lei 8.112/1990)',
        processClass: 'CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA',
        parties: 'ADIR SERGIO MARGON e outros (49) X UNIÃO FEDERAL',
        lastMovement: 'Conclusos para decisão',
        rawLastMovementText: '03/09/2025 14:53:59 - Conclusos para decisão',
        listLastMovementText: 'Conclusos para decisão (03/09/2025 14:53:59)',
        detailsUrl: 'https://trf1.test/detalhe2',
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


test('parseTrf1Rows descarta item sem href com motivo explícito', () => {
  const discards = [];
  const items = parseTrf1Rows([
    {
      processNumber: '0003990-96.2012.4.01.3400',
      processClass: 'CUMPRIMENTO DE SENTENÇA',
      rawText: '0003990-96.2012.4.01.3400 sem link',
    },
  ], (warning) => discards.push(warning));

  expect(items).toHaveLength(0);
  expect(discards).toHaveLength(1);
  expect(discards[0].reason).toBe('missing_href');
});


test('parseTrf1Rows remove sufixo técnico da classe e limpa ruído de movimentação', () => {
  const items = parseTrf1Rows([
    {
      processTitle: 'CumSen 0003990-96.2012.4.01.3400 - Índice de 28,86% Lei 8.622/1993 e 8.627/1993',
      processClass: 'CUMPRIMENTO DE SENTENÇA CumSen',
      rawLastMovementText: '10/09/2025 14:27:38 - Conclusos para decisão Documentos do processo Paginação 1 de 10',
      detailsUrl: 'https://trf1.test/detalhe1',
    },
  ]);

  expect(items).toHaveLength(1);
  expect(items[0].processClass).toBe('CUMPRIMENTO DE SENTENÇA');
  expect(items[0].lastMovement).toBe('Conclusos para decisão');
});
