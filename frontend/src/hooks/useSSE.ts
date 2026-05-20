import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

interface UseSSEOptions {
  onMessage?: (data: any) => void;
  enabled?: boolean;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const { token } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!token || options.enabled === false) return;
    if (esRef.current) esRef.current.close();

    const fullUrl = `${url}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(fullUrl);
    esRef.current = es;

    es.onopen = () => { if (mountedRef.current) setConnected(true); };

    es.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const parsed = JSON.parse(e.data);
        setData(parsed);
        options.onMessage?.(parsed);
      } catch {}
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      es.close();
      esRef.current = null;
      // Reconnect after 5 seconds
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 5000);
    };
  }, [url, token, options.enabled]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (esRef.current) esRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return { data, connected };
}
