import React, { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { wsUrl } from "@/src/api";
import { useAuth } from "@/src/auth";

type Listener = (event: any) => void;

type WsCtx = {
  subscribe: (fn: Listener) => () => void;
  send: (data: any) => void;
};

const Ctx = createContext<WsCtx>({ subscribe: () => () => {}, send: () => {} });

export function WsProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const listeners = useRef<Set<Listener>>(new Set());
  const reconnectTimer = useRef<any>(null);
  const shouldConnect = useRef(false);

  const connect = useCallback(() => {
    if (!token) return;
    try {
      const ws = new WebSocket(wsUrl(token));
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          listeners.current.forEach((fn) => fn(data));
        } catch {}
      };
      ws.onclose = () => {
        if (shouldConnect.current) {
          reconnectTimer.current = setTimeout(connect, 2500);
        }
      };
      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    } catch {}
  }, [token]);

  useEffect(() => {
    if (token) {
      shouldConnect.current = true;
      connect();
    }
    return () => {
      shouldConnect.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
    };
  }, [token, connect]);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const send = useCallback((data: any) => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    } catch {}
  }, []);

  return <Ctx.Provider value={{ subscribe, send }}>{children}</Ctx.Provider>;
}

export const useWs = () => useContext(Ctx);
