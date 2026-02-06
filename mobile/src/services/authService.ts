// src/services/authService.ts
import api from './apiService';
import type { Usuario } from '../types/usuario';

interface LoginPayload {
  cpf: string;
  senha?: string;
  codigo?: string;
}

interface LoginResponse {
  token: string;
  refreshToken?: string;
  requer2fa?: boolean;
}

/**
 * Autentica o usuário com CPF e senha.
 */
export async function loginSindicato(
  payload: Pick<LoginPayload, 'cpf' | 'senha'>
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', payload);
  return data;
}

/**
 * Valida o código de autenticação de dois fatores (2FA).
 */
export async function loginCom2FA(payload: Required<LoginPayload>): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/login/2fa', {
    cpf: payload.cpf,
    senha: payload.senha,
    code: payload.codigo,
  });
  return data;
}

/**
 * Renova o access token usando um refresh token.
 */
export async function refreshSessao(refreshToken: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/refresh', { refreshToken });
  return data;
}

/**
 * Busca os dados do usuário logado.
 */
export async function buscarUsuarioLogado(token?: string): Promise<Usuario> {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const { data } = await api.get<Usuario>('/api/auth/me', { headers });
  return data;
}

/**
 * Solicita o envio do e-mail de redefinição de senha para o CPF informado.
 */
export async function solicitarResetSenha(cpf: string): Promise<{ message: string; email_destino: string | null }> {
  const { data } = await api.post('/api/senha/recuperar', { cpf });
  return data;
}
