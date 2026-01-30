import api from './apiService';

export interface NewsPost {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  bodyMarkdown: string;
  tags: string[];
  folderId: string;
  coverFileId: string | null;
  galleryFileIds: { id: string; name: string }[];
}

export const fetchNoticias = async (): Promise<NewsPost[]> => {
  const { data } = await api.get('/api/noticias');
  return data;
};

export const fetchNoticia = async (id: string): Promise<NewsPost> => {
  const { data } = await api.get(`/api/noticias/${id}`);
  return data;
};
