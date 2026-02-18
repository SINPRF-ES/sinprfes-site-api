import { API_BASE_URL as ENV_API_URL } from "@env";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * CANONICAL PRODUCTION URL
 * This is the ultimate fallback to ensure the app never has an empty baseURL.
 */
const HARDCODED_FALLBACK = "https://api.sinprfes.org.br";

/**
 * Normalizes and validates the API URL.
 * In production (!__DEV__), it prohibits localhost and forces HTTPS.
 */
function normalize(url?: any): string | undefined {
  if (!url) return undefined;

  let u = String(url).trim().replace(/\/+$/, "");
  if (!u || u === "undefined" || u === "null") return undefined;

  if (!__DEV__) {
    // Rule: Prohibit localhost/10.0.2.2 in production
    if (u.includes("localhost") || u.includes("10.0.2.2") || u.includes("127.0.0.1")) {
      console.warn(`[CRITICAL] Localhost detected in production environment (${u}). Switching to fallback.`);
      return HARDCODED_FALLBACK;
    }
    // Rule: Force HTTPS in production
    if (u.startsWith("http://")) {
      u = u.replace("http://", "https://");
    }
  }

  return u;
}

const extra = (Constants.expoConfig as any)?.extra || {};

// (A) Constants.expoConfig?.extra?.API_BASE_URL (or API_URL as legacy)
const fromExtra = extra.API_BASE_URL || extra.API_URL || extra.apiUrl;

// (B) ENV_API_URL coming from '@env' (react-native-dotenv)
const fromEnvFile = ENV_API_URL;

// (C) process.env.EXPO_PUBLIC_API_URL (Expo standard)
const fromProcessEnv = (process.env as any).EXPO_PUBLIC_API_URL;

let resolvedApiUrl = normalize(fromExtra) ||
                     normalize(fromEnvFile) ||
                     normalize(fromProcessEnv);

if (!resolvedApiUrl) {
  // (D) Final hardcoded fallback
  // Using console.error instead of throwing to allow the app to run with the fallback.
  console.error("[CRITICAL] API_BASE_URL is not defined in any environment source. Using hardcoded fallback: " + HARDCODED_FALLBACK);
  resolvedApiUrl = HARDCODED_FALLBACK;
}

export const API_BASE_URL = resolvedApiUrl;
