const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

let tokens: SessionTokens | null = null;

export function setTokens(next: SessionTokens | null) {
  tokens = next;
  if (next) localStorage.setItem("courierops.tokens", JSON.stringify(next));
  else localStorage.removeItem("courierops.tokens");
}

export function loadTokens() {
  const raw = localStorage.getItem("courierops.tokens");
  tokens = raw ? JSON.parse(raw) : null;
  return tokens;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!tokens) loadTokens();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (tokens?.accessToken) headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  if (tokens?.csrfToken) headers.set("X-CSRF-Token", tokens.csrfToken);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retry && tokens?.refreshToken) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: tokens.refreshToken }),
      credentials: "include"
    });
    if (refreshed.ok) {
      const data = await refreshed.json();
      setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token, csrfToken: data.csrf_token });
      return api<T>(path, init, false);
    }
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Network error" }));
    throw new Error(typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail));
  }
  return response.json() as Promise<T>;
}
