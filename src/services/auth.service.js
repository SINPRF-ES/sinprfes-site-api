const pool = require("../config/db");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const log = require("../utils/log");

/**
 * Cria um novo refresh token para um filiado.
 * Retorna o token puro (que deve ser enviado ao cliente).
 * O formato retornado é "id.token_puro" para busca eficiente.
 */
async function createRefreshToken(filiadoId, deviceInfo = {}) {
  const rawToken = crypto.randomBytes(40).toString("hex");
  const hash = await bcrypt.hash(rawToken, 10);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 dias (pode ser ajustado para 60 se preferir)

  const { deviceId, deviceName, userAgent, ip, platform } = deviceInfo;

  const query = `
    INSERT INTO auth_refresh_tokens (
      filiado_id, token_hash, device_id, device_name, user_agent, ip, platform, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `;

  const { rows } = await pool.query(query, [
    filiadoId, hash, deviceId, deviceName, userAgent, ip, platform, expiresAt
  ]);

  const tokenId = rows[0].id;
  return `${tokenId}.${rawToken}`;
}

/**
 * Valida um refresh token.
 * Retorna o registro do token se válido, ou null caso contrário.
 */
async function verifyRefreshToken(fullToken) {
  if (!fullToken || typeof fullToken !== 'string') return null;

  const [id, rawToken] = fullToken.split('.');
  if (!id || !rawToken) return null;

  // UUID regex check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return null;

  const query = `
    SELECT * FROM auth_refresh_tokens
    WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW()
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [id]);
  const tokenRecord = rows[0];

  if (!tokenRecord) return null;

  const isValid = await bcrypt.compare(rawToken, tokenRecord.token_hash);
  if (!isValid) {
    log.warn("RefreshTokenInvalidHash", { tokenId: id, filiadoId: tokenRecord.filiado_id });
    return null;
  }

  return tokenRecord;
}

/**
 * Rotaciona um refresh token: revoga o antigo e cria um novo.
 */
async function rotateRefreshToken(oldTokenId, filiadoId, deviceInfo = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cria o novo token
    const rawToken = crypto.randomBytes(40).toString("hex");
    const hash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { deviceId, deviceName, userAgent, ip, platform } = deviceInfo;

    const insertQuery = `
      INSERT INTO auth_refresh_tokens (
        filiado_id, token_hash, device_id, device_name, user_agent, ip, platform, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const { rows } = await client.query(insertQuery, [
      filiadoId, hash, deviceId, deviceName, userAgent, ip, platform, expiresAt
    ]);
    const newTokenId = rows[0].id;

    // Revoga o antigo
    const revokeQuery = `
      UPDATE auth_refresh_tokens
      SET revoked_at = NOW(),
          revoke_reason = $1,
          replaced_by = $2
      WHERE id = $3
    `;
    await client.query(revokeQuery, ['Rotated', newTokenId, oldTokenId]);

    await client.query('COMMIT');
    return `${newTokenId}.${rawToken}`;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Revoga um token específico.
 */
async function revokeRefreshToken(tokenId, reason = 'Logout') {
  const query = `
    UPDATE auth_refresh_tokens
    SET revoked_at = NOW(),
        revoke_reason = $1
    WHERE id = $2 AND revoked_at IS NULL
  `;
  await pool.query(query, [reason, tokenId]);
}

/**
 * Revoga todos os tokens de um filiado (ex: troca de senha).
 */
async function revokeAllRefreshTokens(filiadoId, reason = 'Password Change') {
  const query = `
    UPDATE auth_refresh_tokens
    SET revoked_at = NOW(),
        revoke_reason = $1
    WHERE filiado_id = $2 AND revoked_at IS NULL
  `;
  await pool.query(query, [reason, filiadoId]);
}

module.exports = {
  createRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens
};
