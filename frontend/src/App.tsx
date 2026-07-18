import { PanelLayout } from '@/components/panel-layout';
import { PanelStatusBar } from '@/components/panel-status-bar';
import { ThemeProvider } from '@/components/theme-provider';
import { CommandPalette } from '@/components/command-palette';

export default function App() {
  return (
    <ThemeProvider>
      <div className="flex h-screen w-screen flex-col bg-[var(--color-bg-canvas)] font-sans text-[var(--color-text-primary)]">
        <PanelLayout />
        <PanelStatusBar />
        <CommandPalette />
      </div>
    </ThemeProvider>
  );
}
