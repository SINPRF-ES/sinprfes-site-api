// src/database/db.ts
import * as SQLite from 'expo-sqlite';
import type { Filiado } from '../types/filiado';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('sinprf_offline.db');
  }
  return dbPromise;
}

export async function initDb(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS offline_filiados (
      id TEXT PRIMARY KEY NOT NULL,
      nome TEXT NOT NULL,
      cpf TEXT,
      telefone TEXT,
      email TEXT,
      situacao TEXT,
      atualizado_em TEXT
    );
  `);
}

export async function salvarFiliadosOffline(lista: Filiado[]): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM offline_filiados;');

  const stmt = await db.prepareAsync(
    `INSERT INTO offline_filiados (id, nome, cpf, telefone, email, situacao, atualizado_em)
     VALUES ($id, $nome, $cpf, $telefone, $email, $situacao, $atualizado_em)`
  );

  try {
    for (const f of lista) {
      await stmt.executeAsync({
        $id: f.id,
        $nome: f.nome,
        $cpf: f.cpf ?? null,
        $telefone: f.telefone1 ?? null,
        $email: f.email1 ?? null,
        $situacao: f.situacao ?? null,
        $atualizado_em: f.atualizado_em ?? null,
      });
    }
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function listarFiliadosOffline(): Promise<Filiado[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT id, nome, cpf, telefone as telefone1, email as email1, situacao, atualizado_em FROM offline_filiados ORDER BY nome COLLATE NOCASE;'
  );
  return rows;
}

