import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system/legacy';
import { fetchPublicacoes, downloadPublicacaoFile } from './driveService';
import { logDebug } from '../utils/filiadoUtils';
import { carregarSessao } from './storageService';
import { enviarLogDiagnostico } from './diagnosticoService';

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
    fileName: string;
    minSupportedVersionCode: number;
    notes: string;
  };
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  type?: 'OTA' | 'APK';
  isMandatory?: boolean;
  manifest?: UpdateManifest;
  apkUrl?: string;
  error?: 'APP_FOLDER_NOT_FOUND' | 'MANIFEST_NOT_FOUND' | 'MANIFEST_DOWNLOAD_ERROR' | string;
}

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
 * Verifica se há atualizações disponíveis consultando o manifesto no Google Drive
 * e comparando com a versão local do app.
 *
 * @param context 'auto' para verificações automáticas em background, 'manual' para disparos do usuário.
 */
export const checkUpdates = async (context: 'auto' | 'manual' = 'manual'): Promise<UpdateCheckResult | null> => {
  const logPrefix = `UpdateCheck.${context}`;

  try {
    const sessao = await carregarSessao();
    if (!sessao?.token) return null;

    logDebug(`${logPrefix}.start`, {});

    // 1. Localizar pasta 'App' na raiz das Publicações
    const rootFiles = await fetchPublicacoes(null);
    const appFolder = rootFiles.find(f => f.isFolder && (f.name || '').trim().toLowerCase() === 'app');
    if (!appFolder) {
      logDebug(`${logPrefix}.error`, { reason: 'APP_FOLDER_NOT_FOUND' });
      return { hasUpdate: false, error: 'Pasta App não encontrada no Drive.' };
    }

    // 2. Localizar 'update-manifest.json' e APK dentro da pasta 'App'
    const appFiles = await fetchPublicacoes(appFolder.id);
    const manifestFile = appFiles.find(f => (f.name || '').trim().toLowerCase() === 'update-manifest.json');

    if (!manifestFile) {
      logDebug(`${logPrefix}.error`, { reason: 'MANIFEST_NOT_FOUND' });
      return { hasUpdate: false, error: 'update-manifest.json não encontrado na pasta App.' };
    }

    // Validar MimeType para evitar Google Docs
    if (manifestFile.mimeType === 'application/vnd.google-apps.document') {
        logDebug(`${logPrefix}.error`, { reason: 'MANIFEST_IS_GOOGLE_DOC' });
        return {
            hasUpdate: false,
            error: 'O update-manifest.json está como Google Docs. Faça upload como arquivo JSON.'
        };
    }

    // 3. Baixar e ler o manifesto
    let manifest: UpdateManifest;
    try {
      const { localUri } = await downloadPublicacaoFile(manifestFile.id, manifestFile.name, sessao.token);
      const manifestContent = await FileSystem.readAsStringAsync(localUri);
      manifest = JSON.parse(manifestContent);

      logDebug(`${logPrefix}.manifestLoaded`, {
        versionCode: manifest.versionCode,
        runtimeVersion: manifest.runtimeVersion
      });
    } catch (e: any) {
      logDebug(`${logPrefix}.error`, { reason: 'MANIFEST_LOAD_FAILED', message: e.message });
      return { hasUpdate: false, error: `Falha ao carregar manifesto: ${e.message}` };
    }

    // 4. Comparar versões
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

    // Verificação de APK (Mudanças Nativas: runtimeVersion diferente OU versionCode superior)
    const hasNewRuntime = manifest.runtimeVersion !== currentRuntimeVersion;
    const hasNewVersionCode = currentVersionCode < manifest.versionCode;

    if (manifest.apk.enabled && (hasNewVersionCode || hasNewRuntime)) {
      const isMandatory = currentVersionCode < manifest.apk.minSupportedVersionCode || hasNewRuntime;
      const apkFile = appFiles.find(f => f.name === manifest.apk.fileName);

      logDebug(`${logPrefix}.APK_REQUIRED`, { ...logMeta, isMandatory });

      return {
        hasUpdate: true,
        type: 'APK',
        isMandatory,
        manifest,
        apkUrl: apkFile?.webViewLink || undefined
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
