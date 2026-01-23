import api from './apiService';
import { logError } from '../infra/logger';

export const getMinhaInscricaoJogos = async () => {
  try {
    const response = await api.get('/api/jogos/inscricao');
    return response.data;
  } catch (err) {
    logError('Service.getMinhaInscricaoJogos', err);
    throw err;
  }
};

export const registrarInscricaoJogos = async (dados: any) => {
  try {
    const response = await api.post('/api/jogos/inscricao', dados);
    return response.data;
  } catch (err) {
    logError('Service.registrarInscricaoJogos', err, { keys: Object.keys(dados) });
    throw err;
  }
};

export const cancelarInscricaoJogos = async () => {
  try {
    const response = await api.delete('/api/jogos/inscricao');
    return response.data;
  } catch (err) {
    logError('Service.cancelarInscricaoJogos', err);
    throw err;
  }
};

export const getInscricoesJogos = async () => {
  try {
    const response = await api.get('/api/jogos/inscricoes');
    return response.data.inscricoes || [];
  } catch (err) {
    logError('Service.getInscricoesJogos', err);
    throw err;
  }
};
