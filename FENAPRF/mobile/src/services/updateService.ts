import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import axios from 'axios';
import api from './apiService';
import { fetchPublicacoes, downloadPublicacaoFile, DriveFile } from './driveService';
import { logDebug } from '../utils/userUtils';
import { carregarSessao } from './storageService';
import { enviarLogDiagnostico } from './diagnosticoService';
import { logger } from '../infra/logger';
import { APP_ID, API_BASE_URL, UPDATE_MANIFEST_URL } from '../config/env';
import { buildCacheDest, inferExtension } from '../utils/fileCacheUtils';

export interface UpdateManifest {
  versionCode: number;
  versionName: string;
  runtimeVersion: string;
  ota: {
    enabled: boolean;
    channel: string;
    notes: string;
  };
  apk: {
    enabled: boolean;
    minSupportedVersionCode: number;
    notes: string;
    fileName?: string; // LEGADO
    files?: Record<string, string>; // NOVO (por ABI, ex: {"arm64-v8a": "app-v2.apk"})
  };
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  type?: 'OTA' | 'APK';
  isMandatory?: boolean;
  manifest?: UpdateManifest;
  apkFileId?: string;
  apkFileName?: string;
  apkAbi?: string;
  apkUrl?: string; // NOVO: URL direta para download (isalação total)
  error?: 'APP_FOLDER_NOT_FOUND' | 'MANIFEST_NOT_FOUND' | 'MANIFEST_DOWNLOAD_ERROR' | string;
}

/**
 * Resolve qual APK deve ser baixado com base na arquitetura do dispositivo.
 */
export const resolveApkForDevice = (
  manifest: UpdateManifest,
  availableFiles?: DriveFile[]
): {
  apkFile?: DriveFile;
  fileName?: string;
  abi?: string;
  reason?: string;
} => {
  const supportedAbis = (Device.supportedCpuArchitectures as string[]) || [];
  let chosenAbi: string | undefined;
  let expectedFileName: string | undefined;

  logDebug('UpdateCheck.apk.resolve.start', {
    supportedAbis,
    hasFiles: !!manifest.apk.files,
    fileName: manifest.apk.fileName
  });

  if (manifest.apk.files && Object.keys(manifest.apk.files).length > 0) {
    // 1. Tentar ABIs suportadas pelo device na ordem de preferência do device
    chosenAbi = supportedAbis.find((abi: string) => manifest.apk.files![abi]);

    // 2. Fallback determinístico se não achou nada direto
    if (!chosenAbi) {
      if (manifest.apk.files['arm64-v8a']) chosenAbi = 'arm64-v8a';
      else if (manifest.apk.files['armeabi-v7a']) chosenAbi = 'armeabi-v7a';
    }

    if (chosenAbi) {
      expectedFileName = manifest.apk.files[chosenAbi];
    }
  } else {
    // Legado: usar fileName direto
    expectedFileName = manifest.apk.fileName;
    chosenAbi = 'universal/legacy';
  }

  if (!expectedFileName) {
    return { reason: 'APK_FILE_NOT_DEFINED_IN_MANIFEST' };
  }

  if (availableFiles) {
    const apkFile = availableFiles.find(f => f.name === expectedFileName);
    if (!apkFile) {
        logDebug('UpdateCheck.apk.resolve.notFound', {
          expectedFileName,
          availableFiles: availableFiles.map(f => f.name)
        });
        return { abi: chosenAbi, reason: 'APK_FILE_NOT_FOUND', fileName: expectedFileName };
    }
    return { apkFile, abi: chosenAbi, fileName: expectedFileName };
  }

  // Se não passamos availableFiles, retornamos apenas o nome do arquivo para download direto
  return { abi: chosenAbi, fileName: expectedFileName };
};

/**
 * Helper para reportar eventos do auto-check para o backend
 */
export const reportUpdateAutoCheck = async (event: string, meta: any = {}) => {
    const currentVersionCode = Application.nativeBuildVersion ? parseInt(Application.nativeBuildVersion, 10) : 0;
    const currentRuntimeVersion = Updates.runtimeVersion || '';
    const currentChannel = Updates.channel || '';

    await enviarLogDiagnostico({
        source: 'mobile',
        event: `UpdateAutoCheck.${event}`,
        meta: {
            ...meta,
            versionCode: currentVersionCode,
            runtimeVersion: currentRuntimeVersion,
            channel: currentChannel
        }
    });
};

/**
 * Verifica se há atualizações disponíveis consultando o manifesto
 * e comparando com a versão local do app.
 */
