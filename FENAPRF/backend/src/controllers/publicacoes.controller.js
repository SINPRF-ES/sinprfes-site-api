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
// Adicione esta nova função:
exports.visualizar = async (req, res) => {
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