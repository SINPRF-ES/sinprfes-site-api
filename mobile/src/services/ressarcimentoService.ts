import api from './apiService';

export const criarRessarcimento = async (formData: FormData) => {
  return await api.post('/api/ressarcimentos', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};
