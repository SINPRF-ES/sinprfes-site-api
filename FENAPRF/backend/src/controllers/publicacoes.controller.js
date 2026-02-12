// src/controllers/publicacoes.controller.js
const {
  getAuthMode,
  listarArquivosPublicos,
  obterArquivoStream,
  createFolder,
  uploadFile,
  renameItem,
  moveItem,
  deleteItem,
  getAppFolderId,
  ensureTrashFolder,
  FOLDER_MIMETYPE,
  getItem
} = require("../services/drive.service");
const log = require("../utils/log");
const { normalizePerfil } = require("../../shared/canon");

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

/**
 * Mapeia erros do Google Drive para respostas HTTP padronizadas.
 */
function mapGoogleDriveError(err, requestId) {
  const googleStatus = err.response?.status || err.code;
  const googleMsg = err.message || "";

  let status = 500;
  let message = "Erro interno ao processar arquivos.";

  if (googleStatus === 401) {
    status = 401;
    message = "Acesso expirado ou inválido ao Drive.";
  } else if (googleStatus === 403) {
    status = 403;
    message = googleMsg.includes("quota") ? "Quota de armazenamento do Drive excedida." : "Permissão negada no Drive.";
  } else if (googleStatus === 404) {
    status = 404;
    message = "Arquivo ou pasta não encontrado no Drive.";
  } else if (googleStatus === 400) {
    status = 400;
    message = "Parâmetros inválidos para o Google Drive.";
  }

  return { status, message, requestId };
}

/**
 * Verifica se o perfil tem permissão de gestão.
 */
function isGestao(perfil) {
  const p = normalizePerfil(perfil);
  return ["ADMIN", "COLABORADOR", "DIRETORIA"].includes(p);
}

exports.listar = async (req, res) => {
  try {
    const folderId = req.query.folderId || ROOT_FOLDER_ID;

    // Busca os arquivos (passando o ID se houver)
    const arquivos = await listarArquivosPublicos(folderId);

    const publicacoes = arquivos.map(file => {
      const nomeUpper = file.name.toUpperCase();
      let tipo = "OUTROS";

      // 🟢 O SEGREDO ESTÁ AQUI: Identificar corretamente a pasta pelo MimeType
      const isFolder = file.mimeType === FOLDER_MIMETYPE;

      if (isFolder) {
          tipo = "PASTA";
      } else {
          // Lógica de cores para arquivos
          if (nomeUpper.includes("ATA")) tipo = "ATA";
          else if (nomeUpper.includes("NOTA") || nomeUpper.includes("COMUNICADO")) tipo = "NOTA";
          else if (nomeUpper.includes("BALANÇO") || nomeUpper.includes("BALANCO")) tipo = "BALANCO";
      }

      // 🛑 Ocultar pastas técnicas na raiz
      const isHidden = (folderId === ROOT_FOLDER_ID) && (file.name === "App" || file.name === "Lixeira");

      return {
        id: file.id,
        titulo: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        tipo: tipo,
        // Envia essa flag explicitamente
        isFolder: isFolder,
        hidden: isHidden, // Flag para o app filtrar
        descricao: isFolder ? "Pasta de documentos" : "Documento oficial.",
        arquivo_url: file.webViewLink,
        data_publicacao: file.createdTime,
        // Novos campos para o mobile (contrato expandido)
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink,
        webContentLink: file.webContentLink,
        createdTime: file.createdTime
      };
    });

    return res.json(publicacoes);
  } catch (err) {
    log.error("ErroListarDrive", { error: err.message, stack: err.stack, requestId: req.requestId });
    return res.status(500).json({ message: "Erro ao sincronizar com o Drive.", requestId: req.requestId });
  }
};

/**
 * POST /api/publicacoes/folders
 */
exports.createFolder = async (req, res) => {
  let { parentFolderId, name } = req.body;

  // Normalização: Se não vier ou for null, assume a raiz do módulo
  if (!parentFolderId || parentFolderId === 'ROOT') {
    parentFolderId = ROOT_FOLDER_ID;
  }

  if (!parentFolderId) {
    log.error("ConfigErroDrive", { message: "Configuração inválida: GOOGLE_DRIVE_FOLDER_ID ausente.", requestId: req.requestId });
    return res.status(500).json({ message: "Erro de configuração no servidor: Pasta raiz não definida.", requestId: req.requestId });
  }

  const atorId = req.user?.id;
  const perfilAtor = req.user?.perfil_acesso;

  if (!isGestao(perfilAtor)) {
    return res.status(403).json({ message: "Permissão insuficiente para criar pastas." });
  }

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ message: "Nome da pasta é obrigatório." });
  }

  const cleanName = name.trim().substring(0, 80);

  // Bloquear nomes reservados na raiz
  if (parentFolderId === ROOT_FOLDER_ID && ["App", "Lixeira"].includes(cleanName)) {
    return res.status(400).json({ message: "Nome de pasta reservado." });
  }

  try {
    const [trashId, appId] = await Promise.all([ensureTrashFolder(), getAppFolderId()]);

    // Validação estrita contra pastas de sistema
    if (parentFolderId === trashId || parentFolderId === appId) {
      log.warn("PublicacoesCreateFolderDenied", { parentFolderId, trashId, appId, requestId: req.requestId });
      return res.status(409).json({ message: "Não é permitido criar pastas aqui." });
    }

    const folder = await createFolder(cleanName, parentFolderId);

    log.info("DriveCreateFolder", {
      userId: atorId,
      atorId,
      folderId: folder.id,
      folderName: folder.name,
      parentFolderId: parentFolderId,
      requestId: req.requestId,
      authMode: getAuthMode()
    });

    return res.json({ success: true, folder });
  } catch (error) {
    log.error("ErroCreateFolder", { error: error.message, stack: error.stack, userId: atorId, requestId: req.requestId });
    const { status, message } = mapGoogleDriveError(error, req.requestId);
    return res.status(status).json({ message, requestId: req.requestId });
  }
};

