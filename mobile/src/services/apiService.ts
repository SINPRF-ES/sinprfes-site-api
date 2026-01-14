// src/services/apiService.ts
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { carregarSessao, limparSessao } from './storageService';
import { logger } from '../infra/logger';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para injetar o token JWT e loggar a requisição
api.interceptors.request.use(
  async (config: any) => {
    const sessao = await carregarSessao();
    if (sessao?.token) {
      config.headers.Authorization = `Bearer ${sessao.token}`;
    }

    // Log da requisição
    const { method, url } = config;
    logger.info(`API Request: ${method?.toUpperCase()} ${url}`);
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
    const { config, status } = response;
    const { method, url } = config;
    const duration = new Date().getTime() - config.meta.requestStartedAt;

    logger.info(`API Response: ${method?.toUpperCase()} ${url} | Status: ${status} | Duration: ${duration}ms`);

    return response;
  },
  async (error) => {
    const { config, response } = error;
    const { method, url } = config;
    const duration = new Date().getTime() - config.meta.requestStartedAt;

    const status = response?.status;
    const message = response?.data?.message || error.message;

    // Sanitiza o objeto de erro para evitar logar dados sensíveis como o token
    const sanitizedError = {
      message: error.message,
      stack: error.stack,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: {
          // Lista segura de headers, excluindo 'Authorization'
          'Content-Type': error.config?.headers?.['Content-Type'],
        }
      },
      response: {
        status: error.response?.status,
        data: error.response?.data,
      },
    };

    logger.error(
      `API Error: ${method?.toUpperCase()} ${url} | Status: ${status} | Duration: ${duration}ms`,
      new Error(message), // Passa um novo objeto de erro sem o config original
      { status, responseData: sanitizedError.response.data }
    );
    
    // Evita logout imediato se a chamada inicial para /me falhar
    if (status === 401 && !config.url.endsWith('/me')) {
      logger.warn('Sessão expirada ou inválida. Limpando sessão...');
      await limparSessao();
      // O ideal é que o useAuth ou um listener reaja a esta limpeza.
    }
    return Promise.reject(error);
  }
);

/**
 * Busca a lista de filiados.
 * A API retornará os campos de acordo com o perfil do usuário logado.
 */
export const getFiliados = async () => {
  const response = await api.get('/api/filiados');
  return response.data.filiados || response.data || [];
};


export default api;
