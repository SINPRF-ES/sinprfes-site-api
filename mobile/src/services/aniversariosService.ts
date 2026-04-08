import api from './apiService';

export interface AniversarioMedia {
  id: string;
  aniversario_id: string;
  tipo: 'IMAGEM' | 'VIDEO';
  url: string;
  ordem: number;
  created_at: string;
  is_capa?: boolean;
}

export interface AniversarioPost {
  id: string;
  public_ref?: string | null;
  titulo: string;
  conteudo: string;
  status: 'RASCUNHO' | 'PUBLICADA';
  status_editorial?: 'ATUAL' | 'ARQUIVADA';
  is_editable?: boolean;
  autor_id: number;
  autor_nome?: string;
  capa_url: string | null;
  capa_midia_id?: string | null;
  data_informe?: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  audiencia?: 'INTERNA' | 'PUBLICA';
  midias?: AniversarioMedia[];
}

const unwrapList = (data: any): AniversarioPost[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export const fetchAniversarios = async (statusArg?: any): Promise<AniversarioPost[]> => {
  const status = typeof statusArg === 'string' ? statusArg : undefined;
  const params: any = { audiencia: 'INTERNA' };
  if (status) params.status = status;
  const { data } = await api.get('/api/aniversarios', { params });
  return unwrapList(data);
};

export const fetchAniversario = async (id: string): Promise<AniversarioPost> => {
  const { data } = await api.get(`/api/aniversarios/${id}`);
  return data;
};

export const fetchAniversarioByRef = async (publicRef: string): Promise<AniversarioPost> => {
  const { data } = await api.get(`/api/aniversarios/ref/${encodeURIComponent(publicRef)}`);
  return data;
};

export const createAniversario = async (noticia: Partial<AniversarioPost>): Promise<AniversarioPost> => {
  const { data } = await api.post('/api/aniversarios', noticia);
  return data;
};

export const updateAniversario = async (id: string, noticia: Partial<AniversarioPost>): Promise<AniversarioPost> => {
  const { data } = await api.put(`/api/aniversarios/${id}`, noticia);
  return data;
};

export const definirCapaAniversario = async (id: string, coverMediaId: string | null): Promise<void> => {
  await api.put(`/api/aniversarios/${id}/capa`, { coverMediaId });
};

export const publicarAniversario = async (id: string): Promise<AniversarioPost> => {
  const { data } = await api.post(`/api/aniversarios/${id}/publicar`);
  return data;
};

export const deleteAniversario = async (id: string): Promise<void> => {
  await api.delete(`/api/aniversarios/${id}`);
};

export const addAniversarioMidia = async (id: string, file: any, tipo: 'IMAGEM' | 'VIDEO'): Promise<AniversarioMedia> => {
  const resourceType = tipo === 'VIDEO' ? 'video' : 'image';
  const { data: signatureData } = await api.post('/api/aniversarios/upload-signature', {
    folder: 'aniversarios',
    tags: 'aniversario',
    resource_type: resourceType,
  });

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
  formData.append('folder', 'aniversarios');
  formData.append('tags', 'aniversario');
  if (signatureData.params?.transformation) {
    formData.append('transformation', signatureData.params.transformation);
  }

  const cloudName = signatureData.cloud_name;

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  });

  const uploadResult = await response.json();

  if (!uploadResult.secure_url) {
    throw new Error('Erro ao fazer upload para o Cloudinary');
  }

  const { data } = await api.post(`/api/aniversarios/${id}/midias_external`, {
    tipo,
    url: uploadResult.secure_url,
    ordem: 0
  });

  return data;
};

export const deleteAniversarioMidia = async (midiaId: string): Promise<void> => {
  await api.delete(`/api/aniversarios/midias/${midiaId}`);
};
