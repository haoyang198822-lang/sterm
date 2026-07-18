# S03: 侧边栏 — Frontend Phase C

## 背景

Phase B 完成了终端引擎，侧边栏当前为 Phase A 占位文字。Phase C 实现真正的侧边栏面板。

## 目标

1. 命令列表面板（Commands）— 读取/显示/搜索已保存命令
2. 速查面板（Cheats）— 对话式速查 UI，对标现有 R13 功能
3. 设置面板（Settings）— 终端配置、外观设置
4. 面板切换 — tab 点击切换生效

![...]

## 约束

- 后端 API 全在 server.js 的 `/api/` 路径下（不变）
- 数据模型与现有 `public/` 版本一致
- 不修改 server.js / lib/ / electron/ / public/
- 参考 Lucerna 的对话气泡样式
- CSS 变量用 `index.css` 已定义的 token（`--color-bg-surface-1` 等）

## 后端 API 协议

现有的 API（与 `public/js/app.js` 一致）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cheats/search?q=xx` | 搜索速查条目 |
| GET | `/api/cheats/categories` | 速查分类列表 |
| GET | `/api/commands` | 获取命令列表 |
| POST | `/api/commands` | 创建命令（body: `{command, description, category}`） |
| PUT | `/api/commands/:id` | 更新命令 |
| DELETE | `/api/commands/:id` | 删除命令 |
| GET | `/api/commands/categories` | 命令分类列表 |

WebSocket 消息（已由 use-websocket hook 处理）：

| type | 方向 | 说明 |
|------|------|------|
| `created` | 服务器→客户端 | `{id, shell}` — PTY 会话已创建 |
| `output` | 服务器→客户端 | `{sessionId, text}` — 终端输出 |
| `exit` | 服务器→客户端 | `{sessionId, exitCode}` — 会话退出 |
| `input` | 客户端→服务器 | `{sessionId, text}` — 输入转发 |
| `resize` | 客户端→服务器 | `{sessionId, cols, rows}` — 调整大小 |

## 实施步骤

### Step 1: API 请求封装

新建 `frontend/src/lib/api.ts`：

```typescript
const BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const api = {
  cheats: {
    search: (q: string) => fetchJSON<CheatItem[]>(`/cheats/search?q=${encodeURIComponent(q)}`),
    categories: () => fetchJSON<string[]>('/cheats/categories'),
  },
  commands: {
    list: () => fetchJSON<CommandItem[]>('/commands'),
    create: (cmd: Omit<CommandItem, 'id' | 'createdAt'>) =>
      fetchJSON<CommandItem>('/commands', { method: 'POST', body: JSON.stringify(cmd) }),
    update: (id: string, cmd: Partial<CommandItem>) =>
      fetchJSON<CommandItem>(`/commands/${id}`, { method: 'PUT', body: JSON.stringify(cmd) }),
    delete: (id: string) =>
      fetchJSON<void>(`/commands/${id}`, { method: 'DELETE' }),
    categories: () => fetchJSON<string[]>('/commands/categories'),
  },
};
```

### Step 2: 侧边栏 tab 切换

修改 `frontend/src/components/side-panel.tsx`：

- 去掉占位文字
- 用 `usePanelStore().activeTab` 控制显示的 panel
- 点击 tab 调用 `usePanelStore().setTab(tab)`
- tab 激活态用 `bg-[var(--color-bg-surface-1)]`、非激活用 `text-[var(--color-text-tertiary)]`

三个 tab 映射：

| tab | 组件 | 说明 |
|-----|------|------|
| `commands` | `<CommandsPanel />` | 命令列表 + CRUD dialogs |
| `cheats` | `<CheatsPanel />` | 对话式速查（对标 R13） |
| `settings` | `<SettingsPanel />` | 设置表单 |

### Step 3: CommandsPanel

新建 `frontend/src/components/commands-panel.tsx`。

功能：

1. **命令列表** — `GET /api/commands` → 渲染命令卡片列表
2. **搜索过滤** — 本地 filter（`cmd.command.includes(q) || cmd.description.includes(q)`）
3. **新建命令** — shadcn Dialog 表单（command, description, category）
4. **编辑命令** — 点击命令打开编辑 Dialog
5. **删除命令** — 确认后 `DELETE /api/commands/:id`
6. **分类过滤** — 可选 dropdown 按 category 筛选

命令卡片样式（参考 term 现有命令卡片）：

```
┌──────────────────────────────┐
│ $ git commit -m "xxx"       │  ← 命令文本，monospace
│ 提交代码                     │  ← 描述
│ git · 常用                    │  ← 分类标签
│ [编辑] [删除] [复制]          │  ← 操作按钮
└──────────────────────────────┘
```

Store 设计（在 `frontend/src/stores/command-store.ts`）：

```typescript
interface CommandStore {
  items: CommandItem[];
  loading: boolean;
  searchQuery: string;
  filterCategory: string;
  fetch: () => Promise<void>;
  create: (cmd: Omit<CommandItem, 'id' | 'createdAt'>) => Promise<void>;
  update: (id: string, cmd: Partial<CommandItem>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setSearch: (q: string) => void;
  setCategory: (c: string) => void;
}
```

### Step 4: CheatsPanel

新建 `frontend/src/components/cheats-panel.tsx`。

功能对标 R13（对话式速查）：

1. **消息列表** — 对话气泡，用户消息居右、AI 回复居左
2. **底部固定输入栏** — Textarea 自动增高 + Enter 发送 + Shift+Enter 换行
3. **发送按钮** — lucide Send 图标
4. **加载状态** — 发送后显示 typing indicator
5. **搜索** — 输入内容调用 `GET /api/cheats/search?q=...` + AI chat（通过 WS 或 HTTP）

参考 R13 的 HTML/CSS 结构，但用 React + Tailwind 实现：

```tsx
// 消息气泡
<div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
  <div className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
    isUser
      ? 'bg-blue-500 text-white'
      : 'bg-[var(--color-bg-surface-1)] text-[var(--color-text-primary)]'
  }`}>
    {/* Markdown 渲染内容 */}
    {content}
  </div>
</div>
```

### Step 5: SettingsPanel

新建 `frontend/src/components/settings-panel.tsx`。

设置项：

| 设置 | 类型 | store |
|------|------|-------|
| 字体大小（fontSize） | number input (11-18) | 暂时 localStorage，后续 theme-store |
| 字体族（fontFamily） | select (JetBrains Mono / Fira Code / Menlo / SF Mono) | 同上 |
| 光标样式（cursorStyle） | select (block / underline / bar) | 同上 |
| 光标闪烁（cursorBlink） | switch | 同上 |
| 终端背景色 | color input | 同 |

用 `<CommandDialog>` 风格或直接 `<div>` 渲染为设置表单，每个设置一行 label + control。

### Step 6: 恢复 side-panel 点击交互

确保 `side-panel.tsx` 的 tab 按钮有 `onClick={() => setTab(tab)}`。

## 完成标准

- [ ] 命令列表可读、可搜、可增删改
- [ ] 速查面板可发送消息并显示回复
- [ ] 设置面板可调整终端参数
- [ ] tab 切换流畅，无渲染错误
- [ ] `tsc --noEmit` 通过
- [ ] `vite build` 通过

## 未涵盖

- 命令拖拽排序（Phase D）
- ⌘K 全局命令面板（Phase D）
- 每个 tab 的 placeholder/empty state
- 命令导入导出
