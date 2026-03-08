import api from './apiService';

export interface ConsultaProcessualItem {
  source: string | null;
  sourceLabel: string | null;
  processNumber: string | null;
  processClass: string | null;
  processTitle: string | null;
  parties: string | null;
  listLastMovementText: string | null;
  listLastMovementAt: string | null;
  lastMovement: string | null;
  lastMovementAt: string | null;
  rawLastMovementText: string | null;
  detailsUrl: string | null;
  providerMeta: Record<string, unknown>;
  institutional?: boolean;
}

export interface ConsultaProcessualSource {
  source: string;
  sourceLabel: string;
  status: 'success' | 'error' | 'skipped';
  count: number;
  items: ConsultaProcessualItem[];
  error?: {
    code?: string;
    message?: string;
  };
}

export interface ConsultaProcessualResponse {
  ok: boolean;
  queriedAt: string;
  cpfMasked?: string;
  documentMasked?: string;
  totalItems: number;
  items: ConsultaProcessualItem[];
  sources: ConsultaProcessualSource[];
  errors: Array<{ source?: string; code?: string; message?: string }>;
  message?: string;
  error?: string;
  mode?: 'personal' | 'institutional';
}

export async function consultarProcessosDoUsuarioLogado(mode: 'personal' | 'institutional' = 'personal'): Promise<ConsultaProcessualResponse> {
  const response = await api.get<ConsultaProcessualResponse>(`/api/consulta-processual/me?mode=${mode}`);
  return response.data;
}
