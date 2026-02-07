// src/services/filiadosService.ts
import api from './apiService';
import { API_BASE_URL } from '../config/api';
import type { User } from '../types/usuario';
import { salvarFiliadosOffline, listarFiliadosOffline } from '../database/db';
import { logError } from '../infra/logger';

const FILIADOS_ENDPOINT = `${API_BASE_URL}/api/users`;
// Ajuste se sua rota real for diferente (ex.: /api/restrito/filiados)

interface UserApi {
  id: string;
  name: string;
  cpf?: string | null;
  telefone1?: string | null;
  email?: string | null;
  situacao?: string | null;
  perfil_acesso?: string | null;
}

// Busca lista de filiados na API
export async function fetchFiliadosFromApi(token: string): Promise<User[]> {
  try {
    const resp = await fetch(FILIADOS_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Erro ao buscar usuários: ${resp.status} - ${text}`);
    }

    const data: UserApi[] = await resp.json();

  // Mapeia a resposta da API para o tipo User usado no app/banco
  const lista: User[] = data.map((item) => ({
    ...item,
    id: item.id,
    name: item.name,
    cpf: item.cpf ?? '',
    telefone1: item.telefone1 ?? null,
    email: item.email ?? null,
    situacao: item.situacao ?? 'ATIVO',
    perfil_acesso: (item.perfil_acesso as any) ?? 'CONSELHEIRO',
    updated_at: new Date().toISOString(),
  } as User));

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
export async function obterFiliadosOffline(): Promise<User[]> {
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
  const { data } = await api.post('/api/users/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return data;
}

/**
 * Envia uma requisição para remover o avatar do usuário logado.
 * @returns Os dados do usuário atualizado (sem avatar_url).
 */
export async function removerAvatar() {
  const { data } = await api.delete('/api/users/me/avatar');
  return data;
}
