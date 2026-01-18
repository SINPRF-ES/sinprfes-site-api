// mobile/src/services/driveService.ts
import api from './apiService';
import { carregarSessao } from './storageService';
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
  // Campos para compatibilidade com formato do backend antigo/site
  titulo?: string;
  arquivo_url?: string;
  data_publicacao?: string;
  webContentLink?: string;
}

/**
 * Busca a lista de publicações (arquivos e pastas) do Google Drive.
 * @param folderId O ID da pasta a ser listada. Se nulo, lista a raiz.
 */
export const fetchPublicacoes = async (folderId: string | null = null): Promise<DriveFile[]> => {
  const endpoint = folderId ? `/api/publicacoes?folderId=${folderId}` : '/api/publicacoes';
  const { data } = await api.get(endpoint);

  // Mapeia a resposta para garantir robustez entre name/titulo, webViewLink/arquivo_url, etc.
  return data.map((item: any) => {
    const isFolder = item.isFolder ?? item.mimeType === 'application/vnd.google-apps.folder';
    return {
      ...item,
      name: item.name || item.titulo || 'Sem nome',
      webViewLink: item.webViewLink || item.arquivo_url,
      createdTime: item.createdTime || item.data_publicacao,
      isFolder: isFolder,
    };
  });
};

/**
 * Baixa um arquivo de publicação de forma segura e o abre.
 * @param file O objeto do arquivo a ser baixado.
 */
export const downloadPublicacao = async (file: DriveFile): Promise<boolean> => {
  const { id } = file;
  const name = file.name || 'arquivo_sem_nome';
  // Use um nome de arquivo sanitizado para o cache
  const safeName = name.replace(/[^a-zA-Z0-9.-_]/g, '');
  const localUri = `${FileSystem.cacheDirectory}${safeName}`;

  try {
    logDebug('Publicacoes.download.start', { id, localUri });

    // Obter o token da sessão para o download direto via FileSystem
    const sessao = await carregarSessao();
    const headers: Record<string, string> = {};
    if (sessao?.token) {
      headers.Authorization = `Bearer ${sessao.token}`;
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      `${api.defaults.baseURL}/api/publicacoes/arquivo/${id}`,
      localUri,
      { headers }
    );

    const result = await downloadResumable.downloadAsync();

    if (!result) {
      logDebug('Publicacoes.download.empty', { id });
      return false;
    }

    const { uri, status, headers: resHeaders } = result;
    const contentType = resHeaders['content-type'] || resHeaders['Content-Type'] || '';

    logDebug('Publicacoes.download.response', {
      uri,
      status,
      contentType,
      contentDisposition: resHeaders['content-disposition'] || resHeaders['Content-Disposition'],
      contentLength: resHeaders['content-length'] || resHeaders['Content-Length']
    });

    // Se o status não for sucesso ou se retornar um JSON (geralmente erro do backend)
    if (status >= 400 || contentType.includes('application/json')) {
      logDebug('Publicacoes.download.error', {
        reason: 'backend_error',
        status,
        contentType
      });
      return false;
    }

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
