// mobile/src/services/driveService.ts
import api from './apiService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { logDebug } from '../utils/filiadoUtils';

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
export const downloadPublicacao = async (file: DriveFile): Promise<boolean> => {
  const { id, name } = file;
  // Use um nome de arquivo sanitizado para o cache
  const safeName = name.replace(/[^a-zA-Z0-9.-_]/g, '');
  const localUri = `${FileSystem.cacheDirectory}${safeName}`;

  try {
    logDebug('Publicacoes.download.start', { id, localUri });
    const downloadResumable = FileSystem.createDownloadResumable(
      `${api.defaults.baseURL}/api/publicacoes/arquivo/${id}`,
      localUri,
      {
        headers: {
          Authorization: api.defaults.headers.common.Authorization as string,
        },
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (!result) {
      logDebug('Publicacoes.download.empty', { id });
      return false;
    }

    const { uri, status, headers } = result;
    logDebug('Publicacoes.download.success', { uri, status, contentType: headers['content-type'] });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
      return true;
    } else {
      logDebug('Publicacoes.share.unavailable', { uri });
      return false;
    }
  } catch (error: any) {
    logDebug('Publicacoes.download.error', { message: error.message, status: error.response?.status });
    return false;
  }
};
