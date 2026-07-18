import { useEffect, useRef } from 'react';
import { useTerminalStore } from '@/stores/terminal-store';

type MessageHandler = (msg: any) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setWs, setWsConnected } = useTerminalStore();
  const handlerRef = useRef(onMessage);

  handlerRef.current = onMessage;

  useEffect(() => {
    const connect = () => {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}/ws`);

      ws.onopen = () => {
        setWsConnected(true);
        setWs(ws);
        wsRef.current = ws;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handlerRef.current(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setWs(null);
        wsRef.current = null;
        timerRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {};
    };

    connect();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      wsRef.current?.close();
    };
  }, [setWs, setWsConnected]);
}
