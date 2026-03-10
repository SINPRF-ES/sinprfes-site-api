import api from './apiService';

export interface InformeMedia {
  id: string;
  noticia_id: string;
  tipo: 'IMAGEM' | 'VIDEO';
  url: string;
  ordem: number;
  created_at: string;
  is_capa?: boolean;
}

export interface InformePost {
  id: string;
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
  midias?: InformeMedia[];
}

const unwrapList = (data: any): InformePost[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export const fetchInformes = async (statusArg?: any): Promise<InformePost[]> => {
  const status = typeof statusArg === 'string' ? statusArg : undefined;
  const params: any = { audiencia: 'INTERNA' };
  if (status) params.status = status;
  const { data } = await api.get('/api/informes', { params });
  return unwrapList(data);
};

export const fetchInforme = async (id: string): Promise<InformePost> => {
  const { data } = await api.get(`/api/informes/${id}`);
  return data;
};

export const createInforme = async (noticia: Partial<InformePost>): Promise<InformePost> => {
  const { data } = await api.post('/api/informes', noticia);
  return data;
};

export const updateInforme = async (id: string, noticia: Partial<InformePost>): Promise<InformePost> => {
  const { data } = await api.put(`/api/informes/${id}`, noticia);
  return data;
};

export const definirCapaInforme = async (id: string, coverMediaId: string | null): Promise<void> => {
  await api.put(`/api/informes/${id}/capa`, { coverMediaId });
};

export const publicarInforme = async (id: string): Promise<InformePost> => {
  const { data } = await api.post(`/api/informes/${id}/publicar`);
  return data;
};

export const deleteInforme = async (id: string): Promise<void> => {
  await api.delete(`/api/informes/${id}`);
};

export const addInformeMidia = async (id: string, file: any, tipo: 'IMAGEM' | 'VIDEO'): Promise<InformeMedia> => {
  const { data: signatureData } = await api.post('/api/informes/upload-signature', {
    folder: 'informes',
    tags: 'informe'
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
  formData.append('folder', 'informes');
  formData.append('tags', 'informe');

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

  const { data } = await api.post(`/api/informes/${id}/midias_external`, {
    tipo,
    url: uploadResult.secure_url,
    ordem: 0
  });

  return data;
};

export const deleteInformeMidia = async (midiaId: string): Promise<void> => {
  await api.delete(`/api/informes/midias/${midiaId}`);
};
