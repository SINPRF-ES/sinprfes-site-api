const { importRows } = require('./import-nao-filiados');

function makeClient({ dupCpf = false, dupMatricula = false } = {}) {
  return {
    query: jest.fn(async (sql, params) => {
      const q = String(sql).replace(/\s+/g, ' ').trim();

      if (q.includes('FROM information_schema.columns')) {
        return { rows: [{ column_name: 'siape' }, { column_name: 'lotacao' }] };
      }

      if (q.includes('WHERE cpf = $1')) {
        return dupCpf ? { rows: [{ id: 10 }] } : { rows: [] };
      }

      if (q.includes('WHERE siape = $1')) {
        return dupMatricula ? { rows: [{ id: 20 }] } : { rows: [] };
      }

      if (q.includes('WHERE lower(nome) = lower($1)')) {
        return { rows: [] };
      }

      if (q.startsWith('INSERT INTO filiados')) {
        return { rows: [] };
      }

      throw new Error(`Query não mockada: ${q} / params=${JSON.stringify(params)}`);
    }),
  };
}

describe('import-nao-filiados smoke', () => {
  test('importa registro com apenas nome', async () => {
    const client = makeClient();
    const report = await importRows(client, [{ lineNumber: 2, row: { nome: 'Maria Teste' } }], { dryRun: false });

    expect(report.totalImported).toBe(1);
    expect(report.totalSkippedDuplicate).toBe(0);
    expect(report.totalInvalid).toBe(0);
  });

  test('ignora duplicidade por CPF', async () => {
    const client = makeClient({ dupCpf: true });
    const report = await importRows(client, [{ lineNumber: 2, row: { nome: 'Maria Teste', cpf: '123.456.789-01' } }], { dryRun: false });

    expect(report.totalImported).toBe(0);
    expect(report.totalSkippedDuplicate).toBe(1);
    expect(report.errors.join(' ')).toMatch(/duplicidade/i);
  });

  test('ignora duplicidade por matrícula', async () => {
    const client = makeClient({ dupMatricula: true });
    const report = await importRows(client, [{ lineNumber: 2, row: { nome: 'Maria Teste', matricula: '1234567' } }], { dryRun: false });

    expect(report.totalImported).toBe(0);
    expect(report.totalSkippedDuplicate).toBe(1);
  });

  test('rejeita linha sem nome', async () => {
    const client = makeClient();
    const report = await importRows(client, [{ lineNumber: 2, row: { cpf: '12345678901' } }], { dryRun: false });

    expect(report.totalImported).toBe(0);
    expect(report.totalInvalid).toBe(1);
    expect(report.errors.join(' ')).toMatch(/nome é obrigatório/i);
  });
});
