import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api, TOKEN_KEY } from "@/src/api";

export type User = {
  user_id: string;
  name: string;
  email: string;
  username?: string;
  bio?: string;
  avatar?: string | null;
  email_verified?: boolean;
};

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  forgot: (email: string) => Promise<void>;
  reset: (email: string, code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
const USER_KEY = "chatly_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await storage.secureGet<string>(TOKEN_KEY, "");
      if (t) {
        setToken(t);
        try {
          const res = await api.get<{ user: User }>("/auth/me");
          setUserState(res.user);
          storage.setItem(USER_KEY, res.user as any);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const persistSession = async (t: string, u: User) => {
    await storage.secureSet(TOKEN_KEY, t);
    await storage.setItem(USER_KEY, u as any);
    setToken(t);
    setUserState(u);
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/login", { email, password }, false);
    await persistSession(res.token, res.user);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    await api.post("/auth/signup", { name, email, password }, false);
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/verify-otp", { email, code }, false);
    await persistSession(res.token, res.user);
  }, []);

  const resendOtp = useCallback(async (email: string) => {
    await api.post("/auth/resend-otp", { email }, false);
  }, []);

  const forgot = useCallback(async (email: string) => {
    await api.post("/auth/forgot-password", { email }, false);
  }, []);

  const reset = useCallback(async (email: string, code: string, newPassword: string) => {
    await api.post("/auth/reset-password", { email, code, new_password: newPassword }, false);
  }, []);

  const logout = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    await storage.removeItem(USER_KEY);
    setToken(null);
    setUserState(null);
  }, []);

  const setUser = useCallback((u: User) => {
    setUserState(u);
    storage.setItem(USER_KEY, u as any);
  }, []);

  return (
    <Ctx.Provider value={{ user, token, loading, login, signup, verifyOtp, resendOtp, forgot, reset, logout, setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
