// src/services/cloudinary.service.js
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

cloudinary.config(process.env.CLOUDINARY_URL);

const STANDARD_IMAGE_TRANSFORMATION = {
  width: 300,
  height: 300,
  crop: "fill",
  gravity: "auto",
  fetch_format: "auto",
  quality: "auto",
};

const STANDARD_IMAGE_TRANSFORMATION_STRING = "c_fill,g_auto,w_300,h_300/f_auto,q_auto";

/**
 * Upload de avatar com:
 * - public_id fixo por filiado (URL estável)
 * - eager transformation única (200x200, face-centered, auto format/quality)
 *
 * Isso garante que só existe UMA variação do avatar (economia de transformações).
 */
function uploadAvatarBuffer(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: "image",
        eager: [
          {
            width: 200,
            height: 200,
            crop: "fill",
            gravity: "face",
            fetch_format: "auto",
            quality: "auto",
          },
        ],
        eager_async: false,
      },
      (err, result) => {
        if (err) return reject(err);

        const eagerUrl = result?.eager?.[0]?.secure_url || result?.secure_url;

        resolve({
          avatar_url: eagerUrl,
          avatar_public_id: result.public_id,
          raw: result,
        });
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

function deleteAvatarByPublicId(publicId) {
  if (!publicId) return Promise.resolve();
  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}

function uploadFileBuffer(buffer, options = {}) {
  const { standardizeImage = true, ...uploadOptions } = options;
  const isImageResource = !uploadOptions.resource_type || uploadOptions.resource_type === "image";
  const hasCustomTransform = Boolean(uploadOptions.transformation || uploadOptions.eager);

  const finalOptions = {
    resource_type: "auto",
    ...uploadOptions,
  };

  if (standardizeImage && isImageResource && !hasCustomTransform) {
    finalOptions.resource_type = "image";
    finalOptions.transformation = [STANDARD_IMAGE_TRANSFORMATION];
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      finalOptions,
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/**
 * Gera uma URL assinada para recursos que não são públicos.
 */
function getSignedUrl(publicId, options = {}) {
  return cloudinary.url(publicId, {
    sign_url: true,
    secure: true,
    ...options,
  });
}

/**
 * Gera assinatura para upload direto do cliente.
 */
function gerarAssinaturaUpload(params) {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { ...params, timestamp },
    cloudinary.config().api_secret
  );

  return {
    timestamp,
    signature,
    cloud_name: cloudinary.config().cloud_name,
    api_key: cloudinary.config().api_key,
    params,
  };
}

module.exports = {
  uploadAvatarBuffer,
  deleteAvatarByPublicId,
  uploadFileBuffer,
  getSignedUrl,
  gerarAssinaturaUpload,
  STANDARD_IMAGE_TRANSFORMATION_STRING,
};
