import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Copy, ChevronDown } from 'lucide-react';
import { api, type CommandItem } from '@/lib/api';
import { useCommandStore } from '@/stores/command-store';
import { useTerminalStore } from '@/stores/terminal-store';
import { cn } from '@/lib/utils';

function CommandDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<CommandItem> | null;
  onSave: (values: { command: string; description: string; category: string }) => Promise<void>;
}) {
  const [command, setCommand] = useState(initial?.command ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');

  useEffect(() => {
    setCommand(initial?.command ?? '');
    setDescription(initial?.description ?? '');
    setCategory(initial?.category ?? '');
  }, [initial, open]);

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4 shadow-2xl">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{initial?.id ? '编辑命令' : '新增命令'}</h3>
        <div className="mt-4 space-y-3">
          <textarea autoFocus className="min-h-28 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] p-3 font-mono text-sm outline-none" value={command} onChange={(e) => setCommand(e.target.value)} placeholder={'git commit -m "message"'} onPaste={(e) => { e.stopPropagation(); }} />
          <input className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] px-3 py-2 text-sm outline-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述" />
          <input className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] px-3 py-2 text-sm outline-none" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="分类" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]" onClick={() => onOpenChange(false)}>取消</button>
          <button className="rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm text-white" onClick={() => { void onSave({ command, description, category }); }}>确认</button>
        </div>
      </div>
    </div>
  ) : null;
}

export function CommandsPanel() {
  const { items, loading, fetch, searchQuery, filterCategory, categories, setSearch, setCategory, create, update, remove } = useCommandStore();
  const sendCommand = useTerminalStore((s) => s.sendCommand);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<CommandItem> | null>(null);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  useEffect(() => { void fetch(); }, [fetch]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQ = !q || item.command.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      const matchesCategory = !filterCategory || item.category === filterCategory;
      return matchesQ && matchesCategory;
    });
  }, [items, searchQuery, filterCategory]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border-subtle)] p-3 space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] px-3 py-2">
          <Search className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          <input value={searchQuery} onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search..." />
        </div>
        <div className="relative">
          <button className="flex items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]" onClick={() => setShowCategoryMenu((p) => !p)}>
            {filterCategory || '全部分类'} <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {showCategoryMenu && (
            <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-1 shadow-xl">
              <button className="w-full rounded-md px-3 py-1.5 text-left text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-1)]" onClick={() => { setCategory(''); setShowCategoryMenu(false); }}>全部分类</button>
              {categories.map((cat) => (
                <button key={cat} className="w-full rounded-md px-3 py-1.5 text-left text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-1)]" onClick={() => { setCategory(cat); setShowCategoryMenu(false); }}>{cat}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {loading ? '加载中…' : filtered.map((item) => (
          <div key={item.id} className="group cursor-pointer rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] p-4 transition-colors hover:bg-[var(--color-bg-surface-2)]" onClick={() => sendCommand(item.command)}>
            <div className="font-mono text-sm text-[var(--color-text-primary)] break-all whitespace-pre-wrap">$ {item.command}</div>
            <div className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.description}</div>
            <div className="mt-2 text-xs text-[var(--color-text-tertiary)]">{item.category}</div>
            <div className="mt-3 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100">
              <button className="text-xs text-[var(--color-text-tertiary)]" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.command); }}><Copy className="h-3.5 w-3.5" /></button>
              <button className="text-xs text-[var(--color-text-tertiary)]" onClick={(e) => { e.stopPropagation(); setDraft(item); setDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></button>
              <button className="text-xs text-[var(--color-text-tertiary)]" onClick={(e) => { e.stopPropagation(); void remove(item.id); }}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3">
        <button className="ml-auto flex items-center gap-2 rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm text-white" onClick={() => { setDraft(null); setDialogOpen(true); }}><Plus className="h-4 w-4" />新增</button>
      </div>
      <CommandDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={draft} onSave={async (values) => { if (draft?.id) await update(draft.id, values); else await create(values); setDialogOpen(false); }} />
    </div>
  );
}
