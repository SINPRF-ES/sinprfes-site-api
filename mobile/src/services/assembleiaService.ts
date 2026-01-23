import api from './apiService';
import { Assembleia, AssembleiaEstado, VotacaoItem, Proposta } from '../types/assembleia';

export const getAssembleias = async (): Promise<Assembleia[]> => {
  const response = await api.get('/api/assembleias');
  return response.data;
};

export const getAssembleiaDetalhe = async (id: string): Promise<Assembleia> => {
  const response = await api.get(`/api/assembleias/${id}`);
  return response.data;
};

export const getAssembleiaEstado = async (id: string): Promise<AssembleiaEstado> => {
  const response = await api.get(`/api/assembleias/${id}/estado`);
  return response.data;
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
  await api.post(`/api/assembleias/${id}/checkin`, { token });
};

export const iniciarVotacao = async (id: string, dados: any): Promise<VotacaoItem> => {
  const response = await api.post(`/api/assembleias/${id}/votacao`, dados);
  return response.data;
};

export const enviarVoto = async (assembleiaId: string, votacaoId: string, opcao: 'SIM' | 'NAO'): Promise<void> => {
  await api.post(`/api/assembleias/${assembleiaId}/votacao/${votacaoId}/votar`, { opcao });
};

export const pedirPalavra = async (id: string): Promise<void> => {
  await api.post(`/api/assembleias/${id}/pedir-palavra`);
};

export const submeterProposta = async (id: string, dados: any): Promise<Proposta> => {
  const response = await api.post(`/api/assembleias/${id}/propostas`, dados);
  return response.data;
};

export const definirMesa = async (id: string, dados: { presidente_id: string; secretario_id: string }): Promise<void> => {
  await api.post(`/api/assembleias/${id}/mesa`, dados);
};