/**
 * POST /api/publicacoes/upload
 */
exports.uploadFile = async (req, res) => {
  let { parentFolderId, name } = req.body;

  // Normalização: Se não vier ou for null, assume a raiz do módulo
  if (!parentFolderId || parentFolderId === 'ROOT') {
    parentFolderId = ROOT_FOLDER_ID;
  }

  if (!parentFolderId) {
    log.error("ConfigErroDriveUpload", { message: "Configuração inválida: GOOGLE_DRIVE_FOLDER_ID ausente.", requestId: req.requestId });
    return res.status(500).json({ message: "Erro de configuração no servidor: Pasta raiz não definida.", requestId: req.requestId });
  }

  const file = req.file;
  const atorId = req.user?.id;
  const perfilAtor = req.user?.perfil_acesso;

  if (!isGestao(perfilAtor)) {
    return res.status(403).json({ message: "Permissão insuficiente para upload." });
  }

  if (!file) {
    log.warn("PublicacoesUploadMissingFile", { requestId: req.requestId });
    return res.status(400).json({ message: "Arquivo não enviado." });
  }

  // Validação de tipo: PDF e Imagens
  const allowedMimes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!allowedMimes.includes(file.mimetype)) {
    log.warn("PublicacoesUploadInvalidMime", { mimetype: file.mimetype, requestId: req.requestId });
    return res.status(400).json({ message: "Tipo de arquivo não permitido. Use PDF ou Imagens." });
  }

  const fileName = (name || file.originalname).trim();

  try {
    const [trashId, appId] = await Promise.all([ensureTrashFolder(), getAppFolderId()]);

    if (parentFolderId === trashId || parentFolderId === appId) {
      log.warn("PublicacoesUploadDenied", { parentFolderId, trashId, appId, requestId: req.requestId });
      return res.status(409).json({ message: "Não é permitido upload nesta pasta." });
    }

    const fileId = await uploadFile(file.buffer, fileName, file.mimetype, parentFolderId);

    log.info("DriveUploadFile", {
      userId: atorId,
      atorId,
      fileId,
      fileName: fileName,
      parentFolderId: parentFolderId,
      requestId: req.requestId,
      authMode: getAuthMode()
    });

    return res.json({
      success: true,
      file: { id: fileId, name: fileName, mimeType: file.mimetype, createdTime: new Date().toISOString() }
    });
  } catch (error) {
    log.error("ErroUploadFile", {
      error: error.message,
      stack: error.stack,
      userId: atorId,
      parentFolderId,
      requestId: req.requestId
    });
    const { status, message } = mapGoogleDriveError(error, req.requestId);
    return res.status(status).json({ message, requestId: req.requestId });
  }
};

/**
 * PATCH /api/publicacoes/items/:id/rename
 */
exports.renameItem = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const atorId = req.user?.id;
  const perfilAtor = req.user?.perfil_acesso;

  if (!isGestao(perfilAtor)) {
    return res.status(403).json({ message: "Permissão insuficiente para renomear itens." });
  }

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ message: "Novo nome é obrigatório." });
  }

  try {
    const [trashId, appId] = await Promise.all([ensureTrashFolder(), getAppFolderId()]);
    const itemData = await getItem(id);

    if (id === trashId || id === appId) {
      return res.status(409).json({ message: "Não é permitido renomear pastas do sistema." });
    }

    // Bloquear renome em itens dentro de App ou Lixeira
    if (itemData.parents?.some(p => p === trashId || p === appId)) {
      return res.status(409).json({ message: "Não é permitido renomear itens em pastas protegidas ou na lixeira." });
    }

    const item = await renameItem(id, name.trim());

    log.info("DriveRenameItem", {
      userId: atorId,
      itemId: id,
      newName: name,
      requestId: req.requestId
    });

    return res.json({ success: true, item });
  } catch (error) {
    log.error("ErroRenameItem", { error: error.message, stack: error.stack, itemId: id, requestId: req.requestId });
    const { status, message } = mapGoogleDriveError(error, req.requestId);
    return res.status(status).json({ message, requestId: req.requestId });
  }
};

/**
 * PATCH /api/publicacoes/items/:id/move
 */
