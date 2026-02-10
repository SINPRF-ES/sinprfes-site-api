import api from './apiService';
import { logger } from '../infra/logger';

export const getEventosLogistica = async (status?: string) => {
    try {
        const response = await api.get('/api/logistica/eventos', { params: { status } });
        return response.data;
    } catch (err) {
        logger.error('logisticaService.getEventos', err);
        throw err;
    }
};

export const encerrarEventoLogistica = async (id: string, justificativa: string) => {
    try {
        const response = await api.patch(`/api/logistica/eventos/${id}/encerrar`, { justificativa });
        return response.data;
    } catch (err) {
        logger.error('logisticaService.encerrarEvento', err);
        throw err;
    }
};

export const cancelarEventoLogistica = async (id: string, justificativa: string) => {
    try {
        const response = await api.patch(`/api/logistica/eventos/${id}/cancelar`, { justificativa });
        return response.data;
    } catch (err) {
        logger.error('logisticaService.cancelarEvento', err);
        throw err;
    }
};

export const criarEventoLogistica = async (dados: any) => {
    try {
        const response = await api.post('/api/logistica/eventos', dados);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.criarEvento', err);
        throw err;
    }
};

export const atualizarEventoLogistica = async (id: string, dados: any) => {
    try {
        const response = await api.put(`/api/logistica/eventos/${id}`, dados);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.atualizarEvento', err);
        throw err;
    }
};

export const getInscricoesLogistica = async (eventoId: string) => {
    try {
        const response = await api.get(`/api/logistica/eventos/${eventoId}/inscricoes`);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.getInscricoes', err);
        throw err;
    }
};

export const registrarMinhaInscricaoLogistica = async (dados: any) => {
    try {
        const response = await api.post('/api/logistica/inscricoes', dados);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.registrarInscricao', err);
        throw err;
    }
};

export const cancelarMinhaInscricaoLogistica = async (eventoId: string) => {
    try {
        const response = await api.delete(`/api/logistica/eventos/${eventoId}/minha-inscricao`);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.cancelarMinhaInscricao', err);
        throw err;
    }
};

export const atualizarInscricaoTerceiroLogistica = async (id: string, dados: any) => {
    try {
        const response = await api.put(`/api/logistica/inscricoes/${id}`, dados);
        return response.data;
    } catch (err) {
        logger.error('logisticaService.atualizarInscricaoTerceiro', err);
        throw err;
    }
};

export const cancelarInscricaoTerceiroLogistica = async (id: string, dados: any) => {
    try {
        const response = await api.delete(`/api/logistica/inscricoes/${id}`, { data: dados });
        return response.data;
    } catch (err) {
        logger.error('logisticaService.cancelarInscricaoTerceiro', err);
        throw err;
    }
};
