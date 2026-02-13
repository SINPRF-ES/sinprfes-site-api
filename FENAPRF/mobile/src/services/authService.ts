// src/services/authService.ts
import api from './apiService';
import type { User } from '../types/user';
import type { Sessao } from '../types/auth';
import { getStableDeviceId } from '../utils/deviceId';

interface LoginPayload {
  cpf: string;
  senha?: string;
  deviceId?: string;
}

/**
 * Autentica o membro com CPF e senha.
 */
export async function loginSindicato(
  payload: Pick<LoginPayload, 'cpf' | 'senha'>
): Promise<Sessao> {
  const deviceId = await getStableDeviceId();
  const { data } = await api.post<Sessao>('/api/auth/login', { ...payload, deviceId });
  return data;
}

/**
 * Busca os dados do membro logado.
 */
export async function buscarUserLogado(token?: string): Promise<User> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const { data } = await api.get<User>('/api/users/me', { headers });
  return data;
}

/**
 * Solicita o envio do e-mail de redefinição de senha.
 */
export async function solicitarResetSenha(cpf: string): Promise<{ message: string; email_destino: string | null }> {
  const { data } = await api.post('/api/senha/recuperar', { cpf });
  return data;
}

/**
 * Redefine a senha do membro.
 */
export async function resetarSenha(token: string, novaSenha: string): Promise<{ message: string }> {
  const { data } = await api.post('/api/senha/resetar', { token, novaSenha });
  return data;
}
