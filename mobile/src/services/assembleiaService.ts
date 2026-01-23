import api from './apiService';
import { Assembleia, AssembleiaEstado, VotacaoItem, Proposta } from '../types/assembleia';
import { logError } from '../infra/logger';

export const getAssembleias = async (): Promise<Assembleia[]> => {
  const response = await api.get('/api/assembleias');
  return response.data;
};

export const getAssembleiaDetalhe = async (id: string): Promise<Assembleia> => {
  const response = await api.get(`/api/assembleias/${id}`);
  return response.data;
};

export const getAssembleiaEstado = async (id: string): Promise<AssembleiaEstado> => {
  try {
    const response = await api.get(`/api/assembleias/${id}/estado`);
    return response.data;
  } catch (err) {
    logError('Service.getAssembleiaEstado', err, { id });
    throw err;
  }
};

export const criarAssembleia = async (dados: Partial<Assembleia>): Promise<Assembleia> => {
  const response = await api.post('/api/assembleias', dados);
  return response.data;
};

export const abrirAssembleia = async (id: string): Promise<void> => {
  await api.patch(`/api/assembleias/${id}/abrir`);
};

export const encerrarAssembleia = async (id: string): Promise<void> => {
  await api.patch(`/api/assembleias/${id}/encerrar`);
};

export const gerarTokenQuorum = async (id: string): Promise<{ token: string }> => {
  const response = await api.post(`/api/assembleias/${id}/quorum`);
  return response.data;
};

export const realizarCheckin = async (id: string, token: string): Promise<void> => {
  try {
    await api.post(`/api/assembleias/${id}/checkin`, { token });
  } catch (err) {
    logError('Service.realizarCheckin', err, { id });
    throw err;
  }
};

export const iniciarVotacao = async (id: string, dados: any): Promise<VotacaoItem> => {
  const response = await api.post(`/api/assembleias/${id}/votacao`, dados);
  return response.data;
};

export const enviarVoto = async (assembleiaId: string, votacaoId: string, opcao: 'SIM' | 'NAO'): Promise<void> => {
  try {
    // FIX: Backend espera campo "voto"
    await api.post(`/api/assembleias/${assembleiaId}/votacao/${votacaoId}/votar`, { voto: opcao });
  } catch (err) {
    logError('Service.enviarVoto', err, { assembleiaId, votacaoId, opcao });
    throw err;
  }
};

export const pedirPalavra = async (id: string): Promise<void> => {
  await api.post(`/api/assembleias/${id}/pedir-palavra`);
};

export const submeterProposta = async (id: string, dados: any): Promise<Proposta> => {
  const response = await api.post(`/api/assembleias/${id}/propostas`, dados);
  return response.data;
};

export const uploadEdital = async (formData: FormData): Promise<{ url: string }> => {
  const response = await api.post('/api/assembleias/upload-edital', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const definirMesa = async (id: string, dados: { presidente_id: string; secretario_id: string }): Promise<void> => {
  await api.post(`/api/assembleias/${id}/mesa`, dados);
};
