// src/controllers/publicacoes.controller.js
const { listarArquivosPublicos, obterArquivoStream } = require("../services/drive.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");
const { handleDbError } = require("../utils/dbError");

exports.listar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const folderId = req.query.folderId;

    // Busca os arquivos (passando o ID se houver)
    const arquivos = await listarArquivosPublicos(folderId);

    const publicacoes = arquivos.map(file => {
      const { name, mimeType, id, webViewLink, webContentLink, createdTime } = file;
      const nomeUpper = name.toUpperCase();
      let tipo = "OUTROS";
      
      const isFolder = mimeType === "application/vnd.google-apps.folder";

      if (isFolder) {
          tipo = "PASTA";
      } else {
          if (nomeUpper.includes("ATA")) tipo = "ATA";
          else if (nomeUpper.includes("NOTA") || nomeUpper.includes("COMUNICADO")) tipo = "NOTA";
          else if (nomeUpper.includes("BALANÇO") || nomeUpper.includes("BALANCO")) tipo = "BALANCO";
      }

      return {
        id,
        titulo: name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        tipo,
        isFolder,
        descricao: isFolder ? "Pasta de documentos" : "Documento oficial.", 
        arquivo_url: webViewLink,
        data_publicacao: createdTime,
        name,
        mimeType,
        webViewLink,
        webContentLink,
        createdTime
      };
    });

    // Retorno em array para compatibilidade com clientes legados (mobile).
    // O frontend web já é tolerante a ambos os formatos.
    return res.json(publicacoes);
  } catch (err) {
    log.error("ErroListarDrive", { error: err.message, requestId, atorId });
    return res.status(500).json({ success: false, message: "Erro ao sincronizar com o Drive.", requestId });
  }
};

exports.visualizar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;

  try {
    const fileId = req.params.id;
    const dados = await obterArquivoStream(fileId);

    // Configura o cabeçalho para o navegador entender que é um PDF/Imagem
    res.setHeader("Content-Type", dados.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${dados.name}"`);

    // Envia o arquivo como um fluxo de dados (pipe)
    dados.stream.pipe(res);

  } catch (err) {
    log.error("ErroVisualizarArquivo", err);
    res.status(404).send("Arquivo não encontrado ou erro ao carregar.");
  }
};