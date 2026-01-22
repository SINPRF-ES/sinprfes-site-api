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
    const duration = new Date().getTime() - config.meta?.requestStartedAt || 0;

    const status = response?.status;
    const contentType = response?.headers?.['content-type'] || '';
    let message = response?.data?.message || error.message;

    // Se a API retornar HTML (ex: 502 Proxy, Erro do Render, etc), extraímos um preview para o log
    if (contentType.includes('text/html')) {
      const htmlPreview = typeof response.data === 'string'
        ? response.data.replace(/<[^>]*>?/gm, '').substring(0, 200).trim()
        : 'HTML body is not a string';

      logger.error(`[DEBUG][API.HtmlError] ${method?.toUpperCase()} ${url} | Status: ${status} | Preview: ${htmlPreview}`);
      message = 'Servidor indisponível (Erro de Proxy/HTML). Por favor, tente novamente em instantes.';
    }

    // Sanitiza o objeto de erro para evitar logar dados sensíveis como o token
    const sanitizedError = {
      message: message,
      status: status,
      contentType: contentType,
      config: {
        url: error.config?.url,
        method: error.config?.method,
      },
      responseData: contentType.includes('application/json') ? response?.data : '[Non-JSON Content]',
    };

    logger.error(
      `API Error: ${method?.toUpperCase()} ${url} | Status: ${status} | Duration: ${duration}ms`,
      new Error(message),
      { status, ...sanitizedError }
    );

    if (__DEV__) {
      console.error('--- [DEV] Detalhes do Erro da API ---');
      console.error('URL:', `${method?.toUpperCase()} ${url}`);
      console.error('Status:', status);
      console.error('Resposta:', JSON.stringify(response?.data, null, 2));
      console.error('-------------------------------------');
    }
    
    // Trata erro 401 (Não autorizado / Sessão expirada)
    if (status === 401) {
      // Se for a rota /me e estiver falhando, é provável que o token seja inválido/expirado
      // Se for qualquer outra rota, limpamos a sessão para forçar novo login
      logger.warn(`[API.401] Sessão expirada ou inválida na rota: ${url}`);
      await limparSessao();

      // Notifica o sistema de que a sessão caiu (opcional, useAuth já lida com falha no /me)
      if (typeof window !== 'undefined' && (window as any).onSessionExpired) {
        (window as any).onSessionExpired();
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
export const getFiliados = async () => {
  const response = await api.get('/api/filiados');
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
