// mobile/src/services/analyticsService.ts
import api from './apiService';

export const getResumo = async () => {
  const response = await api.get('/api/analytics/resumo');
  return response.data;
};

export const syncCloudflare = async () => {
  const response = await api.post('/api/analytics/sync-cloudflare');
  return response.data;
};

const analyticsService = {
  getResumo,
  syncCloudflare,
};

export default analyticsService;
