// src/services/drive.service.js
const { google } = require("googleapis");
const path = require("path");
const log = require("../utils/log");

const streamifier = require("streamifier");
const fs = require("fs");
const KEY_PATH = path.join(__dirname, "../../google.json");
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file"
];

let driveAuthMode = null;

/**
 * Obtém a instância de autenticação do Google.
 * Ordem de prioridade:
 * 1. OAuth2 (Refresh Token) - Recomendado para contas comuns (@gmail) para evitar problemas de quota.
 * 2. Service Account (JWT) via GOOGLE_APPLICATION_CREDENTIALS_JSON.
 * 3. Fallback para arquivo google.json local.
 */
function getAuthMode() {
  return driveAuthMode;
}

function getGoogleAuth() {
  const authOptions = { scopes: SCOPES };

  // 1. Tentar OAuth2 (User context)
  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    if (!driveAuthMode) {
      log.info("DriveServiceAuth", { mode: "oauth", rootId: process.env.GOOGLE_DRIVE_FOLDER_ID });
      driveAuthMode = "oauth";
    }
    const oauth2Client = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
    oauth2Client.setCredentials({ refresh_token: oauthRefreshToken });
    return oauth2Client;
  }

  // 2. Tentar Service Account (JSON string)
  const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (rawJson && rawJson.trim()) {
    try {
      if (!driveAuthMode) {
        log.info("DriveServiceAuth", { mode: "service_account", rootId: process.env.GOOGLE_DRIVE_FOLDER_ID });
        driveAuthMode = "service_account";
      }
      authOptions.credentials = JSON.parse(rawJson);
      return new google.auth.GoogleAuth(authOptions);
    } catch (e) {
      log.error("GoogleDriveAuthJsonParseError", { error: e.message });
    }
  }

  // 3. Tentar arquivo local
  if (fs.existsSync(KEY_PATH)) {
    if (!driveAuthMode) {
      log.info("DriveServiceAuth", { mode: "local_json", rootId: process.env.GOOGLE_DRIVE_FOLDER_ID });
      driveAuthMode = "local_json";
    }
    authOptions.keyFile = KEY_PATH;
    return new google.auth.GoogleAuth(authOptions);
  }

  throw new Error(
    "Google credentials not configured. Provide GOOGLE_OAUTH_* env vars or GOOGLE_APPLICATION_CREDENTIALS_JSON."
  );
}

// Flags padrão para suporte a Shared Drives e compatibilidade estendida
const DRIVE_OP_FLAGS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true
};

async function listarArquivosPublicos(targetFolderId = null) {
  const folderId = targetFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId || folderId === 'ROOT') {
      log.warn("GoogleDriveFolderIdMissing", { targetFolderId });
      return [];
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.list({
      ...DRIVE_OP_FLAGS,
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, webViewLink, webContentLink, createdTime, mimeType)",
      orderBy: "folder, createdTime desc",
      pageSize: 100
    });

    return res.data.files || [];
  } catch (error) {
    log.error("GoogleDriveListarErro", { error: error.message });
    throw error;
  }
}

/**
 * Obtém o stream do arquivo e seus metadados diretamente do Google Drive.
 */
async function obterArquivoStream(fileId) {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    const meta = await drive.files.get({
      fileId,
      fields: "name, mimeType, size",
      supportsAllDrives: true
    });

    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" }
    );

    return {
      stream: res.data,
      mimeType: meta.data.mimeType,
      name: meta.data.name,
      size: meta.data.size,
    };
  } catch (error) {
    log.error("GoogleDriveDownloadErro", {
      message: error.message,
      fileId,
    });
    throw error;
  }
}

/**
 * Realiza o upload de um arquivo para o Google Drive.
 */
async function obterArquivoTexto(fileId) {
  const { stream } = await obterArquivoStream(fileId);
  return new Promise((resolve, reject) => {
    let data = "";
    stream.on("data", (chunk) => (data += chunk));
    stream.on("end", () => resolve(data));
    stream.on("error", (err) => reject(err));
  });
}

async function uploadFile(buffer, name, mimeType, folderId = null) {
  let targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (targetFolderId === 'ROOT') targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!targetFolderId) {
    throw new Error("Configuração inválida: GOOGLE_DRIVE_FOLDER_ID ausente.");
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name: name,
    parents: [targetFolderId],
  };

  const media = {
    mimeType: mimeType,
    body: streamifier.createReadStream(buffer),
  };

  try {
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
      supportsAllDrives: true
    });
    return file.data.id;
  } catch (error) {
    log.error("GoogleDriveUploadErro", { error: error.message, filename: name });
    throw error;
  }
}

const FOLDER_MIMETYPE = "application/vnd.google-apps.folder";
let TRASH_FOLDER_ID = null;

/**
 * Garante que a pasta "Lixeira" existe dentro da raiz.
 */
