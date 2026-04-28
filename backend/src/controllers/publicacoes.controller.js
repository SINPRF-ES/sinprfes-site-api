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
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    const host = req.get("host") || "";
    const apiBaseUrl = host ? `${proto}://${host}` : "";

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

        const isApk = mimeType === "application/vnd.android.package-archive" || /\.apk$/i.test(nomeOriginal);
        const proxyUrl = `/api/publicacoes/arquivo/${id}?download=1`;

        return {
          id,
          titulo: nomeOriginal.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
          tipo,
          isFolder,
          descricao: isFolder ? "Pasta de documentos" : "Documento oficial.",
          // Para APK, sempre priorizamos o proxy do backend para evitar links de visualização do Drive
          // e padronizar cabeçalhos de download/instalação no Android.
          arquivo_url: isApk ? proxyUrl : webViewLink,
          download_url: proxyUrl,
          external_url: webContentLink || webViewLink || null,
          isApk,
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

    const isApk = dados.mimeType === "application/vnd.android.package-archive" || /\.apk$/i.test(dados.name || "");
    const shouldDownload = req.query.download === "1" || req.query.download === "true" || isApk;
    const normalizedMimeType = isApk ? "application/vnd.android.package-archive" : (dados.mimeType || "application/octet-stream");

    // Configura o cabeçalho para exibir (inline) ou baixar (attachment)
    res.setHeader("Content-Type", normalizedMimeType);
    res.setHeader("Content-Disposition", `${shouldDownload ? "attachment" : "inline"}; filename="${dados.name}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (dados.size) {
      res.setHeader("Content-Length", String(dados.size));
    }

    log.info("PublicacoesVisualizarSucesso", {
      requestId,
      atorId,
      fileId,
      fileName: dados.name,
      mimeType: normalizedMimeType,
      shouldDownload,
      isApk,
    });

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
