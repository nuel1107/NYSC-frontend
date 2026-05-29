/**
 * api-client.ts
 * Drop-in API layer that replaces @supabase/supabase-js calls.
 *
 * Usage:
 *   import { api } from "@/lib/api-client";
 *   const data = await api.get("/profiles/me");
 *   await api.post("/auth/signin", { email, password });
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7860";

// ── Token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY   = "tf_access_token";
const REFRESH_KEY = "tf_refresh_token";

export const tokenStore = {
  getAccess:  ()  => localStorage.getItem(TOKEN_KEY),
  getRefresh: ()  => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY,   access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ── Core fetch ────────────────────────────────────────────────────────────────

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = tokenStore.getAccess();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401
  if (res.status === 401 && retry) {
    const refreshed = await _tryRefresh();
    if (refreshed) return request<T>(method, path, body, false);
    tokenStore.clear();
    window.dispatchEvent(new Event("auth:logout"));
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const json = await res.json();
      detail = json.detail ?? json.message ?? detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function _tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    tokenStore.set(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Public API object ─────────────────────────────────────────────────────────

export const api = {
  get:    <T = unknown>(path: string)                     => request<T>("GET",    path),
  post:   <T = unknown>(path: string, body?: unknown)     => request<T>("POST",   path, body),
  patch:  <T = unknown>(path: string, body?: unknown)     => request<T>("PATCH",  path, body),
  delete: <T = unknown>(path: string)                     => request<T>("DELETE", path),
};
