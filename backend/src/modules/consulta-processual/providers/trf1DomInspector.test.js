const { inspectResultsDom } = require('./trf1DomInspector');

describe('trf1DomInspector', () => {
  test('resume métricas da listagem', () => {
    const inspection = inspectResultsDom({
      hasGridPanel: true,
      hasGridPanelBody: true,
      hasProcessTable: true,
      panelText: '2 resultados encontrados 0003990-96.2012.4.01.3400 1061274-59.2023.4.01.3400',
      detectedLinks: ['https://x/a', 'https://x/b'],
      rawRows: [
        { processNumber: '0003990-96.2012.4.01.3400', detailsUrl: 'https://x/a', processClass: 'Classe', parties: 'A X B', rawText: 'abc' },
        { ignored: true, reason: 'no_cnj_in_td1', rawText: 'sem cnj' },
      ],
    });

    expect(inspection.declaredResultsTextDetected).toBe(true);
    expect(inspection.declaredResultsCount).toBe(2);
    expect(inspection.cnjMatchesFound).toBe(2);
    expect(inspection.linksFound).toBe(2);
    expect(inspection.blocksFound).toBe(2);
    expect(inspection.blockSummaries[1].reason).toBe('no_cnj_in_td1');
  });
});
