import apiService from './apiService';
import { logger } from '../infra/logger';

export interface RepasseEvento {
  id: number;
  titulo: string;
  data_evento: string;
  data_limite_alocacao: string;
  status: string;
  deleted_at?: string | null;
  delete_reason?: string | null;
  deleted_by_user_id?: number | null;
  deleted_by_nome?: string | null;
}

export interface RepasseResumo {
  config: {
    ano_ref: number;
    perCapitaGlobalAnual: number;
    perCapitaApoioOperacionalAnual: number;
    perCapitaEventoAtivoAnual: number;
    perCapitaEventoVeteranoAnual: number;
  };
  apoioPorLotacao: Array<{
    lotacao: string;
    qtdAtivos: number;
    creditoApoioOperacional: number;
    debitosApoioOperacional: number;
    saldoApoioOperacional: number;
  }>;
  recursoNaoAlocadoTotal: number;
  alocacoesPorEvento: Array<{
    evento: RepasseEvento;
    totalAlocado: number;
    contagemAtivos: number;
    contagemVeteranos: number;
    itens: Array<{ filiado_id: number; nome: string; situacao: string; valorAlocado: number }>;
  }>;
  alocacoesCanceladas?: Array<{
    evento: RepasseEvento;
    totalAlocado: number;
    contagemAtivos: number;
    contagemVeteranos: number;
    itens: Array<{ filiado_id: number; nome: string; situacao: string; valorAlocado: number }>;
  }>;
}

export interface Responsavel {
  id: number;
  nome: string;
  cpf: string;
  lotacao?: string;
  perfil_acesso?: string;
  situacao?: string;
  arquivado_em?: string | null;
}

export interface RepasseMovimento {
  id: number;
  ano_ref: number;
  lotacao_id: string;
  tipo: string;
  valor: number;
  valor_centavos?: number;
  valorCentavos?: number;
  observacao: string;
  created_at: string;
  created_by_user_id: number;
  created_by_nome?: string;
}

const repasseService = {
  getResumo: async (ano: number): Promise<RepasseResumo> => {
    const response = await apiService.get(`/api/repasse/resumo?ano=${ano}`);
    return response.data;
  },

  listarEventos: async (ano: number, status?: string, includeCancelados = false): Promise<RepasseEvento[]> => {
    const params = new URLSearchParams({ ano: String(ano) });
    if (status) params.set('status', status);
    if (includeCancelados) params.set('includeCancelados', '1');
    const response = await apiService.get(`/api/repasse/eventos?${params.toString()}`);
    return response.data?.eventos || [];
  },

  criarEvento: async (payload: any): Promise<any> => {
    const response = await apiService.post('/api/repasse/eventos', payload);
    return response.data;
  },

  atualizarEvento: async (eventoId: number, payload: any): Promise<any> => {
    const response = await apiService.put(`/api/repasse/eventos/${eventoId}`, payload);
    return response.data;
  },

  alocarMeuRecurso: async (eventoId: number): Promise<any> => {
    const response = await apiService.post(`/api/repasse/eventos/${eventoId}/alocar`);
    return response.data;
  },


  retirarMinhaAlocacao: async (eventoId: number, payload?: { justificativa?: string }): Promise<any> => {
    const response = await apiService.post(`/api/repasse/eventos/${eventoId}/desalocar`, payload || {});
    return response.data;
  },

  retirarAlocacaoGestao: async (eventoId: number, payload: { filiado_id: number; justificativa?: string }): Promise<any> => {
    const response = await apiService.post(`/api/repasse/eventos/${eventoId}/desalocar-gestao`, payload);
    return response.data;
  },

  excluirEvento: async (eventoId: number, payload: { justificativa: string }): Promise<any> => {
    const response = await apiService.delete(`/api/repasse/eventos/${eventoId}`, { data: payload });
    return response.data;
  },

  listarResponsaveis: async (q = ''): Promise<Responsavel[]> => {
    try {
      logger.info('REPASSE_API_CALL', { fn: 'listarResponsaveis', q });
      const url = `/api/repasse/responsaveis?q=${encodeURIComponent(q || '')}`;
      const response = await apiService.get(url);
      const data = response.data?.responsaveis ?? response.data ?? [];
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      logger.error('REPASSE_API_ERR', error, { fn: 'listarResponsaveis', statusCode: error.response?.status });
      return [];
    }
  },

  listarMovimentos: async (ano: number, lotacaoId: string): Promise<RepasseMovimento[]> => {
    const response = await apiService.get(`/api/repasse/movimentos?ano=${ano}&lotacaoId=${encodeURIComponent(lotacaoId)}`);
    return response.data?.movimentos || [];
  },

  criarMovimento: async (payload: { ano_ref: number; lotacao_id: string; valor_centavos: number; observacao: string }): Promise<any> => {
    const response = await apiService.post('/api/repasse/movimentos', payload);
    return response.data;
  },

  atualizarMovimento: async (id: number, payload: { valor_centavos: number; observacao: string }): Promise<any> => {
    const response = await apiService.put(`/api/repasse/movimentos/${id}`, payload);
    return response.data;
  },

  excluirMovimento: async (id: number, payload: { justificativa: string }): Promise<any> => {
    const response = await apiService.delete(`/api/repasse/movimentos/${id}`, { data: payload });
    return response.data;
  }
};

export default repasseService;
