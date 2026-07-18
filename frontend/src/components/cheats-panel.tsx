import { useEffect, useRef, useState } from 'react';
import { Copy, LoaderCircle, Send, Sparkles } from 'lucide-react';
import { api, type CheatCategory, type CheatItem } from '@/lib/api';

type Mode = 'browse' | 'local' | 'agent';

function itemTitle(item: CheatItem) {
  return item.title || item.name || item.command || '结果';
}

function itemCode(item: CheatItem) {
  return item.code || item.command || '';
}

function CommandCard({ item }: { item: CheatItem }) {
  const code = itemCode(item);
  return (
    <div className="group rounded-[12px_12px_12px_4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] p-3">
      <div className="font-medium text-[var(--color-text-primary)]">{itemTitle(item)}</div>
      {item.description ? <div className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.description}</div> : null}
      {code ? (
        <div className="mt-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-2)] p-3 font-mono text-xs text-[var(--color-text-primary)]">
          <div className="flex items-start justify-between gap-2">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all">{code}</pre>
            <button
              className="rounded-md p-1 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
              onClick={() => navigator.clipboard.writeText(code).catch(() => {})}
              title="复制"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CategoryGrid({
  categories,
  onSelect,
}: {
  categories: CheatCategory[];
  onSelect: (category: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? categories : categories.slice(0, 6);
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visible.map((category) => (
          <button
            key={category.category}
            className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] p-3 text-left transition-colors hover:border-[var(--color-brand)]"
            onClick={() => onSelect(category.category)}
          >
            <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">{category.category}</div>
            <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">{category.count} 条</div>
          </button>
        ))}
      </div>
      {categories.length > 6 ? (
        <button className="mt-2 text-xs text-[var(--color-text-secondary)]" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '收起' : '查看更多'}
        </button>
      ) : null}
    </div>
  );
}

export function CheatsPanel() {
  const [mode, setMode] = useState<Mode>('browse');
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<CheatCategory[]>([]);
  const [commands, setCommands] = useState<CheatItem[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentAnswer, setAgentAnswer] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.cheats.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [commands, loading, agentAnswer]);

  const runLocal = async () => {
    setLoading(true);
    try {
      const data = await api.cheats.local(query);
      setCategories(data.categories);
      setCommands(data.results);
      setAgentAnswer('');
      setCurrentCategory(null);
      setMode('local');
    } finally {
      setLoading(false);
    }
  };

  const runBrowse = async (category: string) => {
    setLoading(true);
    try {
      setCurrentCategory(category);
      setCommands(await api.cheats.browse(category));
      setAgentAnswer('');
      setMode('browse');
    } finally {
      setLoading(false);
    }
  };

  const runAgent = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setAgentAnswer(data.answer || '');
      // 如果在本地搜索模式下使用 AI 增强，保留本地结果不切换模式
      if (mode !== 'local') setMode('agent');
    } finally {
      setLoading(false);
    }
  };

  const showEmptyHint = mode === 'local' && commands.length === 0 && !loading;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border-subtle)] p-3 text-sm">
        <div className="flex gap-2">
          {(['browse', 'local', 'agent'] as const).map((m) => (
            <button
              key={m}
              className={`rounded-lg px-3 py-1.5 ${mode === m ? 'bg-[var(--color-brand)] text-white' : 'bg-[var(--color-bg-surface-1)] text-[var(--color-text-secondary)]'}`}
              onClick={() => setMode(m)}
            >
              {m === 'browse' ? '速查' : m === 'local' ? '本地搜索' : 'AI 增强'}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 text-sm">
        {mode === 'agent' && !commands.length ? (
          <div className="rounded-[12px_12px_12px_4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] p-3 text-[var(--color-text-primary)]">
            {agentAnswer || '等待 AI 回复…'}
          </div>
        ) : (
          <>
            {mode === 'browse' && !currentCategory ? <CategoryGrid categories={categories} onSelect={runBrowse} /> : null}
            {currentCategory ? <div className="mb-2 text-xs text-[var(--color-text-tertiary)]">当前分类：{currentCategory}</div> : null}
            {commands.map((item, i) => (
              <div key={`${itemTitle(item)}-${i}`} className="mt-3">
                <CommandCard item={item} />
              </div>
            ))}
            {showEmptyHint ? (
              <div className="rounded-[12px_12px_12px_4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] p-3 text-[var(--color-text-secondary)]">
                未找到结果，建议使用 AI 增强搜索。
              </div>
            ) : null}
            {agentAnswer ? (
              <div className="mt-3 rounded-[12px_12px_12px_4px] border border-[var(--color-brand)]/20 bg-[var(--color-bg-surface-1)] p-3">
                <div className="mb-2 text-xs font-medium text-[var(--color-brand)]">AI 增强结果</div>
                <div className="text-sm text-[var(--color-text-secondary)]" style={{ whiteSpace: 'pre-wrap' }}>{agentAnswer}</div>
              </div>
            ) : null}
            {loading ? (
              <div className="mt-3 flex items-center gap-2 text-[var(--color-text-tertiary)]">
                <LoaderCircle className="h-4 w-4 animate-spin" />加载中…
              </div>
            ) : null}
            {commands.length > 0 && !agentAnswer ? (
              <button className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]/40 hover:text-[var(--color-brand)]" onClick={runAgent}>
                <Sparkles className="h-3.5 w-3.5" />AI 增强搜索
              </button>
            ) : null}
            {commands.length === 0 && mode === 'local' && !agentAnswer ? (
              <button className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand)] px-3 py-2 text-xs text-white" onClick={runAgent}>
                <Sparkles className="h-3.5 w-3.5" />Ask AI →
              </button>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-[var(--color-border-subtle)] p-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-24 w-full resize-none rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] p-3 text-sm outline-none"
          rows={1}
          placeholder="输入速查问题…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
              e.preventDefault();
              void runLocal();
            }
            if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault();
              void runAgent();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
          <span>Enter 搜索本地，Ctrl+Enter AI 增强</span>
          <button onClick={() => void runLocal()} className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] p-2 text-white">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
