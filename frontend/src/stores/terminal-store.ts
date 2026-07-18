import { create } from 'zustand';

interface TerminalSession {
  id: string;
  title: string;
  shell?: string;
}

interface TerminalStore {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  wsConnected: boolean;
  ws: WebSocket | null;
  setWs: (ws: WebSocket | null) => void;
  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActive: (id: string) => void;
  setWsConnected: (connected: boolean) => void;
  sendCommand: (command: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  wsConnected: false,
  ws: null,
  setWs: (ws) => set({ ws }),
  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: state.activeSessionId ?? session.id,
    })),
  removeSession: (id) =>
    set((state) => {
      const remaining = state.sessions.filter((session) => session.id !== id);
      return {
        sessions: remaining,
        activeSessionId:
          state.activeSessionId === id ? remaining[remaining.length - 1]?.id ?? null : state.activeSessionId,
      };
    }),
  setActive: (id) => set({ activeSessionId: id }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  sendCommand: (command: string) => {
    const { ws, activeSessionId } = get();
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeSessionId) return;
    ws.send(JSON.stringify({ type: 'input', sessionId: activeSessionId, text: command + '\n' }));
  },
}));
