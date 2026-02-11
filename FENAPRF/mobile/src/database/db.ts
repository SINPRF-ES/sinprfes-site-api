// src/database/db.ts
import * as SQLite from 'expo-sqlite';
import type { User } from '../types/user';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('fenaprf_offline.db');
  }
  return dbPromise;
}

export async function initDb(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS offline_users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      cpf TEXT,
      telefone TEXT,
      email TEXT,
      situacao TEXT,
      updated_at TEXT
    );
  `);
}

export async function salvarUsersOffline(lista: User[]): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM offline_users;');

  const stmt = await db.prepareAsync(
    `INSERT INTO offline_users (id, name, cpf, telefone, email, situacao, updated_at)
     VALUES ($id, $name, $cpf, $telefone, $email, $situacao, $updated_at)`
  );

  try {
    for (const f of lista) {
      await stmt.executeAsync({
        $id: f.id,
        $name: f.name,
        $cpf: f.cpf ?? null,
        $telefone: f.telefone1 ?? null,
        $email: f.email ?? null,
        $situacao: f.situacao ?? null,
        $updated_at: f.updated_at ?? null,
      });
    }
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function listarUsersOffline(): Promise<User[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT id, name, cpf, telefone as telefone1, email, situacao, updated_at FROM offline_users ORDER BY name COLLATE NOCASE;'
  );
  return rows as any[];
}
