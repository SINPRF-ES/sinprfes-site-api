// src/database/db.ts
import * as SQLite from 'expo-sqlite';
import type { Filiado } from '../types/filiado';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Abre (ou reaproveita) o banco
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('sinprf_offline.db');
  }
  return dbPromise;
}

// Inicializa a estrutura básica (tabela de filiados offline)
export async function initDb(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS offline_filiados (
      id INTEGER PRIMARY KEY NOT NULL,
      nome TEXT NOT NULL,
      cpf TEXT,
      telefone TEXT,
      email TEXT,
      situacao TEXT,
      atualizado_em TEXT
    );
  `);
}

// Salva lista de filiados no banco, substituindo o conteúdo anterior
export async function salvarFiliadosOffline(lista: Filiado[]): Promise<void> {
  const db = await getDb();

  // Limpa a tabela
  await db.execAsync('DELETE FROM offline_filiados;');

  // Statement preparado para inserir vários registros
  const stmt = await db.prepareAsync(
    `INSERT INTO offline_filiados
       (id, nome, cpf, telefone, email, situacao, atualizado_em)
     VALUES ($id, $nome, $cpf, $telefone, $email, $situacao, $atualizado_em)`
  );

  try {
    for (const f of lista) {
      await stmt.executeAsync({
        $id: f.id,
        $nome: f.nome,
        $cpf: f.cpf ?? null,
        $telefone: f.telefone ?? null,
        $email: f.email ?? null,
        $situacao: f.situacao ?? null,
        $atualizado_em: f.atualizado_em ?? null,
      });
    }
  } finally {
    await stmt.finalizeAsync();
  }
}

// Lê lista de filiados do banco local
export async function listarFiliadosOffline(): Promise<Filiado[]> {
  const db = await getDb();

  const rows = await db.getAllAsync<Filiado>(
    'SELECT id, nome, cpf, telefone, email, situacao, atualizado_em FROM offline_filiados ORDER BY nome COLLATE NOCASE;'
  );

  return rows;
}
// Buscar local por nome/cpf/telefone
export async function buscarFiliadosOffline(query: string, limit = 200): Promise<Filiado[]> {
  const db = await getDb();
  const q = `%${query.trim()}%`;

  const rows = await db.getAllAsync<Filiado>(
    `
    SELECT id, nome, cpf, telefone, email, situacao, atualizado_em
    FROM offline_filiados
    WHERE nome LIKE ? OR cpf LIKE ? OR telefone LIKE ?
    ORDER BY nome COLLATE NOCASE
    LIMIT ?;
    `,
    [q, q, q, limit]
  );

  return rows;
}

// Contar registros do cache local
export async function contarFiliadosOffline(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) as total FROM offline_filiados;');
  return row?.total ?? 0;
}