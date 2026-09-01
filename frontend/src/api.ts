import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api";
export const TOKEN_KEY = "chatly_token";

export function wsUrl(token: string) {
  const base = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/^http/, "ws");
  return `${base}/api/ws?token=${encodeURIComponent(token)}`;
}

async function request<T = any>(
  method: string,
  path: string,
  body?: any,
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const message = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : "Request failed");
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string, auth = true) => request<T>("GET", p, undefined, auth),
  post: <T = any>(p: string, b?: any, auth = true) => request<T>("POST", p, b, auth),
  put: <T = any>(p: string, b?: any, auth = true) => request<T>("PUT", p, b, auth),
  del: <T = any>(p: string, auth = true) => request<T>("DELETE", p, undefined, auth),
};
