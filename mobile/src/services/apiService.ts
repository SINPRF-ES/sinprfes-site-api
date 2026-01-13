// src/services/apiService.ts
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { carregarSessao, limparSessao } from './storageService';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para injetar o token JWT
api.interceptors.request.use(
  async (config) => {
    const sessao = await carregarSessao();
    if (sessao?.token) {
      config.headers.Authorization = `Bearer ${sessao.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas de erro
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (__DEV__) {
      // Log detalhado para depuração em ambiente de desenvolvimento
      const { config, response } = error;
      console.log(
        '[API Error]',
        `${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        `| Status: ${response?.status}`,
        `| Mensagem: ${response?.data?.message || error.message}`
      );
    }
    
    if (error.response?.status === 401) {
      // Limpa a sessão para deslogar o usuário.
      // A UI reagirá a `autenticado: false` e redirecionará para Login.
      await limparSessao();
    }
    return Promise.reject(error);
  }
);

export default api;
