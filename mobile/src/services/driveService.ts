// mobile/src/services/driveService.ts
import api from './apiService';

export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink: string;
  createdTime: string;
  mimeType: string;
}

export const getPublicacoes = async (): Promise<DriveFile[]> => {
  try {
    // A rota /api/publicacoes no backend deve chamar o drive.service.js
    const { data } = await api.get('/api/publicacoes');
    return data;
  } catch (error) {
    console.error('Erro ao buscar publicações:', error);
    throw error;
  }
};
