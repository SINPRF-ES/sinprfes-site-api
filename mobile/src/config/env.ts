// src/config/env.ts
import { API_BASE_URL as ENV_API_URL } from '@env';
import { Platform } from 'react-native';

// URL de produção como fallback final
const PROD_API_URL = 'https://api.sinprfes.org.br';

// Define a URL base da API para desenvolvimento local como um fallback
const LOCALHOST_FALLBACK = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

let resolvedApiUrl: string;

if (__DEV__) {
  // Em desenvolvimento, prioriza a URL do .env. Se não houver, usa o localhost.
  resolvedApiUrl = ENV_API_URL || LOCALHOST_FALLBACK;
} else {
  // Em produção, usa a URL do .env ou o fallback de produção.
  resolvedApiUrl = ENV_API_URL || PROD_API_URL;
}

export const API_BASE_URL = resolvedApiUrl;
