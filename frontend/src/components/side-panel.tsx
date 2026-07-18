import { CommandsPanel } from '@/components/commands-panel';
import { CheatsPanel } from '@/components/cheats-panel';
import { SettingsPanel } from '@/components/settings-panel';
import { usePanelStore } from '@/stores/panel-store';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'commands', label: '命令' },
  { id: 'cheats', label: '速查' },
  { id: 'settings', label: '设置' },
] as const;

export function SidePanel() {
  const activeTab = usePanelStore((s) => s.activeTab);
  const setTab = usePanelStore((s) => s.setTab);

  return (
    <div className="flex h-full flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]">
      <div className="flex h-8 items-center gap-1 border-b border-[var(--color-border-subtle)] px-2 text-xs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              'flex-1 rounded px-2 py-1 text-center transition-colors',
              activeTab === tab.id
                ? 'bg-[var(--color-bg-surface-1)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'commands' ? <CommandsPanel /> : activeTab === 'cheats' ? <CheatsPanel /> : <SettingsPanel />}
      </div>
    </div>
  );
}
