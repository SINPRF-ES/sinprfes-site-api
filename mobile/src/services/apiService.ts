// src/services/apiService.ts
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { carregarSessao, limparSessao, carregarRefreshToken, salvarSessao } from './storageService';
import { logger } from '../infra/logger';

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom: any) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Interceptor para injetar o token JWT e loggar a requisição
api.interceptors.request.use(
  async (config: any) => {
    const sessao = await carregarSessao();
    if (sessao?.token) {
      config.headers.Authorization = `Bearer ${sessao.token}`;
    }

    // Guard-rail: Detectar e sanitizar parâmetros não-serializáveis (ex: React Query Context)
    if (config.params) {
      Object.keys(config.params).forEach(key => {
        const val = config.params[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          // Se parece um objeto complexo do React Query ou similar
          if (val.queryKey || val.signal || val.client) {
            logger.warn(`ReactQueryContextPassedToFetcher: Removendo objeto detectado no parâmetro '${key}'`, {
              url: config.url,
              paramKey: key
            });
            delete config.params[key];
          }
        }
      });
    }

    // Log da requisição instrumentada
    const { method, url, params, data } = config;
    let maskedDataKeys: string[] | undefined;
    try {
      maskedDataKeys = data ? Object.keys(typeof data === 'string' ? JSON.parse(data) : data) : undefined;
    } catch (e) {
      maskedDataKeys = data ? ['[Complex/String Data]'] : undefined;
    }

    logger.info(`API_REQ: ${method?.toUpperCase()} ${url}`, {
      params: maskSensitiveData(params),
      dataKeys: maskedDataKeys,
      profile: sessao?.usuario?.perfil_acesso
    });
    config.meta = { requestStartedAt: new Date().getTime() };

    return config;
  },
  (error) => {
    logger.error('API Request Error', error);
    return Promise.reject(error);
  }
);

