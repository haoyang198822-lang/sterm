import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { usePanelStore } from '@/stores/panel-store';
import { useThemeStore } from '@/stores/theme-store';
import { useTerminalStore } from '@/stores/terminal-store';
import { cn } from '@/lib/utils';

type PaletteCommand = {
  id: string;
  label: string;
  description?: string;
  action: () => void;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const panel = usePanelStore();
  const theme = useThemeStore();
  const terminal = useTerminalStore();

  const commands: PaletteCommand[] = useMemo(
    () => [
      { id: 'toggle-theme', label: '切换主题', action: () => theme.toggle() },
      { id: 'open-cheats', label: '打开速查', action: () => panel.setTab('cheats') },
      { id: 'open-commands', label: '打开命令', action: () => panel.setTab('commands') },
      { id: 'open-settings', label: '打开设置', action: () => panel.setTab('settings') },
      { id: 'collapse-sidebar', label: '收起侧边栏', action: () => panel.setOpen(false) },
      { id: 'close-terminal', label: '关闭当前终端', action: () => terminal.activeSessionId && terminal.removeSession(terminal.activeSessionId) },
    ],
    [panel, terminal, theme],
  );

  const filtered = commands.filter((c) => c.label.includes(search));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((p) => !p); }
      if (e.key === 'Escape') setOpen(false);
      if (!open) return;
      if (e.key === 'ArrowDown') setActive((p) => Math.min(p + 1, filtered.length - 1));
      if (e.key === 'ArrowUp') setActive((p) => Math.max(p - 1, 0));
      if (e.key === 'Enter') filtered[active]?.action();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, filtered, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-[640px] rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] px-3 py-2">
          <Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent outline-none" placeholder="搜索命令…" />
        </div>
        <div className="mt-2 max-h-80 overflow-auto">
          {filtered.map((cmd, idx) => (
            <button key={cmd.id} onClick={() => cmd.action()} className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2 text-left', idx === active ? 'bg-[var(--color-bg-surface-1)]' : 'hover:bg-[var(--color-bg-surface-2)]')}>
              <span>{cmd.label}</span>
              <span className="text-xs text-[var(--color-text-tertiary)]">{cmd.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
