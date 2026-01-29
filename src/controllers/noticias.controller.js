const { listarArquivosPublicos, obterArquivoTexto } = require("../services/drive.service");
const log = require("../utils/log");

async function findFolderByName(parentFolderId, name) {
  const files = await listarArquivosPublicos(parentFolderId);
  return files.find(f => f.name.toLowerCase() === name.toLowerCase() && f.mimeType === "application/vnd.google-apps.folder");
}

exports.listar = async (req, res) => {
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const noticiasFolder = await findFolderByName(rootFolderId, "Noticias");

    if (!noticiasFolder) {
      log.warn("NoticiasFolderNotFound", { rootFolderId });
      return res.json([]);
    }

    const subfolders = await listarArquivosPublicos(noticiasFolder.id);
    const postFolders = subfolders.filter(f => f.mimeType === "application/vnd.google-apps.folder");

    const noticias = await Promise.all(postFolders.map(async (folder) => {
      try {
        const folderContent = await listarArquivosPublicos(folder.id);
        const postJsonFile = folderContent.find(f => f.name === "post.json");

        if (!postJsonFile) return null;

        const postJsonContent = await obterArquivoTexto(postJsonFile.id);
        const postData = JSON.parse(postJsonContent);

        const coverFile = folderContent.find(f => f.name.startsWith("cover.") && (f.name.endsWith(".jpg") || f.name.endsWith(".png") || f.name.endsWith(".jpeg")));
        const galleryFolder = folderContent.find(f => f.name.toLowerCase() === "gallery" && f.mimeType === "application/vnd.google-apps.folder");

        let galleryFileIds = [];
        if (galleryFolder) {
          const galleryContent = await listarArquivosPublicos(galleryFolder.id);
          galleryFileIds = galleryContent
            .filter(f => f.mimeType.startsWith("image/"))
            .map(f => ({ id: f.id, name: f.name }));
        }

        return {
          ...postData,
          folderId: folder.id,
          coverFileId: coverFile ? coverFile.id : null,
          galleryFileIds
        };
      } catch (err) {
        log.error("ErroAoProcessarNoticia", { folderId: folder.id, error: err.message });
        return null;
      }
    }));

    const filteredNoticias = noticias
      .filter(n => n !== null)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    return res.json(filteredNoticias);
  } catch (err) {
    log.error("ErroListarNoticias", err);
    return res.status(500).json({ message: "Erro ao buscar notícias no Drive." });
  }
};

exports.detalhar = async (req, res) => {
  try {
    const { id } = req.params; // folderId da notícia

    const folderContent = await listarArquivosPublicos(id);
    const postJsonFile = folderContent.find(f => f.name === "post.json");

    if (!postJsonFile) {
      return res.status(404).json({ message: "Notícia não encontrada." });
    }

    const postJsonContent = await obterArquivoTexto(postJsonFile.id);
    const postData = JSON.parse(postJsonContent);

    const coverFile = folderContent.find(f => f.name.startsWith("cover.") && (f.name.endsWith(".jpg") || f.name.endsWith(".png") || f.name.endsWith(".jpeg")));
    const galleryFolder = folderContent.find(f => f.name.toLowerCase() === "gallery" && f.mimeType === "application/vnd.google-apps.folder");

    let galleryFileIds = [];
    if (galleryFolder) {
      const galleryContent = await listarArquivosPublicos(galleryFolder.id);
      galleryFileIds = galleryContent
        .filter(f => f.mimeType.startsWith("image/"))
        .map(f => ({ id: f.id, name: f.name }));
    }

    return res.json({
      ...postData,
      folderId: id,
      coverFileId: coverFile ? coverFile.id : null,
      galleryFileIds
    });
  } catch (err) {
    log.error("ErroDetalharNoticia", err);
    return res.status(500).json({ message: "Erro ao detalhar notícia." });
  }
};
