// mobile/src/services/driveService.ts
import api from './apiService';
import { carregarSessao } from './storageService';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { logDebug } from '../utils/user';
import { buildCacheDest, inferExtension, ensureDownloadDir } from '../utils/fileCache';

export interface DriveFile {
  id: string;
  name: string;
  mimeType?: string | null;
  createdTime?: string | null;
  webViewLink?: string | null; // Manter para compatibilidade, mas não usar para downloads seguros
  isFolder: boolean;
  hidden?: boolean;
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
  logDebug('DriveService.fetchPublicacoes.start', { folderId });
  const { data } = await api.get(endpoint);

  if (!Array.isArray(data)) {
    logDebug('DriveService.fetchPublicacoes.notArray', { typeofData: typeof data });
    return [];
  }

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
 * Baixa um arquivo de publicação de forma autenticada.
 * @param fileId ID do arquivo no backend/Drive.
 * @param fileName Nome original do arquivo.
 * @param token Token JWT do membro.
 * @param mimeType MimeType sugerido vindo da listagem.
 */
export const downloadPublicacaoFile = async (
  fileId: string,
  fileName: string,
  token: string,
  mimeType?: string
): Promise<{ localUri: string; mimeType?: string }> => {
  const extension = inferExtension(fileName, mimeType);
  const localUri = buildCacheDest({ prefix: 'pub', id: fileId, ext: extension });
  const url = `${api.defaults.baseURL}/api/publicacoes/arquivo/${fileId}`;

  logDebug('Publicacoes.download.start', { fileId, fileName, localUri });

  try {
    // Garantir que o diretório de download existe
    await ensureDownloadDir();

    // Verificar se o arquivo já existe e tem conteúdo (cache sujo/vazio)
    const fileInfo = await FileSystemLegacy.getInfoAsync(localUri);
    if (fileInfo.exists && fileInfo.size === 0) {
        logDebug('Publicacoes.download.dirtyCacheDetected', { localUri });
        await FileSystemLegacy.deleteAsync(localUri, { idempotent: true });
    }

    const result = await FileSystemLegacy.downloadAsync(url, localUri, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const { status, headers: resHeaders, uri } = result;
    const contentType = resHeaders['content-type'] || resHeaders['Content-Type'] || '';

    logDebug('Publicacoes.download.success', { status, uri, contentType });

    if (status !== 200) {
      logDebug('Publicacoes.download.error', {
        status,
        contentType,
        reason: 'HTTP_STATUS_NOT_200'
      });
      throw new Error(`Erro no servidor (Status ${status})`);
    }

    // Validar se o arquivo baixado não é um erro JSON mascarado
    if (contentType.includes('application/json') && !fileName.endsWith('.json')) {
       logDebug('Publicacoes.download.error', { reason: 'RECEIVED_JSON_INSTEAD_OF_FILE' });
       throw new Error('O servidor retornou uma mensagem de erro em vez do arquivo.');
    }

    // Verificar se o arquivo final tem tamanho > 0
    const finalInfo = await FileSystemLegacy.getInfoAsync(uri);
    if (!finalInfo.exists || finalInfo.size === 0) {
        logDebug('Publicacoes.download.error', { reason: 'ZERO_BYTE_FILE' });
        throw new Error('O arquivo foi baixado mas está vazio.');
    }

    return { localUri: uri, mimeType: contentType };
  } catch (error: any) {
    logDebug('Publicacoes.download.error', { message: error.message });
    throw error;
  }
};

/**
 * Baixa um arquivo de publicação de forma segura e o abre (Legado/Compatibilidade).
 * @param file O objeto do arquivo a ser baixado.
 */
export const downloadPublicacao = async (file: DriveFile): Promise<boolean> => {
  try {
    const sessao = await carregarSessao();
    if (!sessao?.token) return false;

    const { localUri } = await downloadPublicacaoFile(file.id, file.name, sessao.token, file.mimeType || undefined);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localUri);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Cria uma nova pasta no Drive.
 */
export const createFolder = async (name: string, parentFolderId: string | null = null): Promise<any> => {
  const { data } = await api.post('/api/publicacoes/folders', { name, parentFolderId });
  return data;
};

/**
 * Realiza o upload de um arquivo para o Drive.
 */
export const uploadDriveFile = async (
  fileUri: string,
  fileName: string,
  mimeType: string,
  parentFolderId: string | null = null
): Promise<any> => {
  const formData = new FormData();

  // No React Native, FormData.append para arquivos requer um objeto específico
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  if (parentFolderId) {
    formData.append('parentFolderId', parentFolderId);
  }

  const { data } = await api.post('/api/publicacoes/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    // Importante para uploads grandes no axios/mobile
    transformRequest: (data) => data,
  });

  return data;
};

/**
 * Renomeia um item (arquivo ou pasta).
 */
export const renameItem = async (id: string, name: string): Promise<any> => {
  const { data } = await api.patch(`/api/publicacoes/items/${id}/rename`, { name });
  return data;
};

/**
 * Move um item para uma nova pasta.
 */
export const moveItem = async (id: string, targetFolderId: string): Promise<any> => {
  const { data } = await api.patch(`/api/publicacoes/items/${id}/move`, { targetFolderId });
  return data;
};

/**
 * Exclui um item (soft delete).
 */
export const deleteItem = async (id: string): Promise<any> => {
  const { data } = await api.post(`/api/publicacoes/items/${id}/delete`);
  return data;
};
