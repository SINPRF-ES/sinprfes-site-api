import api from '../../../services/apiService';
import { Assembleia, Votacao, Quorum } from '../types';

const assembleiaService = {
  async listar(): Promise<Assembleia[]> {
    const { data } = await api.get('/api/assembleias');
    return data;
  },

  async buscarPorId(id: string): Promise<Assembleia> {
    const { data } = await api.get(`/api/assembleias/${id}`);
    return data;
  },

  async buscarEstadoCompleto(id: string): Promise<any> {
    const { data } = await api.get(`/api/assembleias/${id}/estado`);
    return data;
  },

  async checkin(assembleiaId: string, token: string): Promise<void> {
    await api.post(`/api/assembleias/${assembleiaId}/checkin`, { token });
  },

  async pedirPalavra(assembleiaId: string): Promise<void> {
    await api.post(`/api/assembleias/${assembleiaId}/pedir-palavra`);
  },

  async cancelarPalavra(assembleiaId: string): Promise<void> {
    await api.delete(`/api/assembleias/${assembleiaId}/pedir-palavra`);
  },

  async criarProposta(assembleiaId: string, dados: { titulo: string; descricao: string }): Promise<void> {
    await api.post(`/api/assembleias/${assembleiaId}/propostas`, dados);
  },

  async retirarProposta(assembleiaId: string, propostaId: string): Promise<void> {
    await api.delete(`/api/assembleias/${assembleiaId}/propostas/${propostaId}`);
  },

  async votar(assembleiaId: string, votacaoId: string, voto: 'SIM' | 'NAO'): Promise<void> {
    await api.post(`/api/assembleias/${assembleiaId}/votacao/${votacaoId}/votar`, { voto });
  },

  // DIRETORIA
  async abrir(id: string): Promise<Assembleia> {
    const { data } = await api.patch(`/api/assembleias/${id}/abrir`);
    return data;
  },

  async encerrar(id: string): Promise<Assembleia> {
    const { data } = await api.patch(`/api/assembleias/${id}/encerrar`);
    return data;
  },

  async gerarQuorum(id: string): Promise<any> {
    const { data } = await api.post(`/api/assembleias/${id}/token`);
    // Compatibilidade: se não vier valido_ate, calcula 10min a partir de issuedAt
    if (!data.valido_ate && data.issuedAt) {
      data.valido_ate = new Date(new Date(data.issuedAt).getTime() + 10 * 60 * 1000).toISOString();
    }
    return data;
  },

  async atualizarQuorum(id: string): Promise<any> {
    const { data } = await api.post(`/api/assembleias/${id}/quorum/atualizar`);
    return data;
  },

  async iniciarVotacao(id: string, dados: { titulo: string; descricao: string; duracao_minutos: number, proposta_id?: string }): Promise<Votacao> {
    const { data } = await api.post(`/api/assembleias/${id}/votacao`, dados);
    return data;
  },

  async definirMesa(id: string, dados: { filiado_id: string; cargo: 'PRESIDENTE' | 'SECRETARIO' }): Promise<void> {
    await api.post(`/api/assembleias/${id}/mesa`, dados);
  }
};

export default assembleiaService;
