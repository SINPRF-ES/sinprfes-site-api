// mobile/src/services/driveService.ts
import api from './apiService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export interface DriveFile {
  id: string;
  name: string;
  mimeType?: string | null;
  createdTime?: string | null;
  webViewLink?: string | null; // Manter para compatibilidade, mas não usar para downloads seguros
  isFolder: boolean;
}

/**
 * Busca a lista de publicações (arquivos e pastas) do Google Drive.
 * @param folderId O ID da pasta a ser listada. Se nulo, lista a raiz.
 */
export const fetchPublicacoes = async (folderId: string | null = null): Promise<DriveFile[]> => {
  const endpoint = folderId ? `/api/publicacoes?folderId=${folderId}` : '/api/publicacoes';
  const { data } = await api.get(endpoint);

  // Mapeia a resposta para garantir o campo `isFolder`
  return data.map((item: any) => ({
    ...item,
    isFolder: item.mimeType === 'application/vnd.google-apps.folder',
  }));
};

/**
 * Baixa um arquivo de publicação de forma segura e o abre.
 * @param file O objeto do arquivo a ser baixado.
 */
export const downloadPublicacao = async (file: DriveFile): Promise<void> => {
  const { id, name } = file;
  const localUri = `${FileSystem.cacheDirectory}${name}`;

  try {
    const { uri } = await FileSystem.downloadAsync(
      `${api.defaults.baseURL}/api/publicacoes/arquivo/${id}`,
      localUri,
      {
        headers: { // Garante que o token de autorização seja enviado
          Authorization: api.defaults.headers.common.Authorization,
        },
      }
    );

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    } else {
      Alert.alert('Indisponível', 'A funcionalidade de compartilhamento não está disponível neste dispositivo.');
    }
  } catch (error: any) {
    console.error('Erro no download:', error);
    Alert.alert('Erro', 'Não foi possível baixar o arquivo. Verifique sua conexão e tente novamente.');
  }
};
