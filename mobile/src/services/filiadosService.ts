// src/services/filiadosService.ts
import api from './apiService';
import { API_BASE_URL } from '../config/env';
import type { Filiado } from '../types/filiado';
import { salvarFiliadosOffline, listarFiliadosOffline } from '../database/db';
import { logError } from '../infra/logger';

const FILIADOS_ENDPOINT = `${API_BASE_URL}/api/filiados`;
// Ajuste se sua rota real for diferente (ex.: /api/restrito/filiados)

interface FiliadoApi {
  id: number | string;
  nome?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  telefone1?: string | null;
  email?: string | null;
  email1?: string | null;
  perfil_acesso?: string | null;
  situacao?: string | null;
  atualizado_em?: string | null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

// Busca lista de filiados na API
export async function fetchFiliadosFromApi(token: string): Promise<Filiado[]> {
  try {
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

    const data = await resp.json() as FiliadoApi[];

  // Mapeia a resposta da API para o tipo Filiado usado no app/banco
    const lista: Filiado[] = data.map((item) => {
      const telefone = asNullableString(item.telefone1 ?? item.telefone) ?? '';
      const email = asNullableString(item.email1 ?? item.email) ?? '';
      return {
        id: String(item.id),
        nome: asNullableString(item.nome) ?? '',
        cpf: asNullableString(item.cpf) ?? '',
        perfil_acesso: asNullableString(item.perfil_acesso) ?? 'FILIADO',
        situacao: asNullableString(item.situacao) ?? 'ATIVO',
        telefone1: telefone,
        email1: email,
        atualizado_em: asNullableString(item.atualizado_em) ?? new Date().toISOString(),
      };
    });

    return lista;
  } catch (err) {
    logError('Service.fetchFiliadosFromApi', err);
    throw err;
  }
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

/**
 * Envia o avatar do usuário logado para a API.
 * @param uri O URI local do arquivo de imagem.
 * @returns Os dados do filiado atualizado com a nova URL do avatar.
 */
export async function uploadAvatar(uri: string) {
  const filename = uri.split('/').pop() || 'avatar.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  const formData = new FormData();
  formData.append('avatar', {
    uri,
    name: filename,
    type,
  } as any);

  // A instância 'api' já tem o interceptor de token
  const { data } = await api.post('/api/filiados/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return data;
}

/**
 * Envia uma requisição para remover o avatar do usuário logado.
 * @returns Os dados do filiado atualizado (sem avatar_url).
 */
export async function removerAvatar() {
  const { data } = await api.delete('/api/filiados/me/avatar');
  return data;
}
