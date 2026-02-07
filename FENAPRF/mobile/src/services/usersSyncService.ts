import { API_BASE_URL } from '../config/api';
import type { User } from '../types/user';
import { salvarUsersOffline, initDb } from '../database/db';
import { setLastSyncUsers } from './syncMetaService';

type UsersApiEnvelope = {
  users?: User[];
  total?: number;
  perfil_acesso?: string;
  [key: string]: unknown;
};

async function parseJsonSafe(resp: Response): Promise<any> {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

function normalizarLista(data: any): User[] {
  // Caso 1: API retorna lista pura: [ {..}, {..} ]
  if (Array.isArray(data)) {
    return data as User[];
  }

  // Caso 2: API retorna envelope: { users: [...] }
  if (data && typeof data === 'object' && Array.isArray((data as UsersApiEnvelope).users)) {
    return ((data as UsersApiEnvelope).users ?? []) as User[];
  }

  // Caso 3: formato inesperado
  return [];
}

export async function sincronizarUsers(token: string): Promise<{ recebidos: number }> {
  if (!token) {
    throw new Error('Token ausente. Faça login novamente.');
  }

  // Garante tabela criada (caso ainda não tenha sido inicializada em App.tsx)
  await initDb();

  const url = `${API_BASE_URL}/api/users`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor.');
  }

  const data = await parseJsonSafe(resp);

  if (!resp.ok) {
    throw new Error(data?.error || data?.message || `Erro ao listar usuários (${resp.status})`);
  }

  const lista = normalizarLista(data);

  const agoraIso = new Date().toISOString();
  const listaComTimestamp: User[] = lista.map((f) => ({
    ...f,
    // garante que o DB receba string
    updated_at: f.updated_at ?? agoraIso,
    // se o backend não mandar name, evitamos quebrar NOT NULL
    name: f.name ?? '(SEM NOME)',
  }));

  await salvarUsersOffline(listaComTimestamp as any);

  // grava meta de última sincronização
  await setLastSyncUsers(Date.now());

  return { recebidos: listaComTimestamp.length };
}
