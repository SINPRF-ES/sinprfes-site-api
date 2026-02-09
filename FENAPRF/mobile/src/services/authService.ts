// src/services/authService.ts
import api from './apiService';
import type { User } from '../types/user';

interface LoginPayload {
  cpf: string;
  senha?: string;
}

interface LoginResponse {
  token: string;
}

/**
 * Autentica o membro com CPF e senha.
 */
export async function loginSindicato(
  payload: Pick<LoginPayload, 'cpf' | 'senha'>
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', payload);
  return data;
}


/**
 * Busca os dados do membro logado.
 */
export async function buscarUserLogado(token?: string): Promise<User> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // No FENAPRF, usamos /api/users/me
  const { data } = await api.get<User>('/api/users/me', { headers });
  return data;
}

/**
 * Solicita o envio do e-mail de redefinição de senha para o CPF informado.
 */
export async function solicitarResetSenha(cpf: string): Promise<{ message: string; email_destino: string | null }> {
  const { data } = await api.post('/api/senha/recuperar', { cpf });
  return data;
}

/**
 * Redefine a senha do membro utilizando o token enviado por e-mail.
 */
export async function resetarSenha(token: string, novaSenha: string): Promise<{ message: string }> {
  const { data } = await api.post('/api/senha/resetar', { token, novaSenha });
  return data;
}
