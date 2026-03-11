const fs = require('fs');
const path = require('path');
const { parseBrazilDateToIso, parseTrf1RowsFromHtml } = require('./pjeProcessParser');

describe('pjeProcessParser TRF1', () => {
  test('parseBrazilDateToIso converte data/hora BR em ISO', () => {
    expect(parseBrazilDateToIso('Juntada (10/09/2025 14:27:38)')).toBe('2025-09-10T14:27:38.000Z');
  });

  test('extrai exatamente os dois processos do fixture oficial de referência', () => {
    const fixture = fs.readFileSync(path.join(__dirname, '__fixtures__/trf1-reference-list.html'), 'utf8');
    const items = parseTrf1RowsFromHtml(fixture, 'https://pje1g-consultapublica.trf1.jus.br');

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      source: 'trf1',
      sourceLabel: 'TRF1',
      processNumber: '1061304-94.2023.4.01.3400',
      processClass: 'CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA',
      processTitle: 'CumSenFaz 1061304-94.2023.4.01.3400 - Abono Pecuniário (Art. 78 Lei 8.112/1990)',
      parties: 'ALESSANDRO ARAUJO DE MELLO e outros (45) X UNIÃO FEDERAL',
      lastMovement: 'Juntada de petição intercorrente',
      rawLastMovementText: '20/10/2025 20:12:22 - Juntada de petição intercorrente',
      listLastMovementText: 'Juntada de petição intercorrente (20/10/2025 20:12:22)',
    });
    expect(items[1]).toMatchObject({
      processNumber: '1055982-59.2024.4.01.3400',
      lastMovement: 'Juntada de manifestação',
      rawLastMovementText: '27/02/2025 15:37:20 - Juntada de manifestação',
    });
  });

  test('remove código numérico entre parênteses da classe', () => {
    const fixture = '<table id="fPP:processosTable"><tbody><tr><td>Classe: CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA (12078)</td><td><a href="/detalhe/1">CumSenFaz 1061304-94.2023.4.01.3400 - X</a></td><td>Partes: A X B</td><td>Última movimentação: Juntada (20/10/2025 20:12:22)</td></tr></tbody></table>';
    const items = parseTrf1RowsFromHtml(fixture, 'https://pje1g-consultapublica.trf1.jus.br');
    expect(items[0].processClass).toBe('CUMPRIMENTO DE SENTENÇA CONTRA A FAZENDA PÚBLICA');
  });

});
