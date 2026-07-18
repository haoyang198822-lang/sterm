import { create } from 'zustand';

interface ThemeStore {
  isLight: boolean;
  fontSize: number;
  fontFamily: string;
  cursorStyle: string;
  cursorBlink: boolean;
  terminalBackground: string;
  toggle: () => void;
  setFontSize: (fontSize: number) => void;
  setFontFamily: (fontFamily: string) => void;
  setCursorStyle: (cursorStyle: string) => void;
  setCursorBlink: (cursorBlink: boolean) => void;
  setTerminalBackground: (terminalBackground: string) => void;
}

const initialIsLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
const storage = typeof window !== 'undefined' ? window.localStorage : null;

const readNumber = (key: string, fallback: number) => {
  const value = storage?.getItem(key);
  return value ? Number(value) : fallback;
};

const readString = (key: string, fallback: string) => storage?.getItem(key) ?? fallback;
const readBoolean = (key: string, fallback: boolean) => {
  const value = storage?.getItem(key);
  return value == null ? fallback : value === 'true';
};

export const useThemeStore = create<ThemeStore>((set) => ({
  isLight: initialIsLight,
  fontSize: readNumber('sterm:fontSize', 14),
  fontFamily: readString('sterm:fontFamily', 'JetBrains Mono'),
  cursorStyle: readString('sterm:cursorStyle', 'block'),
  cursorBlink: readBoolean('sterm:cursorBlink', true),
  terminalBackground: readString('sterm:terminalBackground', '#08090a'),
  toggle: () =>
    set((state) => {
      const next = !state.isLight;
      document.documentElement.classList.toggle('light', next);
      storage?.setItem('sterm-theme', next ? 'light' : 'dark');
      return { isLight: next };
    }),
  setFontSize: (fontSize) => {
    storage?.setItem('sterm:fontSize', String(fontSize));
    set({ fontSize });
  },
  setFontFamily: (fontFamily) => {
    storage?.setItem('sterm:fontFamily', fontFamily);
    set({ fontFamily });
  },
  setCursorStyle: (cursorStyle) => {
    storage?.setItem('sterm:cursorStyle', cursorStyle);
    set({ cursorStyle });
  },
  setCursorBlink: (cursorBlink) => {
    storage?.setItem('sterm:cursorBlink', String(cursorBlink));
    set({ cursorBlink });
  },
  setTerminalBackground: (terminalBackground) => {
    storage?.setItem('sterm:terminalBackground', terminalBackground);
    set({ terminalBackground });
  },
}));
