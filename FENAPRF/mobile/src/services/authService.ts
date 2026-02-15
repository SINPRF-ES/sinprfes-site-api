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
export async function login(cpf: string, senha: string): Promise<Sessao> {
  const deviceId = await getStableDeviceId();
  const { data } = await api.post<Sessao>('/api/auth/login', { cpf, senha, deviceId });
  return data;
}

/**
 * Renova a sessão do membro usando o refresh token.
 */
export async function refreshSessao(refreshToken: string): Promise<any> {
  const deviceId = await getStableDeviceId();
  const { data } = await api.post('/api/auth/refresh', { refreshToken, deviceId });
  return data;
}

/**
 * Renova a sessão do membro usando o refresh token.
 */
export async function refreshSessao(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
  const deviceId = await getStableDeviceId();
  const { data } = await api.post('/api/auth/refresh', { refreshToken, deviceId });
  return data as { token: string; refreshToken: string };
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
