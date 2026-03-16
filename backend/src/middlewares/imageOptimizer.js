const sharp = require("sharp");

/**
 * Middleware para otimizar imagens antes do upload.
 * Converte para WebP e redimensiona para um tamanho padrão.
 *
 * @param {Object} options Configurações de otimização
 * @param {number} options.width Largura desejada (default: 300)
 * @param {number} options.height Altura desejada (default: 300)
 * @param {string} options.fit Modo de redimensionamento do sharp (default: 'cover')
 * @param {number} options.quality Qualidade inicial WebP (default: 82)
 * @param {number} options.maxSize Tamanho máximo em bytes (default: 2MB)
 */
const imageOptimizer = (options = {}) => {
  const {
    width = 300,
    height = 300,
    fit = "cover",
    quality: initialQuality = 82,
    maxSize = 2 * 1024 * 1024,
  } = options;

  return async (req, res, next) => {
    try {
      if (!req.file || !req.file.buffer) return next();

      // Se não for imagem, ignora (ex: vídeo em notícias)
      if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
        return next();
      }

      const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;

      let quality = initialQuality;
      let buffer = await sharp(req.file.buffer)
        .rotate()
        .resize(width, height, { fit })
        .webp({ quality })
        .toBuffer();

      // Loop de otimização agressiva se ultrapassar o tamanho máximo
      while (buffer.length > maxSize && quality > 50) {
        quality -= 8;
        buffer = await sharp(req.file.buffer)
          .rotate()
          .resize(width, height, { fit })
          .webp({ quality })
          .toBuffer();
      }

      if (buffer.length > maxSize) {
        return res.status(413).json({
          error: `Não foi possível otimizar a imagem abaixo de ${Math.round(maxSize / 1024 / 1024)}MB.`,
          requestId: req.requestId
        });
      }

      // Atualiza req.file com os dados da imagem otimizada
      req.file.buffer = buffer;
      req.file.originalname = filename; // Mudando para .webp
      req.file.mimetype = "image/webp";
      req.file.size = buffer.length;

      next();
    } catch (err) {
      console.error("[imageOptimizer] Erro ao processar imagem:", err);
      next(err);
    }
  };
};

module.exports = imageOptimizer;
