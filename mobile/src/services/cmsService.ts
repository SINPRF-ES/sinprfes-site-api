import api from './apiService';

export type NoticiaCMS = {
  id: string;
  titulo: string;
  conteudo: string;
  status: 'RASCUNHO' | 'PUBLICADA';
  status_editorial?: 'ATUAL' | 'ARQUIVADA';
};

export type ContentBlockCMS = {
  id: string;
  title: string;
  body: string;
  link_url?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  is_active: boolean;
  ordenacao: number;
  page: string;
};

export async function listarNoticiasCMS(statusEditorial: 'ATUAL' | 'ARQUIVADA') {
  const { data } = await api.get('/api/noticias', { params: { status_editorial: statusEditorial } });
  return Array.isArray(data) ? data as NoticiaCMS[] : [];
}

export async function criarNoticiaCMS(payload: Pick<NoticiaCMS, 'titulo' | 'conteudo'>) {
  const { data } = await api.post('/api/noticias', payload);
  return data as NoticiaCMS;
}

export async function atualizarNoticiaCMS(id: string, payload: Pick<NoticiaCMS, 'titulo' | 'conteudo'>) {
  const { data } = await api.put(`/api/noticias/${id}`, payload);
  return data as NoticiaCMS;
}

export async function publicarNoticiaCMS(id: string) {
  await api.post(`/api/noticias/${id}/publicar`);
}

export async function arquivarNoticiaCMS(id: string) {
  await api.post(`/api/noticias/${id}/arquivar`);
}

export async function listarConveniosCMS() {
  const { data } = await api.get('/api/content-blocks', { params: { page: 'convenios', includeInactive: true } });
  return Array.isArray(data) ? data as ContentBlockCMS[] : [];
}

export async function criarConvenioCMS() {
  const { data } = await api.post('/api/content-blocks', {
    page: 'convenios',
    title: 'Novo convênio',
    is_active: true,
  });
  return data as ContentBlockCMS;
}

export async function atualizarConvenioCMS(id: string, payload: Partial<ContentBlockCMS>) {
  const { data } = await api.put(`/api/content-blocks/${id}`, payload);
  return data as ContentBlockCMS;
}
