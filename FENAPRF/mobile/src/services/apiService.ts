// src/services/apiService.ts
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { carregarSessao, limparSessao, carregarRefreshToken, salvarSessao } from './storageService';
import { logger } from '../infra/logger';
import { getStableDeviceId } from '../utils/deviceId';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Controle de Refresh Token (Mutex)
let isRefreshing = false;
let failedQueue: any[] = [];
let lastRefreshAttempt = 0;
const REFRESH_THROTTLE = 5000; // 5 segundos entre tentativas de refresh se falhar

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

/**
 * Helper para decodificar JWT sem dependências externas (JWT Payload é Base64Url)
 */
function getTokenExpiration(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

    // Robustez para ambientes React Native onde atob pode estar ausente
    let decodedStr;
    if (typeof atob === 'function') {
        decodedStr = atob(base64);
    } else {
        // Fallback básico para Base64 se atob falhar (best effort)
        decodedStr = Buffer.from(base64, 'base64').toString();
    }

    const decoded = JSON.parse(decodedStr);
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch (e) {
    return null;
  }
}

function maskSensitiveData(obj: any): any {
  try {
    if (!obj || typeof obj !== 'object') return obj;
    const masked = Array.isArray(obj) ? [...obj] : { ...obj };
    const keysToMask = ['password', 'senha', 'token', 'cpf'];

    Object.keys(masked).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (keysToMask.includes(lowerKey)) {
        if (lowerKey === 'cpf' && typeof (masked as any)[key] === 'string' && (masked as any)[key].length === 11) {
          (masked as any)[key] = (masked as any)[key].substring(0, 3) + '.***.***-' + (masked as any)[key].substring(9);
        } else {
          (masked as any)[key] = '********';
        }
      } else if (typeof (masked as any)[key] === 'object') {
        (masked as any)[key] = maskSensitiveData((masked as any)[key]);
      }
    });
    return masked;
  } catch (err) {
    return '[Mask Error]';
  }
}

