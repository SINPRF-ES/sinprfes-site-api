import api from './apiService';

export interface NewsMedia {
  id: string;
  noticia_id: string;
  tipo: 'IMAGEM' | 'VIDEO';
  url: string;
  ordem: number;
  created_at: string;
}

export interface NewsPost {
  id: string;
  titulo: string;
  conteudo: string;
  status: 'RASCUNHO' | 'PUBLICADA';
  autor_id: number;
  autor_nome?: string;
  capa_url: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  midias?: NewsMedia[];
}

export const fetchNoticias = async (status?: string): Promise<NewsPost[]> => {
  const { data } = await api.get('/api/noticias', { params: { status } });
  return data;
};

export const fetchNoticia = async (id: string): Promise<NewsPost> => {
  const { data } = await api.get(`/api/noticias/${id}`);
  return data;
};

export const createNoticia = async (noticia: Partial<NewsPost>): Promise<NewsPost> => {
  const { data } = await api.post('/api/noticias', noticia);
  return data;
};

export const updateNoticia = async (id: string, noticia: Partial<NewsPost>): Promise<NewsPost> => {
  const { data } = await api.put(`/api/noticias/${id}`, noticia);
  return data;
};

export const publicarNoticia = async (id: string): Promise<NewsPost> => {
  const { data } = await api.post(`/api/noticias/${id}/publicar`);
  return data;
};

export const deleteNoticia = async (id: string): Promise<void> => {
  await api.delete(`/api/noticias/${id}`);
};

export const addNoticiaMidia = async (id: string, file: any, tipo: 'IMAGEM' | 'VIDEO'): Promise<NewsMedia> => {
  const formData = new FormData();
  // @ts-ignore
  formData.append('file', {
    uri: file.uri,
    type: file.type || 'image/jpeg',
    name: file.name || 'upload.jpg',
  });
  formData.append('tipo', tipo);

  const { data } = await api.post(`/api/noticias/${id}/midias`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteNoticiaMidia = async (midiaId: string): Promise<void> => {
  await api.delete(`/api/noticias/midias/${midiaId}`);
};
