// src/services/drive.service.js
const { google } = require("googleapis");
const streamifier = require("streamifier");
const log = require("../utils/log");

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
 * Resolve credenciais de service account via variáveis de ambiente.
 * Ordem de prioridade:
 * 1) GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 (preferencial)
 * 2) GOOGLE_SERVICE_ACCOUNT_JSON (compatibilidade)
 */
function parseGoogleServiceAccountCredentials() {
  const base64Value = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const plainJsonValue = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (base64Value && base64Value.trim()) {
    try {
      const decoded = Buffer.from(base64Value, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error(
        "Invalid GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: expected a valid base64-encoded service account JSON."
      );
    }
  }

  if (plainJsonValue && plainJsonValue.trim()) {
    try {
      return JSON.parse(plainJsonValue);
    } catch (error) {
      throw new Error(
        "Invalid GOOGLE_SERVICE_ACCOUNT_JSON: expected a valid service account JSON string."
      );
    }
  }

  return null;
}

function getGoogleAuth() {
  const credentials = parseGoogleServiceAccountCredentials();

  if (!credentials) {
    throw new Error(
      "Google credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 (preferred) or GOOGLE_SERVICE_ACCOUNT_JSON."
    );
  }

  return new google.auth.GoogleAuth({
    scopes: SCOPES,
    credentials,
  });
}

function validateGoogleCredentialsForBoot(required = false) {
  if (!required) return;

  parseGoogleServiceAccountCredentials();
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
  validateGoogleCredentialsForBoot,
};
