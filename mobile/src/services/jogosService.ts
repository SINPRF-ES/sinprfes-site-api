import api from './apiService';

export const getMinhaInscricaoJogos = async () => {
  const response = await api.get('/api/jogos/inscricao');
  return response.data;
};

export const registrarInscricaoJogos = async (dados: any) => {
  const response = await api.post('/api/jogos/inscricao', dados);
  return response.data;
};

export const cancelarInscricaoJogos = async () => {
  const response = await api.delete('/api/jogos/inscricao');
  return response.data;
};

export const getInscricoesJogos = async () => {
  const response = await api.get('/api/jogos/inscricoes');
  return response.data.inscricoes || [];
};
