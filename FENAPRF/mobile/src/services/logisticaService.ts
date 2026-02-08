import api from './apiService';
import { logger } from '../infra/logger';

export interface LogisticaEvento {
  id: number;
  titulo: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  documento_link: string;
}

export interface LogisticaInscricao {
  id: number;
  evento_id: number;
  user_id: number;
  name: string;
  cargo: string;
  uf: string;
  cpf: string;
  telefone: string;
  email: string;
  data_chegada: string;
  data_saida: string;
  observacoes: string;
  justificativa?: string;
}

export const listarEventosLogistica = async (): Promise<LogisticaEvento[]> => {
  try {
    const response = await api.get('/api/logistica/eventos');
    return response.data;
  } catch (err) {
    logger.error('Service.listarEventosLogistica', err);
    throw err;
  }
};

export const cancelarEventoLogistica = async (id: number, justificativa: string) => {
  try {
    const response = await api.delete(`/api/logistica/eventos/${id}`, { data: { justificativa } });
    return response.data;
  } catch (err) {
    logger.error('Service.cancelarEventoLogistica', err);
    throw err;
  }
};

export const criarEventoLogistica = async (dados: any) => {
  try {
    const response = await api.post('/api/logistica/eventos', dados);
    return response.data;
  } catch (err) {
    logger.error('Service.criarEventoLogistica', err);
    throw err;
  }
};

export const atualizarEventoLogistica = async (id: number, dados: any) => {
  try {
    const response = await api.put(`/api/logistica/eventos/${id}`, dados);
    return response.data;
  } catch (err) {
    logger.error('Service.atualizarEventoLogistica', err);
    throw err;
  }
};

export const obterEventoLogistica = async (id: number): Promise<LogisticaEvento> => {
  try {
    const response = await api.get(`/api/logistica/eventos/${id}`);
    return response.data;
  } catch (err) {
    logger.error('Service.obterEventoLogistica', err);
    throw err;
  }
};

export const listarInscricoesLogistica = async (eventoId: number): Promise<LogisticaInscricao[]> => {
  try {
    const response = await api.get(`/api/logistica/eventos/${eventoId}/inscricoes`);
    return response.data;
  } catch (err) {
    logger.error('Service.listarInscricoesLogistica', err);
    throw err;
  }
};

export const inscreverProprioLogistica = async (eventoId: number, dados: any) => {
  try {
    const response = await api.post(`/api/logistica/eventos/${eventoId}/inscrever`, dados);
    return response.data;
  } catch (err) {
    logger.error('Service.inscreverProprioLogistica', err);
    throw err;
  }
};

export const atualizarInscricaoLogistica = async (id: number, dados: any) => {
  try {
    const response = await api.put(`/api/logistica/inscricoes/${id}`, dados);
    return response.data;
  } catch (err) {
    logger.error('Service.atualizarInscricaoLogistica', err);
    throw err;
  }
};

export const cancelarInscricaoLogistica = async (id: number, justificativa?: string) => {
  try {
    const response = await api.delete(`/api/logistica/inscricoes/${id}`, { data: { justificativa } });
    return response.data;
  } catch (err) {
    logger.error('Service.cancelarInscricaoLogistica', err);
    throw err;
  }
};
