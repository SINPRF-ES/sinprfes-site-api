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

/**
 * Obtém a instância de autenticação do Google.
 * Prioriza a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON (produção/Render).
 * Fallback para o arquivo google.json (local/desenvolvimento), se existir.
 *
 * Importante: se nenhuma credencial for encontrada, NÃO usa ADC (default credentials).
 * Em vez disso, lança erro explícito (evita "Could not load the default credentials").
 */
function getGoogleAuth() {
  const authOptions = { scopes: SCOPES };

  const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (rawJson && rawJson.trim()) {
    try {
      // A env var deve conter o JSON completo do service account (string).
      authOptions.credentials = JSON.parse(rawJson);
      return new google.auth.GoogleAuth(authOptions);
    } catch (e) {
      log.error("GoogleDriveAuthJsonParseError", { error: e.message });
      // Cai para fallback local abaixo (se existir); caso contrário, erro explícito.
    }
  }

  if (fs.existsSync(KEY_PATH)) {
    authOptions.keyFile = KEY_PATH;
    return new google.auth.GoogleAuth(authOptions);
  }

  // Não permitir ADC no Render (isso gera erros de ambiente).
  throw new Error(
    "Google credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS_JSON (recommended for Render) or provide a local google.json (gitignored)."
  );
}

// 🟢 MUDANÇA: Aceita um ID opcional. Se não vier, usa o padrão do .env
async function listarArquivosPublicos(targetFolderId = null) {
  // Usa o ID passado ou o da raiz configurado no .env
  const folderId = targetFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
      log.warn("GoogleDriveFolderIdMissing", { targetFolderId });
      return [];
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.list({
      // Busca arquivos que tenham este folderId como pai
      q: `'${folderId}' in parents and trashed = false`,
      // Importante: mimeType é o que nos diz se é pasta ou arquivo
      fields: "files(id, name, webViewLink, webContentLink, createdTime, mimeType)",
      orderBy: "folder, createdTime desc", // Pastas primeiro, depois arquivos recentes
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
    // 1) Metadados
    const meta = await drive.files.get({
      fileId,
      fields: "name, mimeType, size",
    });

    // 2) Conteúdo (stream)
    const res = await drive.files.get(
      { fileId, alt: "media" },
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
  const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!targetFolderId) {
    log.warn("GoogleDriveUploadFolderIdMissing");
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name: name,
    parents: targetFolderId ? [targetFolderId] : [],
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
  const targetFolderId = parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const folderMetadata = {
    name: name,
    mimeType: FOLDER_MIMETYPE,
    parents: targetFolderId ? [targetFolderId] : []
  };

  try {
    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: "id, name, mimeType, createdTime"
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
      fields: "id, name, mimeType, createdTime"
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
      fields: "parents"
    });
    const previousParentsArr = file.data.parents || [];
    const previousParentsStr = previousParentsArr.join(",");

    // 2. Mover
    const res = await drive.files.update({
      fileId: fileId,
      addParents: targetFolderId,
      removeParents: previousParentsStr,
      fields: "id, name, mimeType, createdTime, parents"
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
 * "Exclui" um item movendo-o para a Lixeira oculta.
 */
async function deleteItem(fileId) {
  const trashId = await ensureTrashFolder();
  if (!trashId) {
    throw new Error("Pasta de lixeira não configurada ou inacessível.");
  }
  return await moveItem(fileId, trashId);
}

module.exports = {
  listarArquivosPublicos,
  obterArquivoStream,
  obterArquivoTexto,
  uploadFile,
  ensureTrashFolder,
  createFolder,
  renameItem,
  moveItem,
  deleteItem,
  getAppFolderId,
  getItem,
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
      fields: "id, name, mimeType, parents, createdTime"
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