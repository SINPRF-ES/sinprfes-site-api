import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { fetchPublicacoes, downloadPublicacaoFile, DriveFile } from './driveService';
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
  error?: 'APP_FOLDER_NOT_FOUND' | 'MANIFEST_NOT_FOUND' | 'MANIFEST_DOWNLOAD_ERROR' | string;
}

/**
 * Resolve qual APK deve ser baixado com base na arquitetura do dispositivo.
 */
export const resolveApkForDevice = (
  manifest: UpdateManifest,
  availableFiles: DriveFile[]
): {
  apkFile?: DriveFile;
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

  const apkFile = availableFiles.find(f => f.name === expectedFileName);

  if (!apkFile) {
    logDebug('UpdateCheck.apk.resolve.notFound', {
      expectedFileName,
      availableFiles: availableFiles.map(f => f.name)
    });
    return { abi: chosenAbi, reason: 'APK_FILE_NOT_FOUND' };
  }

  logDebug('UpdateCheck.apk.resolve.success', {
    abi: chosenAbi,
    fileName: apkFile.name
  });

  return { apkFile, abi: chosenAbi };
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

      const { apkFile, abi, reason } = resolveApkForDevice(manifest, appFiles);

      if (!apkFile) {
        logDebug(`${logPrefix}.error`, { reason: reason || 'APK_FILE_NOT_FOUND' });
        return {
            hasUpdate: false,
            error: `APK não encontrado no Drive (${abi || 'desconhecido'}). Verifique a pasta App.`
        };
      }

      logDebug(`${logPrefix}.APK_REQUIRED`, { ...logMeta, isMandatory, abi, file: apkFile.name });

      return {
        hasUpdate: true,
        type: 'APK',
        isMandatory,
        manifest,
        apkFileId: apkFile.id,
        apkFileName: apkFile.name,
        apkAbi: abi
      };
    }

    // Verificação de OTA (Mudanças apenas de JS/UI)
    // O critério correto é compatibilidade de runtimeVersion, não versionCode.
    if (manifest.ota.enabled && manifest.runtimeVersion === currentRuntimeVersion) {
      try {
        logDebug(`${logPrefix}.checkingOTA`, {
          runtimeVersion: currentRuntimeVersion,
          channel: currentChannel,
          url: (Updates as any).updateUrl || 'N/A'
        });
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
        logDebug(`${logPrefix}.error`, { reason: 'OTA_CHECK_FAILED', message: e.message, stack: e.stack });
        // Se deu erro no serviço da Expo, reportamos para o usuário para transparência
        return {
          hasUpdate: false,
          error: `Erro no serviço Expo Updates: ${e.message}. Verifique a conexão ou se o app está em modo de desenvolvimento sem suporte a updates.`
        };
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
 * Baixa e instala o APK usando o backend autenticado e o IntentLauncher do Android.
 */
export const downloadAndInstallApk = async (fileId: string, fileName: string): Promise<void> => {
  const logPrefix = 'APK_UPDATE';
  try {
    logDebug(`${logPrefix}.click`, { fileId, fileName });

    // 1. Carregar sessão
    const sessao = await carregarSessao();
    if (!sessao?.token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    // 2. Baixar APK
    logDebug(`${logPrefix}.download.start`, { fileId, fileName });
    const { localUri } = await downloadPublicacaoFile(fileId, fileName, sessao.token);
    logDebug(`${logPrefix}.download.success`, { localUri });

    // 3. Converter para content URI (necessário para o instalador Android)
    const contentUri = await FileSystem.getContentUriAsync(localUri);
    logDebug(`${logPrefix}.install.intent_sent`, { contentUri });

    // 4. Abrir instalador Android
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });

  } catch (error: any) {
    logDebug(`${logPrefix}.error`, { message: error.message });
    throw error;
  }
};
