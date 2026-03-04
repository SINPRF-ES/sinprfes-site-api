// mobile/src/services/reportsService.ts
import api from './apiService';

export const generateReport = async (type: string, params: any) => {
  const response = await api.post('/api/reports/generate', { type, params });
  return response.data;
};

export const previewReport = async (type: string, params: any) => {
  const response = await api.post('/api/reports/preview', { type, params });
  return response.data;
};

export const getHistory = async () => {
  const response = await api.get('/api/reports/history');
  return response.data;
};

export const getEfetivoManual = async () => {
  const response = await api.get('/api/reports/efetivo-manual');
  return response.data;
};

export const upsertEfetivoManual = async (totais: Record<string, number>) => {
  const response = await api.put('/api/reports/efetivo-manual', { totais });
  return response.data;
};

const reportsService = {
  generateReport,
  previewReport,
  getHistory,
  getEfetivoManual,
  upsertEfetivoManual,
};

export default reportsService;
