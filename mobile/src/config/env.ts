// mobile/src/config/env.ts
import { API_BASE_URL as ENV_API_URL } from "@env";
import Constants from "expo-constants";
import { Platform } from "react-native";

const LOCALHOST_FALLBACK =
  Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";

// URL OFICIAL do backend (https)
const PROD_FALLBACK = "https://sinprfes.org.br";

function normalize(url?: string): string | undefined {
  if (!url) return undefined;
  const u = String(url).trim().replace(/\/+$/, "");
  if (!u) return undefined;
  // Força https em produção
  return __DEV__ ? u : u.replace(/^http:\/\//, "https://");
}

const extra = (Constants.expoConfig as any)?.extra || {};

const fromExtra =
  extra.API_BASE_URL || extra.API_URL || extra.apiUrl;

let resolvedApiUrl: string | undefined;

if (__DEV__) {
  resolvedApiUrl = normalize(ENV_API_URL) || normalize(fromExtra) || normalize(LOCALHOST_FALLBACK);
} else {
  resolvedApiUrl = normalize(fromExtra) || normalize(ENV_API_URL) || normalize(PROD_FALLBACK);
}

if (!resolvedApiUrl) {
  // Guard-rail: nunca deixar undefined (evita “Network Error” cego)
  console.error("[CRITICAL] API_BASE_URL is undefined. Check app extra/env.");
  resolvedApiUrl = normalize(PROD_FALLBACK)!;
}

export const API_BASE_URL = resolvedApiUrl;
