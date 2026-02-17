// src/services/authService.ts
import api from "./apiService";
import type { Usuario } from "../types/usuario";
import { getStableDeviceId } from "../utils/deviceId"; // ajuste o path se necessário

interface LoginPayload {
  cpf: string;
  senha?: string;
  codigo?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  requer2fa?: boolean;
  // Se o seu backend já retornar user no login/refresh, descomente:
  // user?: Usuario;
}

/**
 * Autentica o usuário com CPF e senha.
 */
export async function login(payload: Pick<LoginPayload, "cpf" | "senha">): Promise<AuthResponse> {
  const deviceId = await getStableDeviceId();
  const { data } = await api.post<AuthResponse>("/api/auth/login", { ...payload, deviceId });
  return data;
}

/**
 * LEGADO (remover depois): alias para evitar quebrar imports antigos.
 */
export const loginSindicato = login;

/**
 * Valida o código de autenticação de dois fatores (2FA).
 */
export async function loginCom2FA(payload: Required<LoginPayload>): Promise<AuthResponse> {
  const deviceId = await getStableDeviceId();
  const { data } = await api.post<AuthResponse>("/api/auth/login/2fa", {
    cpf: payload.cpf,
    senha: payload.senha,
    code: payload.codigo,
    deviceId,
  });
  return data;
}

/**
 * Renova o access token usando um refresh token.
 * IMPORTANTE: backend pode exigir deviceId para validar sessão do dispositivo.
 */
export async function refreshSessao(refreshToken: string): Promise<AuthResponse> {
  const deviceId = await getStableDeviceId();
  const { data } = await api.post<AuthResponse>("/api/auth/refresh", { refreshToken, deviceId });
  return data;
}

/**
 * Busca os dados do usuário logado.
 * PADRONIZE este endpoint com o backend real:
 * - se backend expõe /api/users/me, troque aqui.
 * - se expõe /api/auth/me, mantenha.
 */
export async function buscarUsuarioLogado(token?: string): Promise<Usuario> {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const { data } = await api.get<Usuario>("/api/auth/me", { headers });
  return data;
}

/**
 * Solicita o envio do e-mail de redefinição de senha para o CPF informado.
 */
export async function solicitarResetSenha(
  cpf: string
): Promise<{ message: string; email_destino: string | null }> {
  const { data } = await api.post("/api/senha/recuperar", { cpf });
  return data;
}

/**
 * Redefine a senha do usuário usando o token recebido por e-mail.
 */
export async function resetarSenha(
  token: string,
  novaSenha: string
): Promise<{ message: string }> {
  const { data } = await api.post("/api/senha/resetar", { token, novaSenha });
  return data;
}