async function ensureTrashFolder() {
  if (TRASH_FOLDER_ID) return TRASH_FOLDER_ID;

  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootId) return null;

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    // Buscar se já existe
    const res = await drive.files.list({
      q: `'${rootId}' in parents and name = 'Lixeira' and mimeType = '${FOLDER_MIMETYPE}' and trashed = false`,
      fields: "files(id)",
      pageSize: 1
    });

    if (res.data.files && res.data.files.length > 0) {
      TRASH_FOLDER_ID = res.data.files[0].id;
      return TRASH_FOLDER_ID;
    }

    // Criar se não existir
    const folderMetadata = {
      name: "Lixeira",
      mimeType: FOLDER_MIMETYPE,
      parents: [rootId]
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: "id"
    });

    TRASH_FOLDER_ID = folder.data.id;
    return TRASH_FOLDER_ID;
  } catch (error) {
    log.error("GoogleDriveEnsureTrashErro", { error: error.message });
    return null;
  }
}

/**
 * Cria uma nova pasta no Drive.
 */
async function createFolder(name, parentFolderId = null) {
  let targetFolderId = parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (targetFolderId === 'ROOT') targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!targetFolderId) {
    throw new Error("Configuração inválida: GOOGLE_DRIVE_FOLDER_ID ausente.");
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const folderMetadata = {
    name: name,
    mimeType: FOLDER_MIMETYPE,
    parents: [targetFolderId]
  };

  try {
    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: "id, name, mimeType, createdTime",
      supportsAllDrives: true
    });
    return folder.data;
  } catch (error) {
    log.error("GoogleDriveCreateFolderErro", { error: error.message, name });
    throw error;
  }
}

/**
 * Renomeia um item (arquivo ou pasta).
 */
async function renameItem(fileId, newName) {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.update({
      fileId: fileId,
      requestBody: { name: newName },
      fields: "id, name, mimeType, createdTime",
      supportsAllDrives: true
    });
    return res.data;
  } catch (error) {
    log.error("GoogleDriveRenameErro", { error: error.message, fileId });
    throw error;
  }
}

/**
 * Move um item para uma nova pasta.
 */
async function moveItem(fileId, targetFolderId) {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    // 1. Pegar os pais atuais para remover
    const file = await drive.files.get({
      fileId: fileId,
      fields: "parents",
      supportsAllDrives: true
    });
    const previousParentsArr = file.data.parents || [];
    const previousParentsStr = previousParentsArr.join(",");

    // 2. Mover
    const res = await drive.files.update({
      fileId: fileId,
      addParents: targetFolderId,
      removeParents: previousParentsStr,
      fields: "id, name, mimeType, createdTime, parents",
      supportsAllDrives: true
    });

    return {
      ...res.data,
      oldParentId: previousParentsArr[0] || null // Para auditoria
    };
  } catch (error) {
    log.error("GoogleDriveMoveErro", { error: error.message, fileId, targetFolderId });
    throw error;
  }
}

/**
 * Move um arquivo para uma pasta específica de lixeira.
 */
async function moveToTrash(fileId, trashFolderId) {
  return await moveItem(fileId, trashFolderId);
}

/**
 * "Exclui" um item movendo-o para a Lixeira oculta.
 */
async function deleteItem(fileId) {
  const trashId = await ensureTrashFolder();
  if (!trashId) {
    throw new Error("Pasta de lixeira não configurada ou inacessível.");
  }
  return await moveToTrash(fileId, trashId);
}

module.exports = {
  getAuthMode,
  listarArquivosPublicos,
  obterArquivoStream,
  obterArquivoTexto,
  uploadFile,
  ensureTrashFolder,
  moveToTrash,
  createFolder,
  renameItem,
  moveItem,
  deleteItem,
  getAppFolderId,
  getItem,
  isDescendant,
  FOLDER_MIMETYPE
};

/**
 * Obtém metadados de um item.
 */
async function getItem(fileId) {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.get({
      fileId: fileId,
      fields: "id, name, mimeType, parents, createdTime",
      supportsAllDrives: true
    });
    return res.data;
  } catch (error) {
    log.error("GoogleDriveGetItemErro", { error: error.message, fileId });
    throw error;
  }
}

/**
 * Obtém o ID da pasta "App" se ela existir na raiz.
 */
async function getAppFolderId() {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootId) return null;

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.list({
      q: `'${rootId}' in parents and name = 'App' and mimeType = '${FOLDER_MIMETYPE}' and trashed = false`,
      fields: "files(id)",
      pageSize: 1
    });

    return res.data.files?.[0]?.id || null;
  } catch (error) {
    return null;
  }
}

/**
 * Verifica se o item (fileId) é descendente do ancestral (potentialAncestorId).
 * Útil para evitar ciclos ao mover pastas.
 */
async function isDescendant(fileId, potentialAncestorId) {
  if (!fileId || !potentialAncestorId) return false;
  if (fileId === potentialAncestorId) return true;

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    let currentId = fileId;
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // Subir na hierarquia até encontrar o ancestral ou chegar na raiz
    // Limitamos a 10 níveis para evitar loops infinitos
    for (let i = 0; i < 10; i++) {
      const res = await drive.files.get({
        fileId: currentId,
        fields: "parents",
        supportsAllDrives: true
      });

      const parents = res.data.parents || [];
      if (parents.length === 0) break;

      if (parents.includes(potentialAncestorId)) return true;

      // Se chegamos na raiz e não era o ancestral, paramos
      if (parents.includes(rootId)) break;

      // Continuamos subindo (assume o primeiro pai)
      currentId = parents[0];
    }
  } catch (error) {
    log.error("GoogleDriveIsDescendantErro", { error: error.message, fileId, potentialAncestorId });
  }

  return false;
}