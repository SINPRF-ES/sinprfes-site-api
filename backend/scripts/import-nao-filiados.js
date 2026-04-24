#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');
const { normalizeCpf, normalizeTelefone } = require('../src/shared/format');
const { normalizeNome, normalizeLotacao, SITUACAO_SINDICAL } = require('../../shared/canon');

const REQUIRED_COLUMN = 'nome';

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function mapHeader(header) {
  const h = normalizeHeader(header);
  if (['nome', 'nomeservidor', 'servidor'].includes(h)) return 'nome';
  if (['cpf'].includes(h)) return 'cpf';
  if (['matricula', 'siape'].includes(h)) return 'matricula';
  if (['email', 'email1'].includes(h)) return 'email';
  if (['telefone', 'telefone1', 'celular', 'whatsapp'].includes(h)) return 'telefone';
  if (['lotacao', 'lotacaoatual'].includes(h)) return 'lotacao';
  return null;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }

    cur += char;
  }

  out.push(cur);
  return out;
}

function parseCsv(content) {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  if (!lines.length) return [];

  const headersRaw = parseCsvLine(lines[0]);
  const headers = headersRaw.map((header) => mapHeader(header));

  if (!headers.includes(REQUIRED_COLUMN)) {
    throw new Error('Arquivo inválido: coluna "nome" é obrigatória.');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};

    headers.forEach((mapped, idx) => {
      if (!mapped) return;
      row[mapped] = (cols[idx] || '').trim();
    });

    rows.push({
      lineNumber: i + 1,
      row,
    });
  }

  return rows;
}

function parseXlsx(filePath) {
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch (err) {
    throw new Error('Arquivo XLSX não suportado neste ambiente (dependência "xlsx" ausente). Converta para CSV.');
  }

  const wb = XLSX.readFile(filePath);
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];

  const jsonRows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName], { defval: '' });
  return jsonRows.map((original, idx) => {
    const row = {};
    Object.entries(original).forEach(([k, v]) => {
      const mapped = mapHeader(k);
      if (!mapped) return;
      row[mapped] = String(v || '').trim();
    });
    return {
      lineNumber: idx + 2,
      row,
    };
  });
}

function parseSpreadsheet(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    return parseCsv(fs.readFileSync(filePath, 'utf8'));
  }
  if (ext === '.xlsx') {
    return parseXlsx(filePath);
  }

  throw new Error('Formato não suportado. Use .csv (recomendado) ou .xlsx.');
}

function buildNormalizedRow(rawRow, hasLotacao, matriculaColumn) {
  const nome = normalizeNome(rawRow.nome || '');
  const cpfRaw = String(rawRow.cpf || '').trim();
  const matriculaRaw = String(rawRow.matricula || '').trim();

  const cpf = cpfRaw ? normalizeCpf(cpfRaw) : null;
  const matriculaDigits = matriculaRaw ? matriculaRaw.replace(/\D/g, '') : '';
  const matricula = matriculaDigits ? matriculaDigits.slice(0, matriculaColumn === 'siape' ? 7 : 20) : null;
  const email = rawRow.email ? String(rawRow.email).trim().toLowerCase() : null;
  const telefone = rawRow.telefone ? normalizeTelefone(rawRow.telefone) : null;
  const lotacao = hasLotacao && rawRow.lotacao ? normalizeLotacao(rawRow.lotacao) : null;

  return {
    nome,
    cpf,
    matricula,
    email,
    telefone,
    lotacao,
  };
}

