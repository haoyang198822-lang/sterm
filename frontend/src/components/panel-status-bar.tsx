import { Moon, PanelLeft, Sun } from 'lucide-react';
import { usePanelStore } from '@/stores/panel-store';
import { useThemeStore } from '@/stores/theme-store';
import { useTerminalStore } from '@/stores/terminal-store';

export function PanelStatusBar() {
  const wsConnected = useTerminalStore((s) => s.wsConnected);
  const togglePanel = usePanelStore((s) => s.toggle);
  const isLight = useThemeStore((s) => s.isLight);
  const toggleTheme = useThemeStore((s) => s.toggle);

  return (
    <div className="flex h-7 items-center gap-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-3 text-xs text-[var(--color-text-tertiary)]">
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
        {wsConnected ? '已连接' : '已断开'}
      </span>
      <div className="flex-1" />
      <div className="h-4 w-px bg-[var(--color-border-subtle)]" />
      <button onClick={togglePanel} className="transition-colors hover:text-[var(--color-text-primary)]">
        <PanelLeft className="h-3.5 w-3.5" />
      </button>
      <button onClick={toggleTheme} className="transition-colors hover:text-[var(--color-text-primary)]">
        {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
