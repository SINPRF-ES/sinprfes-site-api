import api from './apiService';
import { Assembleia, AssembleiaEstado, VotacaoItem, Proposta } from '../types/assembleia';
import { logError } from '../infra/logger';

export const getAssembleias = async (): Promise<Assembleia[]> => {
  try {
    const response = await api.get('/api/assembleias');
    return response.data;
  } catch (err) {
    logError('ASSEMBLEIAS_GET_FAILED', err);
    throw err;
  }
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
  try {
    const response = await api.post('/api/assembleias', dados);
    return response.data;
  } catch (err) {
    logError('ASSEMBLEIAS_CREATE_FAILED', err, { keys: Object.keys(dados) });
    throw err;
  }
};

export const abrirAssembleia = async (id: string): Promise<void> => {
  await api.post(`/api/assembleias/${id}/abrir`);
};

export const iniciarExecucao = async (id: string): Promise<void> => {
  await api.post(`/api/assembleias/${id}/iniciar-execucao`);
};

export const encerrarAssembleia = async (id: string): Promise<void> => {
  await api.post(`/api/assembleias/${id}/encerrar`);
};

export const gerarTokenQuorum = async (id: string, dados: { tipo_chamada: string; observacao?: string }): Promise<{
  token: string;
  quorum_id: string;
  quorumVigente?: any;
  presente?: boolean;
  tokenAtivo?: boolean;
  issuedAt?: string;
}> => {
  const response = await api.post(`/api/assembleias/${id}/token`, dados);
  return response.data;
};

export const atualizarQuorum = async (id: string): Promise<any> => {
  try {
    const response = await api.post(`/api/assembleias/${id}/quorum/atualizar`);
    return response.data;
  } catch (err) {
    logError('ASSEMBLEIAS_QUORUM_UPDATE_FAILED', err, { id });
    throw err;
  }
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
  const response = await api.post(`/api/assembleias/${id}/votacoes`, dados);
  return response.data;
};

export const enviarVoto = async (assembleiaId: string, votacaoId: string, opcao: 'SIM' | 'NAO'): Promise<void> => {
  try {
    await api.post(`/api/assembleias/${assembleiaId}/votacoes/${votacaoId}/voto`, { voto: opcao });
  } catch (err) {
    logError('Service.enviarVoto', err, { assembleiaId, votacaoId, opcao });
    throw err;
  }
};

export const pedirPalavra = async (id: string): Promise<void> => {
  await api.post(`/api/assembleias/${id}/pedir-palavra`);
};

export const concederPalavra = async (id: string, pid: string): Promise<void> => {
  await api.post(`/api/assembleias/${id}/pedidos/${pid}/conceder`);
};

export const submeterProposta = async (id: string, dados: any): Promise<Proposta> => {
  const response = await api.post(`/api/assembleias/${id}/propostas`, dados);
  return response.data;
};

export const iniciarVotacaoProposta = async (id: string, prid: string): Promise<VotacaoItem> => {
  const response = await api.post(`/api/assembleias/${id}/propostas/${prid}/votar`);
  return response.data;
};

export const encerrarVotacao = async (assembleiaId: string, votacaoId: string): Promise<void> => {
  await api.post(`/api/assembleias/${assembleiaId}/votacoes/${votacaoId}/encerrar`);
};

export const solicitarRelatorio = async (id: string): Promise<{ request_id: string; auth_code: string }> => {
  const response = await api.post(`/api/assembleias/${id}/relatorio`);
  return response.data;
};

export const uploadEdital = async (formData: FormData): Promise<{ url: string }> => {
  const response = await api.post('/api/assembleias/upload-edital', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const definirMesa = async (id: string, dados: { presidente_user_id: string; secretario_user_id: string }): Promise<void> => {
  await api.post(`/api/assembleias/${id}/mesa`, dados);
};

export const substituirMesa = async (id: string, dados: { presidente_user_id: string; secretario_user_id: string; justificativa: string }): Promise<void> => {
  await api.post(`/api/assembleias/${id}/mesa/substituir`, dados);
};
