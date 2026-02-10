// src/controllers/publicacoes.controller.js
const { listarArquivosPublicos, obterArquivoStream } = require("../services/drive.service");
const log = require("../utils/log");

exports.listar = async (req, res) => {
  try {
    const folderId = req.query.folderId;

    // Busca os arquivos (passando o ID se houver)
    const arquivos = await listarArquivosPublicos(folderId);

    const publicacoes = arquivos.map(file => {
      const nomeUpper = file.name.toUpperCase();
      let tipo = "OUTROS";

      // 🟢 O SEGREDO ESTÁ AQUI: Identificar corretamente a pasta pelo MimeType
      const isFolder = file.mimeType === "application/vnd.google-apps.folder";

      if (isFolder) {
          tipo = "PASTA";
      } else {
          // Lógica de cores para arquivos
          if (nomeUpper.includes("ATA")) tipo = "ATA";
          else if (nomeUpper.includes("NOTA") || nomeUpper.includes("COMUNICADO")) tipo = "NOTA";
          else if (nomeUpper.includes("BALANÇO") || nomeUpper.includes("BALANCO")) tipo = "BALANCO";
      }

      return {
        id: file.id,
        titulo: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        tipo: tipo,
        // Envia essa flag explicitamente
        isFolder: isFolder,
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
    log.error("ErroListarDrive", err);
    return res.status(500).json({ message: "Erro ao sincronizar com o Drive." });
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
      error: isNotFound ? "Arquivo não encontrado" : "Falha ao abrir o arquivo"
    });
  }
};
