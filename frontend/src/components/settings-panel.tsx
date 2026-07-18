import { useThemeStore } from '@/stores/theme-store';

const fonts = ['JetBrains Mono', 'Fira Code', 'Menlo', 'SF Mono'];
const cursorStyles = ['block', 'underline', 'bar'];

export function SettingsPanel() {
  const { fontSize, fontFamily, cursorStyle, cursorBlink, terminalBackground, setFontSize, setFontFamily, setCursorStyle, setCursorBlink, setTerminalBackground } =
    useThemeStore();

  return (
    <div className="space-y-1 p-3 text-sm">
      <div className="flex items-center justify-between py-2">
        <span>字体大小</span>
        <input className="w-24 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] px-3 py-2 text-right" type="number" min={11} max={18} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
      </div>
      <div className="flex items-center justify-between py-2">
        <span>字体</span>
        <select className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] px-3 py-2" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
          {fonts.map((f) => <option key={f}>{f}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between py-2">
        <span>光标样式</span>
        <select className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-1)] px-3 py-2" value={cursorStyle} onChange={(e) => setCursorStyle(e.target.value)}>
          {cursorStyles.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between py-2">
        <span>光标闪烁</span>
        <input type="checkbox" checked={cursorBlink} onChange={(e) => setCursorBlink(e.target.checked)} />
      </div>
      <div className="flex items-center justify-between py-2">
        <span>终端背景</span>
        <input type="color" value={terminalBackground} onChange={(e) => setTerminalBackground(e.target.value)} />
      </div>
    </div>
  );
}