export const checkUpdates = async (context: 'auto' | 'manual' = 'manual'): Promise<UpdateCheckResult | null> => {
  const logPrefix = `UpdateCheck.${context}`;

  try {
    // Observabilidade: Log de início de ambiente
    logger.info('APP_ENV_START', { appId: APP_ID, apiBaseUrl: API_BASE_URL, manifestUrl: UPDATE_MANIFEST_URL });

    const sessao = await carregarSessao();
    if (!sessao?.token) return null;

    logDebug(`${logPrefix}.start`, {});

    // 1. Baixar o manifesto diretamente via URL (Isolação FENAPRF)
    let manifest: UpdateManifest;
    let fetchedFromUrl = false;
    let driveAppFiles: DriveFile[] = [];

    try {
      logger.info('UPDATE_MANIFEST_FETCH', { url: UPDATE_MANIFEST_URL, context });
      const response = await axios.get(UPDATE_MANIFEST_URL, { timeout: 10000 });
      manifest = response.data;
      fetchedFromUrl = true;

      const urlObj = new URL(UPDATE_MANIFEST_URL);
      logger.info('UPDATE_MANIFEST_FETCH_SUCCESS', { url: UPDATE_MANIFEST_URL, host: urlObj.host });
    } catch (e: any) {
      logger.warn('UpdateCheck: Tentando fallback para Google Drive após falha na URL direta', { message: e.message });

      const rootFiles = await fetchPublicacoes(null);
      const appFolder = rootFiles.find(f => f.isFolder && (f.name || '').trim().toLowerCase() === 'app');
      if (!appFolder) return { hasUpdate: false, error: 'Pasta "app" não encontrada no Drive.' };

      driveAppFiles = await fetchPublicacoes(appFolder.id);
      const manifestFile = driveAppFiles.find(f => (f.name || '').trim().toLowerCase() === 'update-manifest.json');
      if (!manifestFile) return { hasUpdate: false, error: 'update-manifest.json não encontrado no Drive.' };

      const { localUri } = await downloadPublicacaoFile(manifestFile.id, manifestFile.name, sessao.token);
      const manifestContent = await FileSystem.readAsStringAsync(localUri);
      manifest = JSON.parse(manifestContent);
    }

    // 2. Comparar versões
    const currentVersionCode = Application.nativeBuildVersion ? parseInt(Application.nativeBuildVersion, 10) : 0;
    const currentRuntimeVersion = Updates.runtimeVersion || '';
    const currentChannel = Updates.channel || '';

    const logMeta = {
      currentVersionCode,
      currentRuntimeVersion,
      currentChannel,
      manifestVersionCode: manifest.versionCode,
      manifestRuntimeVersion: manifest.runtimeVersion
    };

    // Verificação de APK (Mudanças Nativas: versionCode superior)
    // Nota: Ignoramos hasNewRuntime se o versionCode for igual para evitar loops de instalação
    const hasNewVersionCode = currentVersionCode < manifest.versionCode;
    const hasNewRuntime = !!(manifest.runtimeVersion && currentRuntimeVersion && manifest.runtimeVersion !== currentRuntimeVersion);

    if (manifest.apk.enabled && hasNewVersionCode) {
      const isMandatory = currentVersionCode < manifest.apk.minSupportedVersionCode;

      const { fileName, apkFile, abi, reason } = resolveApkForDevice(manifest, driveAppFiles.length > 0 ? driveAppFiles : undefined);

      if (!fileName && !apkFile) {
        logDebug(`${logPrefix}.error`, { reason: reason || 'APK_FILE_NOT_DEFINED' });
        return {
            hasUpdate: false,
            error: `APK não definido no manifesto para ${abi || 'desconhecido'}.`
        };
      }

      let apkUrl: string | undefined;
      let apkFileId: string | undefined;

      // Log de depuração com hasNewRuntime para rastro de auditoria
      logDebug(`${logPrefix}.APK_REQUIRED`, { ...logMeta, isMandatory, abi, fileName, apkUrl, apkFileId, hasNewRuntime });

      if (fetchedFromUrl) {
          // Se o manifesto veio da URL, tentamos o APK pela URL também
          apkUrl = UPDATE_MANIFEST_URL.replace('update-manifest.json', fileName!);
      } else if (apkFile) {
          // Se veio do Drive, usamos o ID do arquivo
          apkFileId = apkFile.id;
      }

      return {
        hasUpdate: true,
        type: 'APK',
        isMandatory,
        manifest,
        apkFileName: fileName || apkFile?.name,
        apkFileId,
        apkAbi: abi,
        apkUrl
      };
    }

    // Verificação de OTA (Mudanças apenas de JS/UI)
    if (manifest.ota.enabled && currentVersionCode === manifest.versionCode) {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          logDebug(`${logPrefix}.OTA_AVAILABLE`, logMeta);
          return {
            hasUpdate: true,
            type: 'OTA',
            isMandatory: false,
            manifest
          };
        }
      } catch (e: any) {
        logDebug(`${logPrefix}.error`, { reason: 'OTA_CHECK_FAILED', message: e.message });
      }
    }

    logDebug(`${logPrefix}.NO_UPDATE`, logMeta);
    return { hasUpdate: false };
  } catch (error: any) {
    logDebug(`${logPrefix}.error`, { message: error.message });
    return { hasUpdate: false, error: error.message };
  }
};

/**
 * Baixa e aplica a atualização OTA, reiniciando o app.
 */
