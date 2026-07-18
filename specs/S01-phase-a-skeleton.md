# S01: React 骨架搭建 - Frontend Phase A

## 背景

sterm v1（vanilla JS）功能已齐但维护困难：单文件 app.js 无组件拆分、无状态管理、无框架。决定迁移到 Vite + React 19 + shadcn/ui + Tailwind CSS v4 + zustand。

Phase A 搭建项目骨架：Vite 初始化、shadcn 安装、布局框架（终端区域 + 侧边栏 + 状态栏）、状态管理结构、以及跟后端 server.js 的 dev/prod 配合。

## 目标

1. `frontend/` 目录初始化为 Vite + React + TypeScript 项目
2. shadcn/ui + Tailwind CSS v4 安装配置
3. zustand stores 骨架（空 store 待填）
4. 布局框架：Resizable 面板（终端区 + 侧边栏）+ StatusBar
5. 占位组件：TerminalPanel / SidePanel / StatusBar
6. Dev 模式：Vite 代理 API/WS 到 server.js
7. Prod 模式：server.js CDN-like 输出 `frontend/dist/`

## 改动文件

| 文件 | 改动 |
|------|------|
| `frontend/`（新目录） | 整个新项目 |
| `server.js` | +20 行：开发环境 WS 代理 + 生产环境静态文件 serve |
| `AGENTS.md` | 已更新 |
| `.hermes/project.md` | 已更新 |

## 实现细节

### 1. 初始化 frontend/

```bash
cd /Users/mac/LLM/sterm
mkdir frontend && cd frontend
pnpm create vite . --template react-ts
pnpm add tailwindcss @tailwindcss/vite
pnpm add react@19 react-dom@19
pnpm add @shadcn/react
pnpm add zustand
pnpm add @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
pnpm add re-resizable  # 或 lucide-react（用于图标）
```

Tailwind 配置（`frontend/vite.config.ts`）：

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      // WebSocket 代理到 server.js
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

shadcn init：

```bash
npx shadcn@latest init
```

选择：TypeScript / CSS variables (oklch) / 暗色模式 class / base color Neutral / 使用 Tailwind v4 格式。

### 2. shadcn 组件安装

```bash
npx shadcn@latest add resizable tabs dialog command textarea button separator scroll-area tooltip switch sheet
```

根据 shadcn 官网当前组件列表，使用：
- **Resizable** — 终端与侧边栏可拖拽分割（核心布局）
- **Tabs** — 侧边栏 命令/速查/设置 标签切换
- **Dialog** — 添加编辑命令弹窗
- **Command** — ⌘K 命令调色板
- **Textarea** — 速查输入框
- **Button** — 按钮
- **Separator** — 分割线
- **ScrollArea** — 滚动容器
- **Tooltip** — 按钮提示
- **Switch** — 设置开关

如需图标，安装 `lucide-react`：
```bash
pnpm add lucide-react
```

### 3. 目录结构

```
frontend/src/
├── App.tsx                     # 应用根布局
├── main.tsx                    # 入口
├── index.css                   # Tailwind 入口 + CSS 变量
├── stores/
│   ├── terminal-store.ts       # 终端状态（会话列表、活跃ID、WS 状态）
│   ├── panel-store.ts          # 侧边栏（展开/折叠、活跃tab）
│   ├── snippet-store.ts        # 命令收藏（列表、CRUD 操作）
│   └── theme-store.ts          # 主题状态（亮/暗）
├── components/
│   ├── panel-layout.tsx        # Resizable 布局：终端 + 侧边栏
│   ├── terminal-panel.tsx      # 终端区域（占位）
│   ├── panel-status-bar.tsx    # 底部状态栏
│   ├── side-panel.tsx          # 侧边栏容器 + Tabs
│   └── theme-provider.tsx      # 亮/暗主题上下文
├── hooks/
│   ├── use-websocket.ts        # WebSocket 连接管理（占位）
│   └── use-theme.ts            # 主题切换
└── lib/
    └── utils.ts                # cn() 等工具函数
```

### 4. 布局实现

**整体布局（App.tsx）**：

```tsx
<ThemeProvider>
  <div className="h-screen w-screen flex flex-col bg-[#08090a] text-[#f7f8f8] font-sans">
    <PanelLayout />
    <PanelStatusBar />
  </div>
</ThemeProvider>
```

**PanelLayout（核心布局）**：

使用 shadcn Resizable 组件创建：
- 左侧：终端区域（弹性宽度）
- 右侧：侧边栏面板（240px-400px，可拖拽边界）

```tsx
<ResizablePanelGroup direction="horizontal" className="flex-1">
  <ResizablePanel defaultSize={75} minSize={40}>
    <TerminalPanel />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={25} minSize={20} maxSize={60} collapsedSize={0}>
    <SidePanel />
  </ResizablePanel>
</ResizablePanelGroup>
```

侧边栏折叠状态由 `panel-store.ts` 控制，通过 `collapsedSize={0}` 和 `onCollapse` 实现。

