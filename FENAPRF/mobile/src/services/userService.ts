import api from './apiService';
import { User } from '../types/user';
import { onlyDigits } from '../shared/format/formatters';

const unmaskUser = (user: Partial<User>) => {
  const result = { ...user };
  if (result.cpf) result.cpf = onlyDigits(result.cpf);
  if (result.cep) result.cep = onlyDigits(result.cep);
  if (result.telefone1) result.telefone1 = onlyDigits(result.telefone1);
  if (result.telefone2) result.telefone2 = onlyDigits(result.telefone2);

  return result;
};

export const getMe = async (): Promise<User> => {
  const response = await api.get('/api/users/me');
  return response.data;
};

export const getUserById = async (id: string): Promise<User> => {
  const response = await api.get(`/api/users/${id}`);
  return response.data;
};

export const updateMe = async (data: Partial<User>): Promise<User> => {
  const response = await api.put('/api/users/me', unmaskUser(data));
  return response.data;
};

export const updateUser = async (id: string, data: Partial<User>): Promise<User> => {
  const response = await api.put(`/api/users/${id}`, unmaskUser(data));
  return response.data;
};
