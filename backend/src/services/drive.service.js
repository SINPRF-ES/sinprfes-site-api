// src/services/drive.service.js
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const streamifier = require("streamifier");
const log = require("../utils/log");

// Fallback local (apenas dev). NÃO comitar google.json.
const KEY_PATH = path.join(__dirname, "../../google.json");

// Scopes: readonly para listar/baixar + drive.file para upload (caso você use upload)
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

function safeGoogleErrorDetails(error) {
  // Evita logar conteúdo sensível; mas traz informação suficiente para diagnosticar.
  const status = error?.response?.status;
  const data = error?.response?.data;

  return {
    message: error?.message,
    code: error?.code,
    status,
    // Data da API do Google normalmente não contém segredos, mas pode ser grande.
    // Mantemos, pois é essencial para ver invalid_grant / insufficientPermissions etc.
    responseData: data,
  };
}

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
      // O campo private_key precisa estar com \n (como no arquivo original do Google).
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

  // Não permitir ADC no Render (isso gera exatamente o erro que você viu).
  throw new Error(
    "Google credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS_JSON (recommended for Render) or provide a local google.json (gitignored)."
  );
}

// 🟢 Aceita um ID opcional. Se não vier, usa o padrão do .env
async function listarArquivosPublicos(targetFolderId = null) {
  const folderId = targetFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    log.warn("GoogleDriveFolderIdMissing", { targetFolderId });
    return [];
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, webViewLink, webContentLink, createdTime, mimeType)",
      orderBy: "folder, createdTime desc",
      pageSize: 100,
    });

    return res.data.files || [];
  } catch (error) {
    log.error("GoogleDriveListarErro", {
      ...safeGoogleErrorDetails(error),
      folderId,
    });
    throw error;
  }
}

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
      ...safeGoogleErrorDetails(error),
      fileId,
    });
    throw error;
  }
}

/**
 * Obtém um arquivo como texto (útil para leitura de conteúdo simples).
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

/**
 * Realiza o upload de um arquivo para o Google Drive.
 */
async function uploadFile(buffer, name, mimeType, folderId = null) {
  const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!targetFolderId) {
    log.warn("GoogleDriveUploadFolderIdMissing");
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name,
    parents: targetFolderId ? [targetFolderId] : [],
  };

  const media = {
    mimeType,
    body: streamifier.createReadStream(buffer),
  };

  try {
    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id",
    });

    return file.data.id;
  } catch (error) {
    log.error("GoogleDriveUploadErro", {
      ...safeGoogleErrorDetails(error),
      filename: name,
      folderId: targetFolderId,
    });
    throw error;
  }
}

module.exports = {
  listarArquivosPublicos,
  obterArquivoStream,
  obterArquivoTexto,
  uploadFile,
};
