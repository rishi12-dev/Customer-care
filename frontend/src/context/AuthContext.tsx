import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, loadTokens, setTokens } from "../api/client";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function reloadProfile() {
    const profile = await api<User>("/auth/profile");
    setUser(profile);
  }

  async function login(email: string, password: string) {
    const data = await api<{ access_token: string; refresh_token: string; csrf_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token, csrfToken: data.csrf_token });
    await reloadProfile();
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setTokens(null);
      setUser(null);
    }
  }

  useEffect(() => {
    if (!loadTokens()) {
      setLoading(false);
      return;
    }
    reloadProfile().catch(() => setTokens(null)).finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, reloadProfile }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
