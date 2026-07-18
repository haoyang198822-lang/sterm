import { TerminalPanel } from '@/components/terminal-panel';
import { SidePanel } from '@/components/side-panel';
import { usePanelStore } from '@/stores/panel-store';
import { Resizable } from 're-resizable';

export function PanelLayout() {
  const open = usePanelStore((s) => s.open);
  const width = usePanelStore((s) => s.width);
  const setWidth = usePanelStore((s) => s.setWidth);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1">
        <TerminalPanel />
      </div>
      {open ? (
        <Resizable
          size={{ width, height: '100%' }}
          minWidth={240}
          maxWidth={480}
          enable={{ left: true }}
          onResizeStop={(_, __, ___, delta) => setWidth(width - delta.width)}
        >
          <aside className="h-full w-full min-h-0">
            <SidePanel />
          </aside>
        </Resizable>
      ) : null}
    </div>
  );
}
