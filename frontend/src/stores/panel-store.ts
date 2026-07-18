import { create } from 'zustand';

type TabId = 'commands' | 'cheats' | 'settings';

interface PanelStore {
  open: boolean;
  width: number;
  activeTab: TabId;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setTab: (tab: TabId) => void;
}

const readNumber = (key: string, fallback: number) => {
  const value = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  return value ? Number(value) : fallback;
};

const readBoolean = (key: string, fallback: boolean) => {
  const value = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  return value == null ? fallback : value === 'true';
};

export const usePanelStore = create<PanelStore>((set) => ({
  open: readBoolean('sterm:sidebarOpen', true),
  width: readNumber('sterm:sidebarWidth', 280),
  activeTab: 'commands',
  toggle: () =>
    set((state) => {
      const next = !state.open;
      window.localStorage.setItem('sterm:sidebarOpen', String(next));
      return { open: next };
    }),
  setOpen: (open) => {
    window.localStorage.setItem('sterm:sidebarOpen', String(open));
    set({ open });
  },
  setWidth: (width) => {
    window.localStorage.setItem('sterm:sidebarWidth', String(width));
    set({ width });
  },
  setTab: (tab) => set({ activeTab: tab, open: true }),
}));