async function loadSchemaColumns(client) {
  const { rows } = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'filiados'
    `
  );
  const columns = new Set(rows.map((r) => r.column_name));
  return {
    hasLotacao: columns.has('lotacao'),
    matriculaColumn: columns.has('matricula') ? 'matricula' : 'siape',
  };
}

async function importRows(client, rows, options = {}) {
  const { dryRun = false } = options;
  const schema = await loadSchemaColumns(client);

  const report = {
    totalRead: rows.length,
    totalImported: 0,
    totalSkippedDuplicate: 0,
    totalInvalid: 0,
    possibleNameDuplicates: [],
    errors: [],
  };

  for (const entry of rows) {
    const { lineNumber, row } = entry;
    try {
      const data = buildNormalizedRow(row, schema.hasLotacao, schema.matriculaColumn);

      if (!data.nome) {
        report.totalInvalid += 1;
        report.errors.push(`Linha ${lineNumber}: campo nome é obrigatório.`);
        continue;
      }

      let duplicateReason = null;

      if (data.cpf) {
        const cpfDup = await client.query('SELECT id FROM filiados WHERE cpf = $1 LIMIT 1', [data.cpf]);
        if (cpfDup.rows[0]) duplicateReason = `CPF já cadastrado (id=${cpfDup.rows[0].id})`;
      }

      if (!duplicateReason && data.matricula) {
        const matDup = await client.query(
          `SELECT id FROM filiados WHERE ${schema.matriculaColumn} = $1 LIMIT 1`,
          [data.matricula]
        );
        if (matDup.rows[0]) duplicateReason = `${schema.matriculaColumn} já cadastrado (id=${matDup.rows[0].id})`;
      }

      if (duplicateReason) {
        report.totalSkippedDuplicate += 1;
        report.errors.push(`Linha ${lineNumber}: ignorado por duplicidade - ${duplicateReason}.`);
        continue;
      }

      if (!data.cpf && !data.matricula) {
        const similarName = await client.query(
          `
          SELECT id, nome
          FROM filiados
          WHERE lower(nome) = lower($1)
          LIMIT 1
          `,
          [data.nome]
        );

        if (similarName.rows[0]) {
          report.possibleNameDuplicates.push(
            `Linha ${lineNumber}: nome semelhante ao cadastro id=${similarName.rows[0].id} (${similarName.rows[0].nome}).`
          );
        }
      }

      if (dryRun) {
        report.totalImported += 1;
        continue;
      }

      const columns = ['nome', 'cpf', schema.matriculaColumn, 'email1', 'telefone1', 'situacao', 'situacao_sindical', 'perfil_acesso', 'bloqueado', 'criado_em', 'atualizado_em'];
      const values = [
        data.nome,
        data.cpf,
        data.matricula,
        data.email,
        data.telefone,
        'ATIVO',
        SITUACAO_SINDICAL.NAO_FILIADO,
        'FILIADO',
        true,
      ];

      if (schema.hasLotacao) {
        columns.splice(5, 0, 'lotacao');
        values.splice(5, 0, data.lotacao);
      }

      const placeholders = values.map((_, idx) => `$${idx + 1}`);
      placeholders.push('NOW()');
      placeholders.push('NOW()');

      await client.query(
        `
          INSERT INTO filiados (${columns.join(', ')})
          VALUES (${placeholders.join(', ')})
        `,
        values
      );

      report.totalImported += 1;
    } catch (err) {
      report.totalInvalid += 1;
      report.errors.push(`Linha ${lineNumber}: ${err.message}`);
    }
  }

  return report;
}

async function run() {
  const [, , filePathArg, ...flags] = process.argv;
  if (!filePathArg) {
    console.error('Uso: node backend/scripts/import-nao-filiados.js <arquivo.csv|arquivo.xlsx> [--dry-run]');
    process.exit(1);
  }

  const dryRun = flags.includes('--dry-run');
  const filePath = path.resolve(process.cwd(), filePathArg);

  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  const rows = parseSpreadsheet(filePath);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const report = await importRows(client, rows, { dryRun });

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    console.log('=== Relatório de Importação de Não Filiados ===');
    console.log(`Arquivo: ${filePath}`);
    console.log(`Modo: ${dryRun ? 'DRY-RUN (sem persistência)' : 'IMPORTAÇÃO REAL'}`);
    console.log(`Total de linhas lidas: ${report.totalRead}`);
    console.log(`Total importado: ${report.totalImported}`);
    console.log(`Total ignorado por duplicidade: ${report.totalSkippedDuplicate}`);
    console.log(`Total inválido: ${report.totalInvalid}`);

    if (report.possibleNameDuplicates.length) {
      console.log('\nPossíveis duplicidades por nome (não bloqueantes):');
      report.possibleNameDuplicates.forEach((item) => console.log(`- ${item}`));
    }

    if (report.errors.length) {
      console.log('\nErros / avisos:');
      report.errors.forEach((error) => console.log(`- ${error}`));
    }

    console.log('\nSegurança aplicada no sistema para NAO_FILIADO:');
    console.log('- Não autenticam no login (auth.controller/middleware valida situacao_sindical).');
    console.log('- Não participam de assembleias (auth/requirePermission bloqueia não FILIADO_SINPRF_ES).');
    console.log('- Não recebem push coletivo (queries de push filtram situacao_sindical = FILIADO_SINPRF_ES).');
    console.log('- Não aparecem como filiados reais em listagens para perfil FILIADO.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Falha na importação:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  parseCsv,
  parseCsvLine,
  mapHeader,
  buildNormalizedRow,
  importRows,
};
