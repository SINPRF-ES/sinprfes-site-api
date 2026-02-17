/**
 * Feature flags (Mobile only)
 * Keep this file dependency-free and deterministic.
 * If we later need remote flags, it must be implemented via backend,
 * but defaults must still be safe here.
 */

// Default: OFF in production unless explicitly enabled.
export const ENABLE_JOGOS = false;

// If needed later:
// export const ENABLE_OTA_BANNER = true;