exports.moveItem = async (req, res) => {
  const { id } = req.params;
  let { targetFolderId } = req.body;
  if (targetFolderId === 'ROOT') targetFolderId = ROOT_FOLDER_ID;

  const atorId = req.user?.id;
  const perfilAtor = req.user?.perfil_acesso;

  if (!isGestao(perfilAtor)) {
    return res.status(403).json({ message: "Permissão insuficiente para mover itens." });
  }

  if (!targetFolderId) {
    return res.status(400).json({ message: "Pasta de destino é obrigatória." });
  }

  try {
    const [trashId, appId] = await Promise.all([ensureTrashFolder(), getAppFolderId()]);
    const itemData = await getItem(id);

    if (targetFolderId === trashId || targetFolderId === appId) {
      return res.status(409).json({ message: "Não é permitido mover para esta pasta." });
    }

    if (id === trashId || id === appId) {
      return res.status(409).json({ message: "Não é permitido mover pastas do sistema." });
    }

    // Bloquear mover itens que estão em App/Lixeira
    if (itemData.parents?.some(p => p === trashId || p === appId)) {
      return res.status(409).json({ message: "Não é permitido mover itens de pastas protegidas ou da lixeira." });
    }

    // Permitir mover apenas arquivos na fase 1
    if (itemData.mimeType === FOLDER_MIMETYPE) {
      return res.status(409).json({ message: "Mover pastas não é permitido nesta fase." });
    }

    const item = await moveItem(id, targetFolderId);

    log.info("DriveMoveItem", {
      userId: atorId,
      itemId: id,
      fromParentId: item.oldParentId,
      toParentId: targetFolderId,
      requestId: req.requestId
    });

    return res.json({ success: true, item });
  } catch (error) {
    log.error("ErroMoveItem", { error: error.message, stack: error.stack, itemId: id, requestId: req.requestId });
    const { status, message } = mapGoogleDriveError(error, req.requestId);
    return res.status(status).json({ message, requestId: req.requestId });
  }
};

/**
 * POST /api/publicacoes/items/:id/delete
 */
exports.deleteItem = async (req, res) => {
  const { id } = req.params;
  const atorId = req.user?.id;
  const perfilAtor = req.user?.perfil_acesso;

  if (!isGestao(perfilAtor)) {
    return res.status(403).json({ message: "Permissão insuficiente para excluir itens." });
  }

  try {
    const [trashId, appId] = await Promise.all([ensureTrashFolder(), getAppFolderId()]);
    const itemData = await getItem(id);

    if (id === trashId || id === appId) {
      return res.status(409).json({ message: "Não é permitido excluir pastas do sistema." });
    }

    // Bloquear pastas (fase 1)
    if (itemData.mimeType === FOLDER_MIMETYPE) {
      return res.status(409).json({ message: "A exclusão de pastas não está permitida nesta fase." });
    }

    // Bloquear se item já está na lixeira
    if (itemData.parents?.some(p => p === trashId)) {
      return res.status(409).json({ message: "Este item já está na lixeira." });
    }

    const item = await deleteItem(id);

    log.info("DriveDeleteItem", {
      userId: atorId,
      itemId: id,
      fromParentId: item.oldParentId,
      toParentId: trashId,
      requestId: req.requestId
    });

    return res.json({ success: true, item });
  } catch (error) {
    log.error("ErroDeleteItem", { error: error.message, stack: error.stack, itemId: id, requestId: req.requestId });
    const { status, message } = mapGoogleDriveError(error, req.requestId);
    return res.status(status).json({ message, requestId: req.requestId });
  }
};

/**
 * Faz o streaming de um arquivo do Google Drive para o cliente.
 */
/**
 * Faz o streaming de um arquivo do Google Drive para o cliente.
 */
exports.visualizar = async (req, res) => {
  const fileId = req.params.id;

  try {
    const dados = await obterArquivoStream(fileId);

    // Content-Type correto
    res.setHeader("Content-Type", dados.mimeType || "application/octet-stream");

    // ✅ Evita crash por caracteres inválidos no filename (acentos, unicode, CR/LF, etc.)
    // Para o app mobile, não precisamos informar filename aqui.
    res.setHeader("Content-Disposition", "inline");

    // Pipe do stream
    dados.stream.on("error", (e) => {
      log.error("ErroStreamArquivoDrive", { message: e.message, fileId });
      if (!res.headersSent) res.status(500);
      res.end();
    });

    dados.stream.pipe(res);
  } catch (err) {
    // Diferenciar "não encontrado" de erro interno
    const msg = err?.message || "";

    log.error("ErroVisualizarArquivo", {
      message: msg,
      fileId,
      path: "/api/publicacoes/arquivo"
    });

    // Se você tiver um erro específico do Drive para 404, trate aqui.
    // Sem isso, não masque erro interno como 404.
    const isNotFound =
      msg.includes("notFound") ||
      msg.includes("File not found") ||
      msg.includes("Requested entity was not found");

    return res.status(isNotFound ? 404 : 500).json({
      error: isNotFound ? "Arquivo não encontrado" : "Falha ao abrir o arquivo",
      requestId: req.requestId
    });
  }
};
