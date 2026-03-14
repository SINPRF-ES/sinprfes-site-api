// src/controllers/publicacoes.controller.js
const { listarArquivosPublicos, obterArquivoStream } = require("../services/drive.service");
const log = require("../utils/log");
const { v4: uuidv4 } = require("uuid");
const { ehPerfilGestao } = require("../shared/canon");

exports.listar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  const perfilAtor = (req.user?.perfil_acesso || "").toUpperCase();
  const isGestao = ehPerfilGestao(perfilAtor);

  try {
    const folderId = req.query.folderId;

    // Busca os arquivos (passando o ID se houver)
    const arquivos = await listarArquivosPublicos(folderId);

    const pastasOcultas = ["APPS", "APP", "NOTICIAS", "NOTÍCIAS", "NOTICIA", "NOTÍCIA"];

    let publicacoes = arquivos
      .map(file => {
        const { name, mimeType, id, webViewLink, webContentLink, createdTime } = file;
        const nomeOriginal = name || "";
        const nomeUpper = nomeOriginal.toUpperCase();
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
          titulo: nomeOriginal.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
          tipo,
          isFolder,
          descricao: isFolder ? "Pasta de documentos" : "Documento oficial.",
          arquivo_url: webViewLink,
          data_publicacao: createdTime,
          name: nomeOriginal,
          mimeType,
          webViewLink,
          webContentLink,
          createdTime
        };
      })
      .filter(item => {
        // 🟢 Filtragem de Pastas Técnicas (APPS, NOTICIAS) para não-gestão (Parity Rule)
        // Ocultar pastas técnicas apenas na raiz do Drive (onde folderId é nulo ou ausente)
        if (!isGestao && item.isFolder && !folderId) {
          const tituloNorm = (item.name || "").toUpperCase().trim();
          if (pastasOcultas.includes(tituloNorm)) {
            return false;
          }
        }
        return true;
      });

    log.info("PublicacoesListarSucesso", { requestId, atorId, count: publicacoes.length, folderId });

    // Retorno em array para compatibilidade com clientes legados (mobile).
    return res.json(publicacoes);
  } catch (err) {
    log.error("PublicacoesListarErro", { error: err.message, requestId, atorId, folderId });
    return res.status(500).json({
      success: false,
      message: "Erro ao sincronizar com a Biblioteca Digital.",
      requestId
    });
  }
};

exports.visualizar = async (req, res) => {
  const requestId = req.requestId || uuidv4();
  const atorId = req.user?.id;
  const fileId = req.params.id;

  try {
    if (!fileId) {
      return res.status(400).json({ success: false, message: "ID do arquivo não informado.", requestId });
    }

    const dados = await obterArquivoStream(fileId);

    // Configura o cabeçalho para o navegador entender que é um PDF/Imagem
    res.setHeader("Content-Type", dados.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${dados.name}"`);

    log.info("PublicacoesVisualizarSucesso", { requestId, atorId, fileId, fileName: dados.name });

    // Envia o arquivo como um fluxo de dados (pipe)
    dados.stream.pipe(res);

  } catch (err) {
    log.error("PublicacoesVisualizarErro", { error: err.message, requestId, atorId, fileId });
    res.status(404).json({
      success: false,
      message: "Arquivo não encontrado ou erro ao carregar da Biblioteca Digital.",
      requestId
    });
  }
};