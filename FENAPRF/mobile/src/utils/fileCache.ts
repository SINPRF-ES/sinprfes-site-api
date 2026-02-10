// mobile/src/utils/fileCache.ts
import * as FileSystem from 'expo-file-system/legacy';

export interface CacheDestOptions {
  prefix: string;
  id: string | number;
  ext: string;
}

/**
 * Inferencia robusta de extensao de arquivo.
 * Prioriza contentType para garantir que PDFs sem extensao no nome sejam salvos corretamente.
 */
export function inferExtension(remoteUrl: string, contentType?: string, fallback: string = 'bin'): string {
  // 1. Se temos contentType vindo do header ou listagem, ele é a fonte mais confiável
  if (contentType) {
    if (contentType.includes('application/pdf')) return 'pdf';
    if (contentType.includes('image/jpeg')) return 'jpg';
    if (contentType.includes('image/png')) return 'png';
    if (contentType.includes('image/webp')) return 'webp';
  }

  const cleanUrl = remoteUrl.split('?')[0];
  const urlExtension = cleanUrl.split('.').pop()?.toLowerCase();

  // 2. Se tem extensao conhecida na URL, usa
  if (urlExtension && ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'apk'].includes(urlExtension)) {
    return urlExtension;
  }

  // 3. Se e Cloudinary /raw/upload/, e provavel que seja PDF (especifico do nosso contexto de editais)
  if (cleanUrl.includes('/raw/upload/')) {
    return 'pdf';
  }

  return fallback;
}

/**
 * Monta o caminho de destino no cache de forma segura.
 * NUNCA deve incluir partes da URL remota no path local.
 */
export function buildCacheDest({ prefix, id, ext }: CacheDestOptions): string {
  // Sanitiza ID para evitar caracteres invalidos de path
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  // Usamos um subdiretório para facilitar a gestão e cumprir requisitos de diretório
  return `${FileSystem.cacheDirectory}downloads/${prefix}_${safeId}.${ext}`;
}

/**
 * Garante que o diretório de destino existe.
 */
export async function ensureDownloadDir(): Promise<void> {
  const dir = `${FileSystem.cacheDirectory}downloads/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}
