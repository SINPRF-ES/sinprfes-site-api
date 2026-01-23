import api from './apiService';
import { Filiado } from '../types/filiado';
import { onlyDigits } from '../shared/format/formatters';

const unmaskFiliado = (filiado: Partial<Filiado>) => {
  const result = { ...filiado };
  if (result.cpf) result.cpf = onlyDigits(result.cpf);
  if (result.cep) result.cep = onlyDigits(result.cep);
  if (result.telefone1) result.telefone1 = onlyDigits(result.telefone1);
  if (result.telefone2) result.telefone2 = onlyDigits(result.telefone2);

  for (let i = 1; i <= 5; i++) {
    if (result[`dep${i}_cpf`]) result[`dep${i}_cpf`] = onlyDigits(result[`dep${i}_cpf`]);
  }
  return result;
};

export const getMe = async (): Promise<Filiado> => {
  const response = await api.get('/api/filiados/me');
  return response.data;
};

export const updateMe = async (data: Partial<Filiado>): Promise<Filiado> => {
  const response = await api.put('/api/filiados/me', unmaskFiliado(data));
  return response.data;
};

export const updateFiliado = async (id: string, data: Partial<Filiado>): Promise<Filiado> => {
  const response = await api.put(`/api/filiados/${id}`, unmaskFiliado(data));
  return response.data;
};
