// src/services/drive.service.js
const { google } = require("googleapis");
const path = require("path");
const log = require("../utils/log");

const streamifier = require("streamifier");
const KEY_PATH = path.join(__dirname, "../../google.json");
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file"
];

// 🟢 MUDANÇA: Aceita um ID opcional. Se não vier, usa o padrão do .env
async function listarArquivosPublicos(targetFolderId = null) {
  // Usa o ID passado ou o da raiz configurado no .env
  const folderId = targetFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  
  if (!folderId) {
      log.warn("GoogleDriveFolderIdMissing", { targetFolderId });
      return []; 
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: SCOPES,
  });

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
// Adicione isso no final do arquivo src/services/drive.service.js

async function obterArquivoStream(fileId) {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: SCOPES,
  });

  const drive = google.drive({ version: "v3", auth });

  try {
    // 1. Pega os metadados para saber o tipo (PDF, Imagem, etc)
    const meta = await drive.files.get({
      fileId: fileId,
      fields: "name, mimeType, size"
    });

    // 2. Pega o conteúdo (stream)
    const res = await drive.files.get(
      { fileId: fileId, alt: "media" },
      { responseType: "stream" }
    );

    return { 
      stream: res.data, 
      mimeType: meta.data.mimeType,
      name: meta.data.name,
      size: meta.data.size
    };

  } catch (error) {
    log.error("GoogleDriveDownloadErro", { error: error.message, fileId });
    throw error;
  }
}

/**
 * Realiza o upload de um arquivo para o Google Drive.
 */
async function uploadFile(buffer, name, mimeType, folderId = null) {
  const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!targetFolderId) {
    log.warn("GoogleDriveUploadFolderIdMissing");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: SCOPES,
  });

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

// Não esqueça de adicionar na exportação:
module.exports = { listarArquivosPublicos, obterArquivoStream, uploadFile };