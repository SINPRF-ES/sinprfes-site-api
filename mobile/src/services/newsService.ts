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
  audiencia?: 'INTERNA' | 'PUBLICA';
  midias?: NewsMedia[];
}

export const fetchNoticias = async (statusArg?: any): Promise<NewsPost[]> => {
  // Garantir que status seja apenas string ou undefined (evita React Query context)
  // Se for chamado diretamente pelo useQuery, statusArg será o context object.
  const status = typeof statusArg === 'string' ? statusArg : undefined;

  // Usamos um objeto de params limpo para evitar poluição
  const params: any = {};
  if (status) params.status = status;
  params.audiencia = 'INTERNA';

  const { data } = await api.get('/api/noticias', { params });
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
  // 1. Obter assinatura para upload direto (Signed Upload)
  const { data: signatureData } = await api.post('/api/noticias/upload-signature', {
    folder: 'noticias',
    tags: 'noticia'
  });

  // 2. Upload direto para o Cloudinary
  const formData = new FormData();
  // @ts-ignore
  formData.append('file', {
    uri: file.uri,
    type: file.type,
    name: file.name,
  });
  formData.append('api_key', signatureData.api_key);
  formData.append('timestamp', signatureData.timestamp.toString());
  formData.append('signature', signatureData.signature);
  formData.append('folder', 'noticias');
  formData.append('tags', 'noticia');

  const cloudName = signatureData.cloud_name;
  const resourceType = tipo === 'VIDEO' ? 'video' : 'image';

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  });

  const uploadResult = await response.json();

  if (!uploadResult.secure_url) {
    throw new Error('Erro ao fazer upload para o Cloudinary');
  }

  // 3. Associar a mídia no nosso backend
  const { data } = await api.post(`/api/noticias/${id}/midias_external`, {
    tipo,
    url: uploadResult.secure_url,
    ordem: 0
  });

  return data;
};

export const deleteNoticiaMidia = async (midiaId: string): Promise<void> => {
  await api.delete(`/api/noticias/midias/${midiaId}`);
};
