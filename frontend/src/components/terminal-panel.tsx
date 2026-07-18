import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { XTermWrapper } from '@/components/xterm-wrapper';
import { useWebSocket } from '@/hooks/use-websocket';
import { usePanelStore } from '@/stores/panel-store';
import { useTerminalStore } from '@/stores/terminal-store';

export function TerminalPanel() {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeId = useTerminalStore((s) => s.activeSessionId);
  const addSession = useTerminalStore((s) => s.addSession);
  const removeSession = useTerminalStore((s) => s.removeSession);
  const setActive = useTerminalStore((s) => s.setActive);
  const sidebarOpen = usePanelStore((s) => s.open);
  const sidebarWidth = usePanelStore((s) => s.width);
  const outputRef = useRef<Map<string, (data: string) => void>>(new Map());

  const handleMessage = useCallback(
    (msg: any) => {
      if (msg.type === 'created') {
        addSession({ id: msg.sessionId, title: msg.shell || 'zsh', shell: msg.shell });
      } else if (msg.type === 'output' && msg.sessionId) {
        const writer = outputRef.current.get(msg.sessionId);
        writer?.(msg.text);
      } else if ((msg.type === 'exit' || msg.type === 'exited') && msg.sessionId) {
        removeSession(msg.sessionId);
      }
    },
    [addSession, removeSession],
  );

  useWebSocket(handleMessage);

  const registerWriter = useCallback((id: string, write: (data: string) => void) => {
    outputRef.current.set(id, write);
    return () => {
      outputRef.current.delete(id);
    };
  }, []);

  useEffect(() => {
    if (!activeId && sessions.length > 0) {
      setActive(sessions[0].id);
    }
  }, [activeId, sessions, setActive]);

  // 强制 fallback：有 session 但没有 active 时显示第一个
  const displayId = activeId || sessions[0]?.id || null;
  // terminalKey 仅用于 sidebar 变化时强制重新 fit，不用于切换 session
  const terminalKey = useMemo(() => `${sidebarOpen ? sidebarWidth : 'closed'}`, [sidebarOpen, sidebarWidth]);

  const handleNewSession = () => {
    const ws = useTerminalStore.getState().ws;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'create' }));
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-canvas)]">
      <div className="flex h-8 items-center border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] pl-[76px]" style={{ WebkitAppRegion: 'drag' as any }}>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' as any }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setActive(session.id)}
              className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs ${
                session.id === activeId
                  ? 'bg-[var(--color-bg-surface-1)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${session.id === activeId ? 'bg-green-500' : 'bg-gray-500'}`} />
              {session.title}
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  removeSession(session.id);
                }}
                className="ml-1 text-[var(--color-text-quaternary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={handleNewSession}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-surface-1)] hover:text-[var(--color-text-primary)]"
            title="新建终端"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-quaternary)]">
            已关闭所有终端
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className={`absolute inset-0 ${session.id === displayId ? 'z-10' : 'invisible pointer-events-none'}`}>
              <XTermWrapper key={session.id + ':' + terminalKey} sessionId={session.id} registerWriter={registerWriter} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
