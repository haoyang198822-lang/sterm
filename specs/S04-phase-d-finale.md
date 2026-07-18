# S04: 收尾 — Frontend Phase D

## 背景

Phase C 完成侧边栏后，前端所有核心功能就绪。Phase D 做收尾工作：⌘K 命令面板、布局拖拽、整体打磨、与 v1 迁移策略。

## 目标

1. ⌘K 全局命令面板
2. 可拖拽分区（terminal vs sidebar）
3. 布局状态持久化
4. 生产构建 + 与 v1 共存测试

---

## Step 1: ⌘K 命令面板

新建 `frontend/src/components/command-palette.tsx`。

### 交互

- `Cmd+K` 或 `Ctrl+K` 打开/关闭
- 半透明蒙层 + 居中搜索框
- 搜索过滤可执行命令列表
- 选择后执行对应操作（切换 tab、打开设置、新建会话等）
- `Esc` 关闭
- `↑/↓` 导航候选列表
- `Enter` 执行

### 候选命令

| 命令 | 操作 |
|------|------|
| 新建终端 | `useTerminalStore()` → WS 创建新 session |
| 关闭当前终端 | `removeSession(activeId)` |
| 切换主题 | `useTheme().toggle()` |
| 打开速查 | `usePanelStore().setTab('cheats')` + `setOpen(true)` |
| 打开命令 | `usePanelStore().setTab('commands')` + `setOpen(true)` |
| 打开设置 | `usePanelStore().setTab('settings')` + `setOpen(true)` |
| 搜索命令… | focus command search box |
| 收起侧边栏 | `usePanelStore().setOpen(false)` |

### 实现

用 shadcn 的 `Command` 组件（或者自己 Dialog + Input + 列表）。

快捷键用 `useEffect` + `keydown` 监听：

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen(p => !p);
    }
    if (e.key === 'Escape') setOpen(false);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### 数据流

```typescript
// command-palette-store.ts
interface PaletteStore {
  open: boolean;
  setOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  search: string;
  setSearch: (s: string) => void;
  commands: PaletteCommand[];
}

interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  action: () => void;
}
```

## Step 2: 可拖拽分区

将 `panel-layout.tsx` 的 flex 布局改为 shadcn `Resizable` 组件。

```tsx
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from 'resizable-panel-group';

<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={65} minSize={40}>
    <TerminalPanel />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={35} minSize={20} maxSize={50} collapsedSize={0}>
    <SidePanel />
  </ResizablePanel>
</ResizablePanelGroup>
```

### 注意

- 当 sidebar collapse 时，`collapsedSize={0}` 配合 store 中的 `open` 状态
- ResizableHandle 需要 visible/hidden 样式
- 拖拽时终端自动 resize（通过 FitAddon 的 ResizeObserver 已处理）

## Step 3: 布局状态持久化

保存到 `localStorage`：

| key | 值 | store |
|-----|-----|-------|
| `sterm:sidebarWidth` | number | panel-store |
| `sterm:sidebarOpen` | boolean | panel-store |
| `sterm:fontSize` | number | theme-store |
| `sterm:fontFamily` | string | theme-store |
| `sterm:cursorStyle` | string | theme-store |
| `sterm:cursorBlink` | boolean | theme-store |
| `sterm:theme` | 'light' \| 'dark' | theme-store |

初始化时从 localStorage 读取，变更时同步写入：

```typescript
// theme-store.ts 的 zustand persist middleware
import { persist } from 'zustand/middleware';
```

使用 zustand `persist` middleware 即可自动同步部分 state 到 localStorage。

## Step 4: 生产构建 + v1 共存

### 构建步骤

```bash
cd frontend && vite build
# 输出到 frontend/dist/
```

### server.js 中的处理

server.js 已添加（Phase A Cursor 实现）：

```javascript
if (isDev) {
  // 开发模式：serve public/（旧版），前端用 Vite dev server
} else {
  // 生产模式：serve frontend/dist/
}
```

### 迁移策略

- `public/` 目录保留，v1 代码完全不动
- 构建后将 `vite build` 加入 electron-builder 的 beforeBuild 脚本
- 旧 `public/` 代码作为回退

### Rollup 分包优化

`vite.config.ts` 中加 manualChunks：

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        xterm: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
        react: ['react', 'react-dom'],
        ui: ['lucide-react'],
      },
    },
  },
},
```

## 完成标准

- [ ] ⌘K 打开/关闭，候选命令可执行
- [ ] 分区可拖拽，终端自动 resize
- [ ] 布局设置刷新后持久化
- [ ] `vite build` 成功，`frontend/dist/` 可被 server.js 正确服务
- [ ] `tsc --noEmit` 通过

## 后续方向（未涵盖）

- 命令拖拽排序（需后端支持 reorder API）
- 快捷键自定义（⌘+数字切换 tab 等）
- 终端搜索（Ctrl+F 搜索终端输出）
- 终端分屏（多 panel 同时显示）