**PanelStatusBar**：

固定在底部，高度 28px。包含：
- 左侧：连接指示器（圆点 + shell 名称）
- 右侧：☰ 折叠侧边栏按钮 + 主题切换按钮

### 5. zustand stores（骨架）

```typescript
// stores/terminal-store.ts
import { create } from 'zustand'

interface TerminalSession {
  id: string
  title: string
}

interface TerminalStore {
  sessions: TerminalSession[]
  activeSessionId: string | null
  wsConnected: boolean
  addSession: (session: TerminalSession) => void
  removeSession: (id: string) => void
  setActive: (id: string) => void
  setWsConnected: (connected: boolean) => void
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: [],
  activeSessionId: null,
  wsConnected: false,
  addSession: (session) =>
    set((state) => ({ sessions: [...state.sessions, session] })),
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
    })),
  setActive: (id) => set({ activeSessionId: id }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
}))
```

```typescript
// stores/panel-store.ts
import { create } from 'zustand'

type TabId = 'commands' | 'agent' | 'settings'

interface PanelStore {
  collapsed: boolean
  activeTab: TabId
  toggle: () => void
  setTab: (tab: TabId) => void
}

export const usePanelStore = create<PanelStore>((set) => ({
  collapsed: false,
  activeTab: 'commands',
  toggle: () => set((state) => ({ collapsed: !state.collapsed })),
  setTab: (tab) => set({ activeTab: tab }),
}))
```

```typescript
// stores/theme-store.ts
import { create } from 'zustand'

interface ThemeStore {
  isLight: boolean
  toggle: () => void
}

export const useThemeStore = create<ThemeStore>((set) => ({
  isLight: localStorage.getItem('sterm-theme') === 'light',
  toggle: () =>
    set((state) => {
      const next = !state.isLight
      localStorage.setItem('sterm-theme', next ? 'light' : 'dark')
      document.documentElement.classList.toggle('light', next)
      return { isLight: next }
    }),
}))
```

```typescript
// stores/snippet-store.ts — 骨架，Phase C 完善
import { create } from 'zustand'

interface Snippet {
  id: string
  label: string
  command: string
  tags: string[]
}

interface SnippetStore {
  snippets: Snippet[]
  // Phase C 实现
  load: () => void
  add: (s: Snippet) => void
  remove: (id: string) => void
}

export const useSnippetStore = create<SnippetStore>((set) => ({
  snippets: [],
  load: () => {},
  add: (s) => set((state) => ({ snippets: [...state.snippets, s] })),
  remove: (id) =>
    set((state) => ({ snippets: state.snippets.filter((s) => s.id !== id) })),
}))
```

### 6. ThemeProvider

shadcn 的标准主题实现。使用 Tailwind v4 的 `@dark` 方式：

```tsx
// components/theme-provider.tsx
'use client'
import { useEffect } from 'react'
import { useThemeStore } from '@/stores/theme-store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isLight = useThemeStore((s) => s.isLight)

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLight)
  }, [isLight])

  return <>{children}</>
}
```

`frontend/src/index.css`：

```css
@import "tailwindcss";

:root {
  /* Linear Design Tokens 映射到 Tailwind CSS v4 */
  --color-bg-canvas: #08090a;
  --color-bg-panel: #0f1011;
  --color-bg-surface-1: #191a1b;
  --color-bg-surface-2: #28282c;

  --color-text-primary: #f7f8f8;
  --color-text-secondary: #d0d6e0;
  --color-text-tertiary: #8a8f98;
  --color-text-quaternary: #62666d;

  --color-brand: #5e6ad2;
  --color-accent: #7170ff;
  --color-accent-hover: #828fff;

  --color-border-subtle: rgba(255,255,255,0.05);
  --color-border-standard: rgba(255,255,255,0.08);
}

.light {
  --color-bg-canvas: #f7f8f8;
  --color-bg-panel: #ffffff;
  --color-bg-surface-1: #ffffff;
  --color-bg-surface-2: #f3f4f5;

  --color-text-primary: #1a1a1a;
  --color-text-secondary: #4a4a4a;
  --color-text-tertiary: #8a8a8a;
  --color-text-quaternary: #b0b0b0;

  --color-border-subtle: rgba(0,0,0,0.06);
  --color-border-standard: rgba(0,0,0,0.10);
}
```

执行 `pnpm add @fontsource/inter @fontsource/jetbrains-mono` 或在 `index.css` 中加载 Google Fonts：

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;510;590&family=JetBrains+Mono&display=swap');
```

### 7. server.js 改动

在现有 `server.js` 中增加模式切换：

```javascript
// 在创建 Express app 后
const isDev = process.env.NODE_ENV === 'development'

