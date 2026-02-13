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

// Controle de Refresh Token
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

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
    if (sessao?.token) {
      config.headers.Authorization = `Bearer ${sessao.token}`;
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

    const { method, url, params, data } = config;
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

// Interceptor para tratar respostas e erros (incluindo Silent Refresh)
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

    // 🔴 TRATAMENTO DE 401: Silent Refresh
    if (status === 401 && !isRefreshRoute && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        logger.info('[Auth.Refresh] Iniciando renovação silenciosa...');
        const refreshToken = await carregarRefreshToken();
        const deviceId = await getStableDeviceId();

        if (!refreshToken) {
          throw new Error('Refresh token não disponível.');
        }

        // Chamada direta para não cair no interceptor recursivo
        const refreshResponse = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refreshToken,
          deviceId
        });

        const { token: newToken, refreshToken: newRefreshToken } = refreshResponse.data;

        // Atualiza o storage com os novos tokens (preservando o usuário)
        const sessaoAtual = await carregarSessao();
        if (sessaoAtual?.user) {
            await salvarSessao({
                token: newToken,
                refreshToken: newRefreshToken,
                user: sessaoAtual.user
            });
        }

        logger.info('[Auth.Refresh] Sucesso na renovação.');
        processQueue(null, newToken);
        isRefreshing = false;

        // Re-executa a request original
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);

      } catch (refreshErr) {
        logger.error('[Auth.Refresh] Falha na renovação. Forçando logout.', refreshErr);
        processQueue(refreshErr, null);
        isRefreshing = false;
        await limparSessao();

        if (typeof window !== 'undefined' && (window as any).onSessionExpired) {
          (window as any).onSessionExpired();
        }
        return Promise.reject(refreshErr);
      }
    }

    // Erros 409: Device Mismatch
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
