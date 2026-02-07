// src/database/db.ts
import * as SQLite from 'expo-sqlite';
import type { User } from '../types/usuario';

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

    CREATE TABLE IF NOT EXISTS offline_users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      cpf TEXT,
      telefone TEXT,
      email TEXT,
      situacao TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS offline_jogos_inscricoes (
      filiado_id TEXT PRIMARY KEY NOT NULL,
      nome_filiado TEXT,
      modalidades TEXT,
      sexo TEXT,
      qtd_familiares INTEGER,
      familiares TEXT,
      observacoes TEXT,
      data_inscricao TEXT,
      data_nascimento TEXT
    );
  `);
}

export async function salvarFiliadosOffline(lista: User[]): Promise<void> {
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

export async function listarFiliadosOffline(): Promise<User[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT id, name, cpf, telefone as telefone1, email, situacao, updated_at FROM offline_users ORDER BY name COLLATE NOCASE;'
  );
  return rows as any[];
}

export async function salvarJogosInscricoesOffline(lista: any[]): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM offline_jogos_inscricoes;');

  const stmt = await db.prepareAsync(
    `INSERT INTO offline_jogos_inscricoes
       (filiado_id, nome_filiado, modalidades, sexo, qtd_familiares, familiares, observacoes, data_inscricao, data_nascimento)
     VALUES ($filiado_id, $nome_filiado, $modalidades, $sexo, $qtd_familiares, $familiares, $observacoes, $data_inscricao, $data_nascimento)`
  );

  try {
    for (const i of lista) {
      await stmt.executeAsync({
        $filiado_id: i.filiado_id,
        $nome_filiado: i.nome_filiado,
        $modalidades: JSON.stringify(i.modalidades || []),
        $sexo: i.sexo,
        $qtd_familiares: i.qtd_familiares,
        $familiares: i.familiares,
        $observacoes: i.observacoes,
        $data_inscricao: i.data_inscricao,
        $data_nascimento: i.data_nascimento,
      });
    }
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function listarJogosInscricoesOffline(): Promise<any[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM offline_jogos_inscricoes ORDER BY nome_filiado ASC;');
  return rows.map(r => ({
    ...r,
    modalidades: JSON.parse(r.modalidades || '[]')
  }));
}
