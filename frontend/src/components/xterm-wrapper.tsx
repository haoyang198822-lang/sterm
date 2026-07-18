import { useEffect, useLayoutEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminalStore } from '@/stores/terminal-store';
import { useThemeStore } from '@/stores/theme-store';
import '@xterm/xterm/css/xterm.css';

interface Props {
  sessionId: string;
  registerWriter?: (id: string, write: (data: string) => void) => () => void;
}

function themeFromIsLight(isLight: boolean) {
  if (isLight) {
    return {
      background: '#ffffff',
      foreground: '#000000',
      cursor: '#000000',
      selectionBackground: '#add6ff',
      selectionForeground: '#000000',
      black: '#000000',
      red: '#cd3131',
      green: '#0d8f0f',
      yellow: '#7f6000',
      blue: '#0451a5',
      magenta: '#bc05bc',
      cyan: '#0598bc',
      white: '#a0a0a0',
      brightBlack: '#666666',
      brightRed: '#cd3131',
      brightGreen: '#0d8f0f',
      brightYellow: '#7f6000',
      brightBlue: '#0451a5',
      brightMagenta: '#bc05bc',
      brightCyan: '#0598bc',
      brightWhite: '#c0c0c0',
    };
  }
  return {
    background: '#08090a',
    foreground: '#d0d6e0',
    cursor: '#d0d6e0',
    selectionBackground: '#7170ff',
    selectionForeground: '#d0d6e0',
  };
}

export function XTermWrapper({ sessionId, registerWriter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const isLight = useThemeStore((s) => s.isLight);
  const fontSize = useThemeStore((s) => s.fontSize);
  const fontFamily = useThemeStore((s) => s.fontFamily);
  const cursorStyle = useThemeStore((s) => s.cursorStyle);
  const cursorBlink = useThemeStore((s) => s.cursorBlink);
  const terminalBackground = useThemeStore((s) => s.terminalBackground);

  useLayoutEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    let disposed = false;
    let observer: ResizeObserver | undefined;
    let raf1 = 0;
    let raf2 = 0;
    let timeoutId: number | undefined;

    const term = new Terminal({
      cursorBlink,
      cursorStyle: cursorStyle as 'block' | 'underline' | 'bar',
      fontSize,
      fontFamily: `'${fontFamily}', 'Fira Code', monospace`,
      theme: { ...themeFromIsLight(isLight), background: terminalBackground },
      scrollback: 5000,
      convertEol: true,
      smoothScrollDuration: 0,
    } as any);

    terminalRef.current = term;
    term.open(containerRef.current);
    term.focus();

    const fitAndFocus = () => {
      if (disposed || !fit) return;
      try {
        const proposed = typeof fit.proposeDimensions === 'function' ? fit.proposeDimensions() : null;
        if (proposed?.cols && proposed?.rows) {
          term.resize(proposed.cols, proposed.rows);
        } else {
          fit.fit();
        }
        if (term.cols > 0 && term.rows > 0) {
          const ws = useTerminalStore.getState().ws;
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'resize',
              sessionId,
              cols: term.cols,
              rows: term.rows,
            }));
          }
        }
        term.focus();
      } catch {
        // ignore transient layout states
      }
    };

    let fit: FitAddon | null = null;

    try {
      fit = new FitAddon();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());

      observer = new ResizeObserver(() => {
        window.requestAnimationFrame(fitAndFocus);
      });
      observer.observe(containerRef.current);
      document.fonts?.ready?.then(() => window.requestAnimationFrame(fitAndFocus)).catch(() => {});

      const scheduleFitBurst = () => {
        fitAndFocus();
        raf1 = window.requestAnimationFrame(() => {
          fitAndFocus();
          raf2 = window.requestAnimationFrame(fitAndFocus);
        });
        timeoutId = window.setTimeout(fitAndFocus, 50);
      };

      window.requestAnimationFrame(scheduleFitBurst);
      window.setTimeout(scheduleFitBurst, 200);
      window.addEventListener('resize', fitAndFocus);
    } catch (e) {
      console.error('[xterm] addon load failed:', e);
    }

    const unreg = registerWriter?.(sessionId, (data) => term.write(data));

    term.onData((data) => {
      const ws = useTerminalStore.getState().ws;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', sessionId, text: data }));
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'c') {
        if (term.hasSelection()) {
          const selected = term.getSelection();
          navigator.clipboard.writeText(selected).catch(() => {
            const api = (window as any).electronAPI;
            if (api?.writeClipboard) api.writeClipboard(selected);
          });
          return;
        }
        e.preventDefault();
        const ws = useTerminalStore.getState().ws;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', sessionId, text: '\x03' }));
        }
      }
      if (e.metaKey && e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          if (text) {
            const ws = useTerminalStore.getState().ws;
            if (ws?.readyState === WebSocket.OPEN) {
              const hasNewline = text.includes('\n') || text.includes('\r');
              const pasteText = hasNewline ? `\x1b[200~${text}\x1b[201~` : text;
              ws.send(JSON.stringify({ type: 'input', sessionId, text: pasteText }));
            }
          }
        }).catch(() => {
          const api = (window as any).electronAPI;
          if (api?.readClipboard) {
            const text = api.readClipboard();
            if (text) {
              const ws = useTerminalStore.getState().ws;
              if (ws?.readyState === WebSocket.OPEN) {
                const hasNewline = text.includes('\n') || text.includes('\r');
                const pasteText = hasNewline ? `\x1b[200~${text}\x1b[201~` : text;
                ws.send(JSON.stringify({ type: 'input', sessionId, text: pasteText }));
              }
            }
          }
        });
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      container.classList.add('drag-over');
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const related = e.relatedTarget as Node | null;
      if (container.contains(related)) return;
      container.classList.remove('drag-over');
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      container.classList.remove('drag-over');

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const api = (window as any).electronAPI;
      const paths: string[] = [];

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        let filePath: string;

        if (api?.getFilePath) {
          filePath = api.getFilePath(file);
        } else {
          filePath = (file as any).path || file.name;
        }

        if (filePath.includes(' ')) {
          filePath = `"${filePath}"`;
        }
        paths.push(filePath);
      }

      const input = paths.join(' ');
      const ws = useTerminalStore.getState().ws;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', sessionId, text: input }));
      }

      term.focus();
    };

    const container = containerRef.current;
    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);

    return () => {
      disposed = true;
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      if (timeoutId) window.clearTimeout(timeoutId);
      observer?.disconnect();
      window.removeEventListener('resize', fitAndFocus);
      term.dispose();
      terminalRef.current = null;
      unreg?.();
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('dragenter', handleDragEnter);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('drop', handleDrop);
    };
    // 只在 sessionId 变更时重建终端，不含 isLight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerWriter, sessionId]);

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;
    try {
      term.options.theme = themeFromIsLight(isLight);
      window.requestAnimationFrame(() => term.focus());
    } catch {
      // older xterm may use different api, ignore
    }
  }, [isLight]);

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;
    try {
      term.options.fontSize = fontSize;
      term.options.fontFamily = `'${fontFamily}', 'Fira Code', monospace`;
      term.options.cursorStyle = cursorStyle as 'block' | 'underline' | 'bar';
      term.options.cursorBlink = cursorBlink;
      term.options.theme = { ...term.options.theme, background: terminalBackground };
      term.refresh(0, term.rows - 1);
    } catch {
      // ignore
    }
  }, [fontSize, fontFamily, cursorStyle, cursorBlink, terminalBackground]);

  return <div ref={containerRef} className="h-full w-full min-h-0 overflow-hidden" tabIndex={0} />;
}
