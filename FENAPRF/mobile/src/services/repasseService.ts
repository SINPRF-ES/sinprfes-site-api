import apiService from './apiService';
import { logger } from '../infra/logger';

export interface LocalidadeRepasse {
  lotacao: string;
  responsavelId: number | null;
  responsavelNome: string | null;
  responsavelCpf: string | null;
  usersAtivos: number;
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
  lotacao?: string;
  perfil_acesso?: string;
  situacao?: string;
  arquivado_em?: string | null;
}

const repasseService = {
  getRepasseAno: async (year: number): Promise<RepasseAnoResponse> => {
    try {
      logger.info('REPASSE_API_CALL', { fn: 'getRepasseAno', year });
      const response = await apiService.get(`/api/repasse?year=${year}`);
      const res = response.data;

      logger.info('REPASSE_API_OK', {
        fn: 'getRepasseAno',
        hasMeses: Array.isArray(res?.meses),
        totalType: typeof res?.totalAcumuladoGeral
      });

      return res;
    } catch (error: any) {
      logger.error('REPASSE_API_ERR', error, {
        fn: 'getRepasseAno',
        year,
        statusCode: error.response?.status
      });
      throw error;
    }
  },

  updateRepasseMes: async (year: number, month: number, perCapita: number, localidades: any[]): Promise<any> => {
    try {
      logger.info('REPASSE_API_CALL', { fn: 'updateRepasseMes', year, month });
      const response = await apiService.post('/api/repasse', {
        year,
        month,
        perCapita,
        localidades
      });
      logger.info('REPASSE_API_OK', { fn: 'updateRepasseMes' });
      return response.data;
    } catch (error: any) {
      logger.error('REPASSE_API_ERR', error, {
        fn: 'updateRepasseMes',
        year,
        month,
        statusCode: error.response?.status
      });
      throw error;
    }
  },

  listarResponsaveis: async (lotacao?: string): Promise<Responsavel[]> => {
    try {
      logger.info('REPASSE_API_CALL', { fn: 'listarResponsaveis', lotacao });
      const url = lotacao ? `/api/repasse/responsaveis?lotacao=${encodeURIComponent(lotacao)}` : '/api/repasse/responsaveis';
      const response = await apiService.get(url);

      // Suporta retorno direto ou dentro de .responsaveis, garantindo sempre um array
      const data = response.data?.responsaveis ?? response.data ?? [];

      if (!Array.isArray(data)) {
        logger.error('REPASSE_API_ERR', new Error('Data is not an array'), { fn: 'listarResponsaveis', data });
        return [];
      }

      logger.info('REPASSE_API_OK', { fn: 'listarResponsaveis', count: data.length });
      return data;
    } catch (error: any) {
      logger.error('REPASSE_API_ERR', error, {
        fn: 'listarResponsaveis',
        statusCode: error.response?.status
      });
      return [];
    }
  }
};

export default repasseService;
