// mobile/src/utils/fileCacheUtils.ts
import * as FileSystem from 'expo-file-system/legacy';

export interface CacheDestOptions {
  prefix: string;
  id: string | number;
  ext: string;
}

/**
 * Inferencia robusta de extensao de arquivo.
 */
export function inferExtension(remoteUrl: string, contentType?: string, fallback: string = 'bin'): string {
  const cleanUrl = remoteUrl.split('?')[0];
  const urlExtension = cleanUrl.split('.').pop()?.toLowerCase();

  // 1. Se tem extensao conhecida na URL, usa
  if (urlExtension && ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx'].includes(urlExtension)) {
    return urlExtension;
  }

  // 2. Se e Cloudinary /raw/upload/, e provavel que seja PDF (especifico do nosso contexto de editais)
  if (cleanUrl.includes('/raw/upload/')) {
    return 'pdf';
  }

  // 3. Se temos contentType vindo do header
  if (contentType) {
    if (contentType.includes('application/pdf')) return 'pdf';
    if (contentType.includes('image/jpeg')) return 'jpg';
    if (contentType.includes('image/png')) return 'png';
    if (contentType.includes('image/webp')) return 'webp';
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
  return `${FileSystem.cacheDirectory}${prefix}_${safeId}.${ext}`;
}