// Interceptor para injetar o token JWT
api.interceptors.request.use(
  async (config: any) => {
    const sessao = await carregarSessao();
    let token = sessao?.token;

    // 🕒 PROACTIVE REFRESH: Verifica expiração do token antes de enviar
    if (token && !config.url.includes('/api/auth/refresh')) {
        const exp = getTokenExpiration(token);
        if (exp && (exp - Date.now() < 60000)) { // Margem de 60 segundos
            logger.info('[Auth.Proactive] Token prestes a expirar, iniciando refresh preventivo.');
            try {
                // Dispara o refresh e aguarda o novo token
                token = await executeSilentRefresh();
            } catch (e) {
                logger.warn('[Auth.Proactive] Falha no refresh preventivo, seguindo com token original.');
            }
        }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.params) {
      Object.keys(config.params).forEach(key => {
        const val = config.params[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          if (val.queryKey || val.signal || val.client) {
            delete config.params[key];
          }
        }
      });
    }

    const { method, url, params } = config;
    logger.info(`API_REQ: ${method?.toUpperCase()} ${url}`, {
      params: maskSensitiveData(params),
      profile: sessao?.user?.perfil_acesso
    });
    config.meta = { requestStartedAt: new Date().getTime() };

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas e erros (incluindo Silent Refresh reativo)
api.interceptors.response.use(
  (response: any) => {
    const { config, status } = response;
    const duration = new Date().getTime() - config.meta.requestStartedAt;
    logger.info(`API_RES: ${config.method?.toUpperCase()} ${config.url} | Status: ${status} | ${duration}ms`);
    return response;
  },
  async (error) => {
    const { config, response } = error;
    const originalRequest = config;

    const status = response?.status;
    const url = config?.url || '';

    // Evitar loop infinito no próprio endpoint de refresh
    const isRefreshRoute = url.includes('/api/auth/refresh');

    // 🔴 TRATAMENTO DE 401: Silent Refresh Reativo
    if (status === 401 && !isRefreshRoute && !originalRequest._retry) {
      // Se não houver token na request original nem na sessão, nem tentamos refresh pois já estamos deslogados
      const sessaoCheck = await carregarSessao();
      if (!originalRequest.headers.Authorization && !sessaoCheck?.token) {
          return Promise.reject(error);
      }

      try {
          const newToken = await executeSilentRefresh();
          originalRequest._retry = true;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
      } catch (refreshErr) {
          return Promise.reject(refreshErr);
      }
    }

    // Erros 409: Device Mismatch (comum em refresh com deviceId diferente)
    if (status === 409 && isRefreshRoute) {
        logger.error('[Auth.Refresh] Device Mismatch detectado.');
        await limparSessao();
    }

    // Logger de erro padrão
    const message = response?.data?.message || response?.data?.error || error.message;
    logger.error(`API Error: ${config?.method?.toUpperCase()} ${url} | Status: ${status}`, { message });

    return Promise.reject(error);
  }
);

/**
 * Lógica centralizada de Silent Refresh com Mutex, Retry e Tratamento de Erro
 */
async function executeSilentRefresh(): Promise<string> {
    if (isRefreshing) {
        logger.info('[Auth.Refresh] Já em andamento, aguardando...');
        return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
        });
    }

    isRefreshing = true;
    const now = Date.now();

    // Throttle defensivo
    if (now - lastRefreshAttempt < REFRESH_THROTTLE) {
        logger.warn('[Auth.Refresh] Tentativa muito próxima da anterior. Abortando para evitar loop.');
        isRefreshing = false;
        // Não limpamos sessão aqui se houver um token válido (pode ser concorrência residual)
        // mas se chegamos aqui é porque o refresh falhou repetidamente.
        const sessao = await carregarSessao();
        if (!sessao?.token) {
            await limparSessao();
        }
        throw new Error('Refresh throttled');
    }

    lastRefreshAttempt = now;

    try {
        const refreshToken = await carregarRefreshToken(); // Pode disparar Biometria
        const deviceId = await getStableDeviceId();

        logger.info('[Auth.Refresh] Iniciando renovação silenciosa...', {
            hasRefreshToken: !!refreshToken,
            deviceId: deviceId?.substring(0, 8) + '...'
        });

        if (!refreshToken) {
            logger.warn('[Auth.Refresh] Refresh token ausente ou cancelado pelo usuário.');
            throw new Error('SESSION_EXPIRED');
        }

        // Retry Loop para falhas de rede (sem re-disparar biometria)
        let refreshResponse: any;
        let lastError: any;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                refreshResponse = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
                    refreshToken,
                    deviceId
                }, { timeout: 15000 });
                break; // Sucesso
            } catch (err: any) {
                lastError = err;
                const isNetworkError = !err.response && !!err.request;
                const is4xx = err.response && err.response.status >= 400 && err.response.status < 500;

                if (is4xx || !isNetworkError || attempt === 3) {
                    throw err; // Falha crítica ou última tentativa
                }

                const delayMs = attempt * 2000;
                logger.warn(`[Auth.Refresh] Falha de rede na tentativa ${attempt}. Retrying em ${delayMs}ms...`);
                await new Promise(r => setTimeout(r, delayMs));
            }
        }

        const { token: newToken, refreshToken: newRefreshToken } = refreshResponse.data;

        // Atualiza o storage com os novos tokens preservando o usuário atual
        const sessaoAtual = await carregarSessao();
        const userExistente = sessaoAtual?.user;

        await salvarSessao({
            token: newToken,
            refreshToken: newRefreshToken,
            user: (userExistente && userExistente.id !== 'unknown') ? userExistente : (userExistente || { id: 'unknown' } as any)
        });

        logger.info('[Auth.Refresh] Sucesso na renovação.');
        isRefreshing = false;
        processQueue(null, newToken);
        return newToken;

    } catch (err: any) {
        const refreshStatus = err.response?.status;
        const isNetworkError = !err.response && !!err.request;
        const isCritical = refreshStatus === 401 || refreshStatus === 403 || refreshStatus === 400 || err.message === 'SESSION_EXPIRED' || !isNetworkError;

        logger.error('[Auth.Refresh] Falha na renovação.', {
            status: refreshStatus,
            message: err.message,
            isCritical
        });

        isRefreshing = false;
        processQueue(err, null);

        if (isCritical) {
            logger.warn('[Auth.Refresh] Falha crítica. Limpando sessão.');
            await limparSessao();
        }

        throw err;
    }
}

export const getUsers = async (params?: any) => {
  const response = await api.get('/api/users', { params });
  return response.data.users || response.data || [];
};

export const criarUser = async (userData: any) => {
  return await api.post('/api/users', userData);
};

export const atualizarUser = async (id: string, userData: any) => {
  return await api.put(`/api/users/${id}`, userData);
};

export const arquivarUser = async (id: string, motivo: string) => {
  return await api.post(`/api/users/${id}/arquivar`, { motivo });
};

export const desarquivarUser = async (id: string, motivo: string) => {
  return await api.post(`/api/users/${id}/desarquivar`, { motivo });
};

export default api;
