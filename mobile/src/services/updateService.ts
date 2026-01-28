import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system';
import { fetchPublicacoes, downloadPublicacaoFile } from './driveService';
import { logDebug } from '../utils/filiadoUtils';
import { carregarSessao } from './storageService';

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
  type: 'OTA' | 'APK';
  isMandatory: boolean;
  manifest: UpdateManifest;
  apkUrl?: string;
}

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
    const appFolder = rootFiles.find(f => f.isFolder && f.name.toLowerCase() === 'app');
    if (!appFolder) {
      logDebug('UpdateCheck.error', { reason: 'APP_FOLDER_NOT_FOUND' });
      return null;
    }

    // 2. Localizar 'update-manifest.json' e APK dentro da pasta 'App'
    const appFiles = await fetchPublicacoes(appFolder.id);
    const manifestFile = appFiles.find(f => f.name === 'update-manifest.json');
    if (!manifestFile) {
      logDebug('UpdateCheck.error', { reason: 'MANIFEST_NOT_FOUND' });
      return null;
    }

    // 3. Baixar e ler o manifesto
    const { localUri } = await downloadPublicacaoFile(manifestFile.id, manifestFile.name, sessao.token);
    const manifestContent = await FileSystem.readAsStringAsync(localUri);
    const manifest: UpdateManifest = JSON.parse(manifestContent);

    logDebug('UpdateCheck.manifestLoaded', manifest);

    // 4. Comparar versões
    const currentVersionCode = Application.nativeBuildVersion ? parseInt(Application.nativeBuildVersion, 10) : 0;
    const currentRuntimeVersion = Updates.runtimeVersion || '';

    logDebug('UpdateCheck.versions', {
      current: { versionCode: currentVersionCode, runtimeVersion: currentRuntimeVersion },
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
        if (update.isAvailable) {
          logDebug('UpdateCheck.otaAvailable', {});
          return {
            hasUpdate: true,
            type: 'OTA',
            isMandatory: false,
            manifest
          };
        }
      } catch (e: any) {
        logDebug('UpdateCheck.otaCheckSkipped', { message: e.message });
      }
    }

    logDebug('UpdateCheck.noUpdateNeeded', {});
    return null;
  } catch (error: any) {
    logDebug('UpdateCheck.error', { message: error.message });
    return null;
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
