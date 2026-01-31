import apiService from './apiService';

export interface LocalidadeRepasse {
  lotacao: string;
  responsavelId: number | null;
  responsavelNome: string | null;
  responsavelCpf: string | null;
  filiadosAtivos: number;
  prfTotal: number;
  percentual: number | null;
  creditoMes: number;
  reembolsoMes: number;
  acumuladoAno: number;
}

export interface MesRepasse {
  month: number;
  perCapita: number;
  localidades: LocalidadeRepasse[];
  totalRepasseMes: number;
}

export interface RepasseAnoResponse {
  success: boolean;
  year: number;
  meses: MesRepasse[];
  totalAcumuladoGeral: number;
}

export interface Responsavel {
  id: number;
  nome: string;
  cpf: string;
}

const repasseService = {
  getRepasseAno: async (year: number): Promise<RepasseAnoResponse> => {
    const response = await apiService.get(`/api/repasse?year=${year}`);
    console.info('[REPASSE][SERVICE][RAW]', response.data);
    console.info('[REPASSE][SERVICE][SHAPE]', {
      meses: response.data?.meses,
      totalAcumuladoGeral: response.data?.totalAcumuladoGeral,
    });
    return response.data;
  },

  updateRepasseMes: async (year: number, month: number, perCapita: number, localidades: any[]): Promise<any> => {
    const response = await apiService.post('/api/repasse', {
      year,
      month,
      perCapita,
      localidades
    });
    return response.data;
  },

  listarResponsaveis: async (): Promise<Responsavel[]> => {
    try {
      const response = await apiService.get('/api/repasse/responsaveis');
      console.info('[REPASSE][SERVICE][RESPONSAVEIS][RAW]', response.data);
      // Suporta retorno direto ou dentro de .responsaveis, garantindo sempre um array
      const data = response.data?.responsaveis ?? response.data ?? [];
      if (!Array.isArray(data)) {
        console.error('[REPASSE][SERVICE][RESPONSAVEIS][FATAL] data não é array', data);
        return [];
      }
      return data;
    } catch (error) {
      console.error('[REPASSE][API][responsaveis]', error);
      return [];
    }
  }
};

export default repasseService;
