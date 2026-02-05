import { API_BASE_URL } from '../config/api';
import type { Filiado } from '../types/filiado';
import { salvarFiliadosOffline, initDb } from '../database/db';
import { setLastSyncFiliados } from './syncMetaService';

type FiliadosApiEnvelope = {
  filiados?: Filiado[];
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

function normalizarLista(data: any): Filiado[] {
  // Caso 1: API retorna lista pura: [ {..}, {..} ]
  if (Array.isArray(data)) {
    return data as Filiado[];
  }

  // Caso 2: API retorna envelope: { filiados: [...] }
  if (data && typeof data === 'object' && Array.isArray((data as FiliadosApiEnvelope).filiados)) {
    return ((data as FiliadosApiEnvelope).filiados ?? []) as Filiado[];
  }

  // Caso 3: formato inesperado
  return [];
}

export async function sincronizarFiliados(token: string): Promise<{ recebidos: number }> {
  if (!token) {
    throw new Error('Token ausente. Faça login novamente.');
  }

  // Garante tabela criada (caso ainda não tenha sido inicializada em App.tsx)
  await initDb();

  const url = `${API_BASE_URL}/api/filiados`;

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
    throw new Error(data?.error || data?.message || `Erro ao listar filiados (${resp.status})`);
  }

  const lista = normalizarLista(data);

  const agoraIso = new Date().toISOString();
  const listaComTimestamp: Filiado[] = lista.map((f) => ({
    ...f,
    // garante que o DB receba string
    atualizado_em: (f as any).atualizado_em ?? agoraIso,
    // se o backend não mandar nome, evitamos quebrar NOT NULL
    nome: (f as any).nome ?? '(SEM NOME)',
  }));

  await salvarFiliadosOffline(listaComTimestamp);

  // grava meta de última sincronização
  await setLastSyncFiliados(Date.now());

  return { recebidos: listaComTimestamp.length };
}
