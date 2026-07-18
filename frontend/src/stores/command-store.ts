import { create } from 'zustand';
import { api, type CommandItem } from '@/lib/api';

interface CommandStore {
  items: CommandItem[];
  loading: boolean;
  searchQuery: string;
  filterCategory: string;
  categories: string[];
  fetch: () => Promise<void>;
  create: (cmd: Omit<CommandItem, 'id' | 'createdAt'>) => Promise<void>;
  update: (id: string, cmd: Partial<CommandItem>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setSearch: (q: string) => void;
  setCategory: (c: string) => void;
}

export const useCommandStore = create<CommandStore>((set, get) => ({
  items: [],
  loading: false,
  searchQuery: '',
  filterCategory: '',
  categories: [],
  fetch: async () => {
    set({ loading: true });
    try {
      const [items, categories] = await Promise.all([api.commands.list(), api.commands.categories()]);
      set({ items, categories });
    } finally {
      set({ loading: false });
    }
  },
  create: async (cmd) => {
    const item = await api.commands.create(cmd);
    set({ items: [item, ...get().items] });
  },
  update: async (id, cmd) => {
    const item = await api.commands.update(id, cmd);
    set({ items: get().items.map((entry) => (entry.id === id ? item : entry)) });
  },
  remove: async (id) => {
    await api.commands.delete(id);
    set({ items: get().items.filter((entry) => entry.id !== id) });
  },
  setSearch: (q) => set({ searchQuery: q }),
  setCategory: (c) => set({ filterCategory: c }),
}));
