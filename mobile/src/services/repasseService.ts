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
    const response = await apiService.get('/api/repasse/responsaveis');
    // Suporta retorno direto ou dentro de .responsaveis, garantindo sempre um array
    return response.data?.responsaveis ?? response.data ?? [];
  }
};

export default repasseService;
