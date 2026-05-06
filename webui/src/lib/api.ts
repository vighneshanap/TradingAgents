/** Typed REST client for the FastAPI backend. */

import type {
  HealthResponse,
  MemoryEntry,
  ProviderInfo,
  RunDetail,
  RunRequest,
  RunSummary,
} from "@/types";

const TOKEN_KEY = "tradingagents-bearer";

function authHeaders(): HeadersInit {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function jsonFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => jsonFetch<HealthResponse>("/api/health"),
  config: () => jsonFetch<Record<string, unknown>>("/api/config"),
  providers: () => jsonFetch<ProviderInfo[]>("/api/providers"),

  listRuns: () => jsonFetch<RunSummary[]>("/api/runs"),
  getRun: (id: string) => jsonFetch<RunDetail>(`/api/runs/${id}`),
  getRunState: (id: string) =>
    jsonFetch<Record<string, unknown>>(`/api/runs/${id}/state`),
  getRunStats: (id: string) =>
    jsonFetch<Record<string, number>>(`/api/runs/${id}/stats`),
  createRun: (req: RunRequest) =>
    jsonFetch<RunSummary>("/api/runs", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  cancelRun: (id: string) =>
    jsonFetch<{ status: string }>(`/api/runs/${id}/cancel`, { method: "POST" }),

  listMemory: () => jsonFetch<MemoryEntry[]>("/api/memory"),
  memoryFor: (ticker: string) =>
    jsonFetch<MemoryEntry[]>(`/api/memory/${encodeURIComponent(ticker)}`),
};

export const auth = {
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  hasToken: () => Boolean(localStorage.getItem(TOKEN_KEY)),
};