if (isDev) {
  // 开发模式：Vite 会代理 API 到 :3000，不需要额外配置
  // server.js 保持原样，仅服务 API 和 WebSocket
} else {
  // 生产模式：serve React 构建产物
  const frontendDist = path.join(__dirname, 'frontend', 'dist')
  app.use(express.static(frontendDist))
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(frontendDist, 'index.html'))
    }
  })
}
```

修改 `electron/main.js` 中的路径，确保启动时 `NODE_ENV=production` 环境变量被传递给子进程：

```javascript
// 在 startServer() 中的 spawn 参数增加
env: { ...process.env, NODE_ENV: 'production' }
```

### 8. 占位组件

**TerminalPanel** — 简单占位：

```tsx
export function TerminalPanel() {
  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-canvas)]">
      {/* tab bar */}
      <div className="flex items-center h-9 px-3 gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]">
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-bg-surface-1)] text-xs text-[var(--color-text-primary)]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          zsh
          <button className="ml-1 text-[var(--color-text-quaternary)] hover:text-[var(--color-text-primary)]">×</button>
        </div>
        <button className="text-[var(--color-text-quaternary)] hover:text-[var(--color-text-primary)] text-sm px-1">+</button>
      </div>
      {/* xterm 容器占位 */}
      <div className="flex-1 p-2 text-xs text-[var(--color-text-quaternary)] font-mono">
        [终端输出区域 — Phase B 实现]
      </div>
    </div>
  )
}
```

**SidePanel** — Tabs + 占位内容：

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export function SidePanel() {
  return (
    <Tabs defaultValue="commands" className="h-full flex flex-col">
      <TabsList className="justify-start px-3 h-9 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]">
        <TabsTrigger value="commands">命令</TabsTrigger>
        <TabsTrigger value="agent">速查</TabsTrigger>
        <TabsTrigger value="settings">设置</TabsTrigger>
      </TabsList>
      <TabsContent value="commands" className="flex-1 overflow-auto p-3 text-xs text-[var(--color-text-tertiary)]" forceMount>
        [命令收藏 — Phase C 实现]
      </TabsContent>
      <TabsContent value="agent" className="flex-1 flex flex-col text-xs text-[var(--color-text-tertiary)]" forceMount>
        [速查 Agent 对话 — Phase C 实现]
      </TabsContent>
      <TabsContent value="settings" className="flex-1 overflow-auto p-3 text-xs text-[var(--color-text-tertiary)]" forceMount>
        [设置面板 — Phase C 实现]
      </TabsContent>
    </Tabs>
  )
}
```

**PanelStatusBar** — 底栏：

```tsx
import { useTerminalStore } from '@/stores/terminal-store'
import { usePanelStore } from '@/stores/panel-store'
import { useThemeStore } from '@/stores/theme-store'
import { PanelLeft, Sun, Moon } from 'lucide-react'

export function PanelStatusBar() {
  const wsConnected = useTerminalStore((s) => s.wsConnected)
  const togglePanel = usePanelStore((s) => s.toggle)
  const { isLight, toggle: toggleTheme } = useThemeStore()

  return (
    <div className="h-7 flex items-center px-3 gap-3 text-xs border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-[var(--color-text-tertiary)]">
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
        {wsConnected ? '已连接' : '已断开'}
      </span>
      <div className="flex-1" />
      <button onClick={togglePanel} className="hover:text-[var(--color-text-primary)] transition-colors">
        <PanelLeft className="w-3.5 h-3.5" />
      </button>
      <button onClick={toggleTheme} className="hover:text-[var(--color-text-primary)] transition-colors">
        {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
```

## 注意事项

1. ❌ 不要修改 `public/`、`lib/`、`electron/`、`scripts/`、`sterm-data/` 目录下的文件。只改 `AGENTS.md`、`.hermes/project.md`、`specs/README.md`（已更新）
2. ⚠️ `lucide-react` 需要单独安装，用于图标
3. ⚠️ 侧边栏折叠功能：shadcn ResizablePanel 的 `collapsedSize` 和 `onCollapse` 可能需要自定义 hook 来配合
4. ⚠️ `forceMount` 用在 TabsContent 上，切换 tab 时保留 DOM 内容不被销毁（命令列表/对话历史需要持久）
5. ⚠️ CSS 变量命名改用 `--color-*` 前缀，跟 Tailwind v3 方式兼容，shadcn 自动识别

## 验证标准

```bash
# 1. Vite dev server 启动，无错误
cd frontend && pnpm dev

# 2. 访问 localhost:5173，看到布局：
#    - 左侧终端区域（灰色占位）
#    - 右侧侧边栏（Tabs: 命令/速查/设置，都是占位内容）
#    - 底部状态栏（连接指示 + 按钮）

# 3. 侧边栏可拖拽调整宽度（240px-400px）
# 4. 点击状态栏 ☰ 按钮折叠/展开侧边栏
# 5. 点击主题按钮切换亮/暗模式
# 6. 切换 Tabs（命令/速查/设置）不报错

# 7. 生产模式验证
VITE_BUILD=1 cd frontend && pnpm build
cd /Users/mac/LLM/sterm && node server.js
# 访问 localhost:3000 看到相同布局

# 8. 无 TypeScript 编译错误
cd frontend && pnpm tsc --noEmit
```
