// src/services/eventosService.ts
import { API_BASE_URL } from "../config/api";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

const DEFAULT_TIMEOUT_MS = 15000;

async function apiRequest<T>(
  path: string,
  method: HttpMethod,
  token: string,
  body?: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const raw = await res.text();

    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      // Pode vir HTML (erro do Express) ou texto puro
      data = raw;
    }

    if (!res.ok) {
      const payload = data as ApiErrorPayload | string | null;

      const msg =
        (payload &&
          typeof payload === "object" &&
          ("error" in payload || "message" in payload) &&
          (payload.error || payload.message)) ||
        (typeof payload === "string" && payload.trim().length > 0
          ? payload
          : null) ||
        `HTTP ${res.status} ao chamar ${path}`;

      throw new Error(String(msg));
    }

    return data as T;
  } catch (err: any) {
    // Timeout / rede / DNS / conexão recusada etc.
    if (err?.name === "AbortError") {
      throw new Error(`Timeout (${timeoutMs}ms) ao chamar ${path}`);
    }
    const msg = err?.message || String(err);
    // Padroniza mensagem de erro de rede
    if (
      msg.includes("Network request failed") ||
      msg.includes("Failed to fetch") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ENOTFOUND")
    ) {
      throw new Error("Falha de rede: verifique sua conexão com a internet/API.");
    }
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}

export type EventoStatus =
  | "RASCUNHO"
  | "AGENDADO"
  | "ABERTO"
  | "ENCERRADO"
  | "CANCELADO";

export type EventoTipo = "AGE" | "AGO" | "INFORMATIVA" | "OUTROS";

export type Evento = {
  id: string;
  tipo: EventoTipo;
  titulo: string;
  pauta_resumida?: string | null;
  data_hora_inicio_prevista?: string | null;
  edital_pdf_url?: string | null;
  status: EventoStatus;
  abre_em?: string | null;
  encerra_em?: string | null;
  quorum_versao_atual?: number | null;
};

export type Presenca = {
  id: string;
  evento_id: string;
  user_id: string;
  entrou_em: string;
  saiu_em: string | null;
  ativa: boolean;
  quorum_versao: number;
  device_id: string | null;
};

export async function obterProximoEvento(token: string): Promise<Evento | null> {
  return apiRequest<Evento | null>("/api/eventos/proximo", "GET", token);
}

export async function obterEvento(token: string, id: string): Promise<Evento> {
  return apiRequest<Evento>(`/api/eventos/${id}`, "GET", token);
}

export async function listarPresencas(
  token: string,
  eventoId: string
): Promise<Presenca[]> {
  return apiRequest<Presenca[]>(
    `/api/eventos/${eventoId}/presencas`,
    "GET",
    token
  );
}

export async function entrarNoEvento(
  token: string,
  eventoId: string,
  deviceId: string
): Promise<Presenca> {
  return apiRequest<Presenca>(`/api/eventos/${eventoId}/entrar`, "POST", token, {
    deviceId,
  });
}

export async function sairDoEvento(
  token: string,
  eventoId: string
): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(
    `/api/eventos/${eventoId}/sair`,
    "POST",
    token
  );
}

export async function abrirEvento(
  token: string,
  eventoId: string
): Promise<Evento> {
  return apiRequest<Evento>(`/api/eventos/${eventoId}/abrir`, "POST", token);
}

export async function encerrarEvento(
  token: string,
  eventoId: string
): Promise<Evento> {
  return apiRequest<Evento>(`/api/eventos/${eventoId}/encerrar`, "POST", token);
}

export async function recontarQuorum(
  token: string,
  eventoId: string
): Promise<{ ok: boolean; quorum_versao_atual: number; derrubados: number }> {
  return apiRequest<{ ok: boolean; quorum_versao_atual: number; derrubados: number }>(
    `/api/eventos/${eventoId}/recontar-quorum`,
    "POST",
    token
  );
}
