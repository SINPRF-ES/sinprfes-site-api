import { API_BASE_URL } from '../config/api';
import type { VotacaoDetalhe, VotacaoResumo } from '../types/votacao';

async function parseJsonSafe(resp: Response): Promise<any> {
  try { return await resp.json(); } catch { return null; }
}

function authHeaders(token: string): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function listarVotacoes(token: string): Promise<VotacaoResumo[]> {
  const url = `${API_BASE_URL}/api/votacoes`;

  let resp: Response;
  try {
    resp = await fetch(url, { headers: authHeaders(token) });
  } catch {
    throw new Error('Não foi possível conectar ao servidor.');
  }

  const data = await parseJsonSafe(resp);
  if (!resp.ok) throw new Error(data?.error || data?.message || `Erro ao listar votações (${resp.status})`);

  return Array.isArray(data) ? (data as VotacaoResumo[]) : (data?.votacoes ?? []);
}

export async function obterVotacao(token: string, id: string): Promise<VotacaoDetalhe> {
  const url = `${API_BASE_URL}/api/votacoes/${id}`;

  let resp: Response;
  try {
    resp = await fetch(url, { headers: authHeaders(token) });
  } catch {
    throw new Error('Não foi possível conectar ao servidor.');
  }

  const data = await parseJsonSafe(resp);
  if (!resp.ok) throw new Error(data?.error || data?.message || `Erro ao obter votação (${resp.status})`);

  return data as VotacaoDetalhe;
}

export async function votar(
  token: string,
  id: string,
  payload: { opcao_id: string; device_id: string; biometria_confirmada: boolean }
): Promise<{ message: string; recibo?: string }> {
  const url = `${API_BASE_URL}/api/votacoes/${id}/votar`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor.');
  }

  const data = await parseJsonSafe(resp);
  if (!resp.ok) throw new Error(data?.error || data?.message || `Erro ao votar (${resp.status})`);

  return data ?? { message: 'Voto computado' };
}
