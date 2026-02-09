import api from './apiService';
import { logger } from '../infra/logger';

export const getEventosLogistica = async (status?: string) => {
    try {
        const response = await api.get('/logistica/eventos', { params: { status } });
        return response.data;
    } catch (err) {
        logger.error('logisticaService.getEventos', err);
        throw err;
    }
};

export const criarEventoLogistica = async (dados: any) => {
    try {
        const response = await api.post('/logistica/eventos', dados);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.criarEvento', err);
        throw err;
    }
};

export const atualizarEventoLogistica = async (id: string, dados: any) => {
    try {
        const response = await api.put(`/logistica/eventos/${id}`, dados);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.atualizarEvento', err);
        throw err;
    }
};

export const getInscricoesLogistica = async (eventoId: string) => {
    try {
        const response = await api.get(`/logistica/eventos/${eventoId}/inscricoes`);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.getInscricoes', err);
        throw err;
    }
};

export const registrarMinhaInscricaoLogistica = async (dados: any) => {
    try {
        const response = await api.post('/logistica/inscricoes', dados);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.registrarInscricao', err);
        throw err;
    }
};

export const cancelarMinhaInscricaoLogistica = async (eventoId: string) => {
    try {
        const response = await api.delete(`/logistica/eventos/${eventoId}/minha-inscricao`);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.cancelarMinhaInscricao', err);
        throw err;
    }
};

export const atualizarInscricaoTerceiroLogistica = async (id: string, dados: any) => {
    try {
        const response = await api.put(`/logistica/inscricoes/${id}`, dados);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.atualizarInscricaoTerceiro', err);
        throw err;
    }
};

export const cancelarInscricaoTerceiroLogistica = async (id: string, dados: any) => {
    try {
        const response = await api.delete(`/logistica/inscricoes/${id}`, { data: dados });
        return response.data;
    } catch (err) {
        logger.error('logisticaService.cancelarInscricaoTerceiro', err);
        throw err;
    }
};