export const applyOtaUpdate = async () => {
  try {
    logDebug('UpdateCheck.applyOta.start', {});
    await Updates.fetchUpdateAsync();
    logDebug('UpdateCheck.applyOta.success', {});
    await Updates.reloadAsync();
  } catch (error: any) {
    logDebug('UpdateCheck.applyOta.error', { message: error.message });
    throw error;
  }
};

/**
 * Baixa e instala o APK usando o host validado.
 */
export const downloadAndInstallApk = async (fileId: string, fileName: string, downloadUrl?: string): Promise<void> => {
  const logPrefix = 'APK_UPDATE';
  try {
    logDebug(`${logPrefix}.click`, { fileId, fileName, downloadUrl });

    // 1. Carregar sessão
    const sessao = await carregarSessao();
    if (!sessao?.token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    // 2. Definir e Validar URL de download (APK Safety)
    const finalUrl = downloadUrl || `${API_BASE_URL}/api/publicacoes/arquivo/${fileId}`;
    const urlObj = new URL(finalUrl);
    const expectedHost = new URL(API_BASE_URL).host;

    logger.info('APK_DOWNLOAD', { url: finalUrl, host: urlObj.host });

    if (urlObj.host !== expectedHost) {
        logger.error('APK_INSTALL_BLOCKED', undefined, {
            reason: 'APK_HOST_MISMATCH',
            expectedHost,
            gotHost: urlObj.host,
            url: finalUrl
        });
        throw new Error(`Segurança: O host do APK (${urlObj.host}) não é autorizado.`);
    }

    // 3. Baixar APK
    logDebug(`${logPrefix}.download.start`, { finalUrl, fileName });
    let localUri: string;
    let downloadResult: any;

    if (downloadUrl) {
        const extension = inferExtension(fileName);
        const dest = buildCacheDest({ prefix: 'apk_upd', id: 'latest', ext: extension });

        downloadResult = await FileSystem.downloadAsync(finalUrl, dest, {
            headers: {
                Authorization: `Bearer ${sessao.token}`
            }
        });

        localUri = downloadResult.uri;

        const contentType = downloadResult.headers['content-type'] || downloadResult.headers['Content-Type'];
        const contentLength = downloadResult.headers['content-length'] || downloadResult.headers['Content-Length'];

        logger.info('APK_DOWNLOAD_COMPLETE', {
            status: downloadResult.status,
            contentType,
            contentLength,
            uri: downloadResult.uri,
            finalUrl
        });

        if (downloadResult.status !== 200) {
            throw new Error(`Erro ao baixar APK: Servidor retornou status ${downloadResult.status}`);
        }

        if (contentType && contentType.includes('text/html')) {
            throw new Error('O download retornou uma página HTML em vez de um arquivo APK. Verifique sua conexão ou se o link expirou.');
        }
    } else {
        const result = await downloadPublicacaoFile(fileId, fileName, sessao.token);
        localUri = result.localUri;
        // Mock downloadResult para o bloco de métricas abaixo
        downloadResult = { status: 200, headers: { 'content-type': result.mimeType } };
    }

    // Diagnósticos Adicionais do Arquivo
    try {
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
            const firstBytesBase64 = await FileSystem.readAsStringAsync(localUri, {
                encoding: FileSystem.EncodingType.Base64,
                length: 16,
                position: 0
            });

            logger.info('APK_FILE_METRICS', {
                sizeBytes: fileInfo.size,
                firstBytesBase64,
                exists: fileInfo.exists
            });

            // Verificação básica de cabeçalho PK (APK é um ZIP)
            // PK em Base64 começa com UEs
            if (firstBytesBase64 && !firstBytesBase64.startsWith('UEs')) {
                logger.warn('APK_HEADER_WARNING', {
                    hint: 'O arquivo não parece ser um APK/ZIP válido (cabeçalho PK ausente).',
                    firstBytesBase64
                });
            }
        } else {
            logger.error('APK_FILE_NOT_FOUND_AFTER_DOWNLOAD', undefined, { localUri });
        }
    } catch (diagError: any) {
        logger.warn('APK_DIAGNOSTICS_FAILED', { message: diagError.message });
    }

    logDebug(`${logPrefix}.download.success`, { localUri });

    // 4. Converter para content URI (necessário para o instalador Android)
    const contentUri = await FileSystem.getContentUriAsync(localUri);
    logDebug(`${logPrefix}.install.intent_sent`, { contentUri });

    // 5. Abrir instalador Android
    try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/vnd.android.package-archive',
        });
    } catch (intentError: any) {
        logger.error('APK_INSTALL_INTENT_ERROR', intentError, {
            message: intentError.message,
            contentUri,
            hint: 'Falha ao abrir o instalador do sistema. Pode ser incompatibilidade de versão ou arquivo corrompido.'
        });
        throw new Error(`Falha ao iniciar instalação: ${intentError.message}`);
    }

  } catch (error: any) {
    logger.error('APK_UPDATE_ERROR', error, { message: error.message });
    throw error;
  }
};
