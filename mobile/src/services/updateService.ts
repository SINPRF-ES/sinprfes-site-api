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
 */
export const checkUpdates = async (): Promise<UpdateCheckResult | null> => {
  try {
    const sessao = await carregarSessao();
    if (!sessao?.token) return null;

    logDebug('UpdateCheck.start', {});

    // 1. Localizar pasta 'App' na raiz das Publicações
    const rootFiles = await fetchPublicacoes(null);
    const appFolder = rootFiles.find(f => f.isFolder && (f.name || '').trim().toLowerCase() === 'app');
    if (!appFolder) {
      logDebug('UpdateCheck.step', { step: 'APP_FOLDER_NOT_FOUND' });
      return { hasUpdate: false, error: 'Pasta App não encontrada no Drive.' };
    }
    logDebug('UpdateCheck.step', { step: 'FOUND_APP_FOLDER', folderId: appFolder.id });

    // 2. Localizar 'update-manifest.json' e APK dentro da pasta 'App'
    const appFiles = await fetchPublicacoes(appFolder.id);
    logDebug('UpdateCheck.appFolderContents', {
        count: appFiles.length,
        items: appFiles.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType }))
    });

    const manifestFile = appFiles.find(f => (f.name || '').trim().toLowerCase() === 'update-manifest.json');
    if (!manifestFile) {
      logDebug('UpdateCheck.step', {
          step: 'MANIFEST_NOT_FOUND',
          availableNames: appFiles.map(f => f.name)
      });
      return { hasUpdate: false, error: 'update-manifest.json não encontrado na pasta App.' };
    }
    logDebug('UpdateCheck.step', {
        step: 'FOUND_MANIFEST',
        fileId: manifestFile.id,
        mimeType: manifestFile.mimeType,
        name: manifestFile.name
    });

    // Validar MimeType para evitar Google Docs
    if (manifestFile.mimeType === 'application/vnd.google-apps.document') {
        logDebug('UpdateCheck.step', { step: 'MANIFEST_IS_GOOGLE_DOC', fileId: manifestFile.id });
        return {
            hasUpdate: false,
            error: 'O update-manifest.json está como Google Docs. Faça upload como arquivo JSON (application/json) no Drive.'
        };
    }
    logDebug('UpdateCheck.MANIFEST_FOUND', { id: manifestFile.id });

    // 3. Baixar e ler o manifesto
    let manifest: UpdateManifest;
    try {
      logDebug('UpdateCheck.step', { step: 'DOWNLOADING_MANIFEST' });
      const { localUri } = await downloadPublicacaoFile(manifestFile.id, manifestFile.name, sessao.token);

      logDebug('UpdateCheck.step', {
        step: 'READING_MANIFEST',
        fileId: manifestFile.id,
        name: manifestFile.name,
        localUri
      });
      const manifestContent = await FileSystem.readAsStringAsync(localUri);

      try {
        manifest = JSON.parse(manifestContent);
      } catch (parseError: any) {
        logDebug('UpdateCheck.error', {
            reason: 'MANIFEST_PARSE_FAILED',
            message: parseError.message,
            stack: parseError.stack
        });
        return { hasUpdate: false, error: 'Erro ao processar JSON do manifesto.' };
      }

      logDebug('UpdateCheck.MANIFEST_DOWNLOADED', {
        size: manifestContent.length,
        versionCode: manifest.versionCode,
        runtimeVersion: manifest.runtimeVersion
      });
    } catch (e: any) {
      logDebug('UpdateCheck.error', {
          reason: 'MANIFEST_DOWNLOAD_FAILED',
          message: e.message,
          stack: e.stack
      });
      return { hasUpdate: false, error: `Falha no download: ${e.message}` };
    }

    // 4. Comparar versões
    const currentVersionCode = Application.nativeBuildVersion ? parseInt(Application.nativeBuildVersion, 10) : 0;
    const currentRuntimeVersion = Updates.runtimeVersion || '';
    const currentChannel = Updates.channel || '';

    logDebug('UpdateCheck.versions', {
      current: {
        versionCode: currentVersionCode,
        runtimeVersion: currentRuntimeVersion,
        channel: currentChannel
      },
      remote: { versionCode: manifest.versionCode, runtimeVersion: manifest.runtimeVersion }
    });

    // Verificação de APK (Mudanças Nativas: runtimeVersion diferente OU versionCode superior)
    const hasNewRuntime = manifest.runtimeVersion !== currentRuntimeVersion;
    const hasNewVersionCode = currentVersionCode < manifest.versionCode;

    if (manifest.apk.enabled && (hasNewVersionCode || hasNewRuntime)) {
      const isMandatory = currentVersionCode < manifest.apk.minSupportedVersionCode || hasNewRuntime;
      const apkFile = appFiles.find(f => f.name === manifest.apk.fileName);

      logDebug('UpdateCheck.apkAvailable', { isMandatory, currentVersionCode, targetVersionCode: manifest.versionCode, hasNewRuntime });

      return {
        hasUpdate: true,
        type: 'APK',
        isMandatory,
        manifest,
        apkUrl: apkFile?.webViewLink || undefined
      };
    }

    // Verificação de OTA (Mudanças apenas de JS/UI)
    // Só tentamos OTA se o versionCode for o mesmo (base nativa compatível)
    if (manifest.ota.enabled && currentVersionCode === manifest.versionCode) {
      try {
        const update = await Updates.checkForUpdateAsync();
        logDebug('UpdateCheck.OTA_CHECK_RESULT', { isAvailable: update.isAvailable });
        if (update.isAvailable) {
          return {
            hasUpdate: true,
            type: 'OTA',
            isMandatory: false,
            manifest
          };
        }
      } catch (e: any) {
        logDebug('UpdateCheck.OTA_CHECK_ERROR', { message: e.message });
      }
    }

    logDebug('UpdateCheck.noUpdateNeeded', {});
    return { hasUpdate: false };
  } catch (error: any) {
    logDebug('UpdateCheck.error', {
        message: error.message,
        stack: error.stack
    });
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