// Interceptor para tratar e loggar respostas
api.interceptors.response.use(
  (response: any) => {
    const { config, status, data } = response;
    const { method, url } = config;
    const duration = new Date().getTime() - config.meta.requestStartedAt;

    logger.info(`API_RES: ${method?.toUpperCase()} ${url} | Status: ${status} | ${duration}ms`, {
      dataShape: data ? Object.keys(data) : undefined
    });

    return response;
  },
  async (error) => {
    const { config, response } = error;
    const { method, url } = config;
    const duration = new Date().getTime() - config.meta?.requestStartedAt || 0;

    const status = response?.status;
    const contentType = response?.headers?.['content-type'] || '';
    const errorId = response?.data?.errorId;
    let message = response?.data?.message || error.message;

    if (errorId) {
      message = `${message} (Cód: ${errorId})`;
    }

    // Se a API retornar HTML (ex: 502 Proxy, Erro do Render, etc), extraímos um preview para o log
    if (contentType.includes('text/html')) {
      const htmlPreview = typeof response.data === 'string'
        ? response.data.replace(/<[^>]*>?/gm, '').substring(0, 200).trim()
        : 'HTML body is not a string';

      logger.error(`[DEBUG][API.HtmlError] ${method?.toUpperCase()} ${url} | Status: ${status} | Preview: ${htmlPreview}`);
      message = 'Servidor indisponível (Erro de Proxy/HTML). Por favor, tente novamente em instantes.';
    }

    // Diferenciação de tipos de erro conforme Objetivo 3
    let errorContext = 'API_UNKNOWN_ERROR';
    if (response) {
      errorContext = 'API_BACKEND_ERROR';
    } else if (error.request) {
      errorContext = error.code === 'ECONNABORTED' ? 'API_TIMEOUT' : 'API_NETWORK_ERROR';
    } else {
      errorContext = 'API_SETUP_ERROR';
    }

    // Extrai o requestId do header para facilitar correlação Backend-Mobile
    const requestId = response?.headers?.['x-request-id'] || response?.headers?.['X-Request-Id'];

    // Sanitiza o objeto de erro para evitar logar dados sensíveis
    let errorData = error.config?.data;
    if (typeof errorData === 'string') {
      try {
        errorData = JSON.parse(errorData);
      } catch (e) {
        // Manteve como string se não for JSON
      }
    }

    const sanitizedError = {
      errorContext,
      requestId,
      message: message,
      status: status,
      contentType: contentType,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        params: maskSensitiveData(error.config?.params),
        data: maskSensitiveData(errorData),
      },
      responseData: contentType.includes('application/json') ? maskSensitiveData(response?.data) : '[Non-JSON Content]',
      responseHeaders: response?.headers,
      durationMs: duration,
      axiosCode: error.code
    };

    // Redução de ruído para erros best-effort (ex: Push Register 500, Jogos check 404)
    const isPushRegister = url?.includes('/api/push/register');
    const isJogosCheck = url?.includes('/api/jogos/inscricao') && method?.toLowerCase() === 'get';

    if ((isPushRegister && status === 500) || (isJogosCheck && status === 404)) {
      logger.warn(`API Best-Effort/Expected Fail: ${method?.toUpperCase()} ${url} | Status: ${status} | Message: ${message}`, { requestId });
    } else {
      // Preservamos o stack trace original passando o objeto error completo para o logger
      logger.error(
        `API Error [${errorContext}]: ${method?.toUpperCase()} ${url} | Status: ${status} | Duration: ${duration}ms`,
        error,
        sanitizedError
      );
    }

    if (__DEV__) {
      console.error('--- [DEV] Detalhes do Erro da API ---');
      console.error('URL:', `${method?.toUpperCase()} ${url}`);
      console.error('Status:', status);
      console.error('Resposta:', JSON.stringify(response?.data, null, 2));
      console.error('-------------------------------------');
    }
    
    // Trata erro 401 (Não autorizado / Sessão expirada)
    if (status === 401 && !config._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            config.headers.Authorization = `Bearer ${token}`;
            return api(config);
          })
          .catch((err) => Promise.reject(err));
      }

      config._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await carregarRefreshToken();
        if (!refreshToken) throw new Error('No refresh token available');

        logger.info('[API.401] Tentando renovar sessão via Refresh Token...');

        // Chamada direta ao axios para evitar interceptor infinito
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { token: newToken, refreshToken: newRefreshToken } = response.data;

        // Atualiza a sessão no storage
        const sessaoAtual = await carregarSessao();
        if (sessaoAtual) {
          await salvarSessao({
            ...sessaoAtual,
            token: newToken,
            refreshToken: newRefreshToken
          });
        }

        processQueue(null, newToken);
        isRefreshing = false;

        config.headers.Authorization = `Bearer ${newToken}`;
        return api(config);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        logger.warn(`[API.401] Refresh falhou ou indisponível. Limpando sessão na rota: ${url}`);
        await limparSessao();

        if (typeof window !== 'undefined' && (window as any).onSessionExpired) {
          (window as any).onSessionExpired();
        }
        return Promise.reject(refreshError);
      }
    }

    // Trata erro 403 (Proibido / Sem permissão)
    if (status === 403) {
      logger.warn(`[API.403] Acesso proibido à rota: ${url}`);
      // Aqui poderíamos emitir um alerta global de "Permissão insuficiente"
    }

    return Promise.reject(error);
  }
);

/**
 * Busca a lista de filiados.
 * A API retornará os campos de acordo com o perfil do usuário logado.
 */
export const getFiliados = async (params?: any) => {
  const response = await api.get('/api/filiados', { params });
  return response.data.filiados || response.data || [];
};

export const criarFiliado = async (filiadoData) => {
  return await api.post('/api/filiados', filiadoData);
};

export const atualizarFiliado = async (id, filiadoData) => {
  if (__DEV__) {
    console.log('--- [DEV] Payload para atualizarFiliado ---');
    console.log('ID:', id);
    console.log('Payload:', JSON.stringify(filiadoData, null, 2));
    console.log('-------------------------------------------');
  }
  return await api.put(`/api/filiados/${id}`, filiadoData);
};

export const arquivarFiliado = async (id, motivo) => {
  return await api.post(`/api/filiados/${id}/arquivar`, { motivo });
};

export const desarquivarFiliado = async (id, motivo) => {
  return await api.post(`/api/filiados/${id}/desarquivar`, { motivo });
};

export default api;
