// src/services/filiadosService.ts
import { API_BASE_URL } from '../config/api';
import type { Filiado } from '../types/filiado';
import { salvarFiliadosOffline, listarFiliadosOffline } from '../database/db';

const FILIADOS_ENDPOINT = `${API_BASE_URL}/api/filiados`;
// Ajuste se sua rota real for diferente (ex.: /api/restrito/filiados)

interface FiliadoApi {
  id: number;
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
  email?: string | null;
  situacao?: string | null;
  // se sua API tiver mais campos (matrícula, lotação etc.), adicionamos depois
}

// Busca lista de filiados na API
export async function fetchFiliadosFromApi(token: string): Promise<Filiado[]> {
  const resp = await fetch(FILIADOS_ENDPOINT, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Erro ao buscar filiados: ${resp.status} - ${text}`);
  }

  const data: FiliadoApi[] = await resp.json();

  // Mapeia a resposta da API para o tipo Filiado usado no app/banco
  const lista: Filiado[] = data.map((item) => ({
    id: item.id,
    nome: item.nome,
    cpf: item.cpf ?? null,
    telefone: item.telefone ?? null,
    email: item.email ?? null,
    situacao: item.situacao ?? null,
    atualizado_em: new Date().toISOString(),
  }));

  return lista;
}

// Sincroniza: API → banco local
export async function sincronizarFiliadosOffline(token: string): Promise<void> {
  const lista = await fetchFiliadosFromApi(token);
  await salvarFiliadosOffline(lista);
}

// Expor a leitura local (apenas delegando pro db)
export async function obterFiliadosOffline(): Promise<Filiado[]> {
  return listarFiliadosOffline();
}
