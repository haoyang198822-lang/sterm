# S05: UI 精修 — 全组件视觉打磨

## 背景

Phase A-D 实现了功能骨架，但 UI 是原生 HTML 水平——命令列表 `${item.command}` 纯文字、速查 textarea + `<div>`、设置裸表单。Phase D 中 status bar 和布局也需要打磨。

目标：用 shadcn v4 (`@shadcn/react` + `@base-ui/react` 基座) + Design Wiki tokens 把每个组件做成 Lucerna 级别。

## 步骤

### Step 0: 安装 shadcn v4 + 所需组件

```bash
cd frontend
npx shadcn@latest init    # 选择 dark, Tailwind v4
npx shadcn@latest add button badge card dialog input textarea select switch scroll-area separator kbd spinner bubble message message-scroller empty skeleton
```

初始化后 `components/ui/` 下会出现对应的 `*.tsx` 文件。shadcn v4 自动使用 `@base-ui/react` 基座。

**注意**：shadcn init 可能会修改 `index.css` 覆盖已有的 CSS 变量。init 后需要恢复我们自己定义的 Linear tokens（`--color-bg-canvas` 等）。

### Step 1: 修复 xterm 导入问题

**问题**：`@xterm/addon-fit` 和 `@xterm/addon-web-links` 的 npm 包是 UMD 格式，Vite 预打包后只有 `default` 导出，但 TypeScript 类型定义是 `export class FitAddon`。导致：
- `import { FitAddon } from '@xterm/addon-fit'` → 类型正确但运行时 undefined
- `import FitAddon from '@xterm/addon-fit'` → 运行时正确但类型报错

**修复**：在 `vite.config.ts` 中强制将 xterm 包转为 ESM：

```typescript
optimizeDeps: {
  include: ['@xterm/addon-fit', '@xterm/addon-web-links'],
},
ssr: {
  noExternal: ['@xterm/addon-fit', '@xterm/addon-web-links'],
},
```

然后恢复 `xterm-wrapper.tsx` 为静态导入：

```typescript
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
```

### Step 2: CommandsPanel — 命令卡片

用 shadcn `Card` + `Button` + `Badge` + `Dialog` 重写 `commands-panel.tsx`。

**布局**：
```
┌─ 命令面板 ─────────────────────┐
│ [搜索输入框 / Search...]        │
│ [全部分类 ▼]                    │
│ ┌──────────────────────────┐   │
│ │ $ git commit -m "xxx"    │   │
│ │ 提交代码                  │   │
│ │ git · 常用               │   │
│ │ [复制] [编辑] [删除]      │   │
│ └──────────────────────────┘   │
│ ┌──────────────────────────┐   │
│ │ $ npm run dev            │   │
│ │ 启动开发服务器            │   │
│ │ 开发 · 前端              │   │
│ │ [复制] [编辑] [删除]      │   │
│ └──────────────────────────┘   │
│                       [+ 新增] │
└──────────────────────────────┘
```

**卡片样式**（Linear 风格）：
- 背景：`var(--color-bg-surface-1)`
- 边框：`var(--color-border-subtle)`
- 命令文本 monospace、`var(--color-text-primary)`
- 描述 `var(--color-text-secondary)` 14px
- 分类 Badge：ghost 样式（`rgba(255,255,255,0.04)` 背景）
- 操作按钮（复制/编辑/删除）：hover 时才显示（`opacity-0 group-hover:opacity-100`）

**Dialog**（新增命令/编辑命令）：
- 使用 shadcn `Dialog` 组件（`@base-ui/react` 版）
- 字段：command (textarea monospace), description (input), category (input/select)
- 确认/取消按钮

### Step 3: CheatsPanel — 对话气泡

用 shadcn `Bubble` + `Message` + `MessageScroller` + `Textarea` + `Button` + `Spinner` 重写 `cheats-panel.tsx`。

**布局**：
```
┌─ 速查面板 ─────────────────────┐
│ ╔══════════════════════════╗   │
│ ║ 欢迎！输入问题搜索速查     ║   │
│ ╚══════════════════════════╝   │
│                                │
│ ┌──────────────────────┐       │
│ │ 用户消息              │ →    │
│ └──────────────────────┘       │
│                                │
│ ← ┌──────────────────┐        │
│    │ AI 回复（Markdown）│        │
│    └──────────────────┘        │
│                                │
│ [Spinner... 加载中]            │
│                                │
│ ┌────────────────────────────┐ │
│ │ 输入速查问题… (Shift+Enter │ │
│ │ 换行，Enter 发送)           │ │
│ │                    [发送]  │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

**对话气泡**：
- 用户消息：`bg-[var(--color-accent)] text-white` 居右，圆角 `12px 12px 4px 12px`
- AI 回复：`bg-[var(--color-bg-surface-1)]` 居左，圆角 `12px 12px 12px 4px`
- 代码块（markdown 渲染）：`bg-[var(--color-bg-canvas)]` monospace，带复制按钮
- 消息列表：`MessageScroller` 自动滚到底

**输入栏**：
- 固定在底部
- `Textarea` 自动增高（`rows={1}` + CSS `field-sizing: content`）
- Enter 发送，Shift+Enter 换行
- 发送按钮用 shadcn `Button`（Icon 变体，`Send` 图标）

### Step 4: SettingsPanel — 设置表单

用 shadcn `Input` + `Select` + `Switch` + `Button` 重写 `settings-panel.tsx`。

**布局**（每行一个设置，label + control 左右布局）：
```
┌─ 设置面板 ─────────────────────┐
│ 字体大小     [13        ▲▼]   │
│ 字体         [JetBrains Mono▼] │
│ 光标样式     [block      ▼]   │
│ 光标闪烁     [○——● ]         │
│ 终端背景     [■ #08090a ]     │
└────────────────────────────────┘
```

**实现注意**：
- 使用 `@shadcn/react` 的 `Select`（基于 `@base-ui/react/select`）而非原生 `<select>`
- 开关用 `Switch`（基于 `@base-ui/react/switch`）
- label 左对齐，control 右对齐
- 每行 `flex items-center justify-between py-2`

### Step 5: 布局视觉打磨

**侧边栏 tab**（side-panel.tsx）：
- 使用 shadcn `Tabs` 组件替换手动 tab 切换
- 选中态：`bg-[var(--color-bg-surface-1)] text-[var(--color-text-primary)]`
- 非选中：`text-[var(--color-text-tertiary)]`
- 不带下划线，纯背景变化

**面板头部**：
- 每个 panel 顶部 32px 标题栏 + 分割线（当前是 `h-9`，对齐 8px grid → 32px = `h-8`）
- 背景：`var(--color-bg-panel)`

**状态栏**（panel-status-bar.tsx）：
- 使用 `Separator` 组件替代 `|` 字符
- 连接指示：绿点用 `Badge` variant 或 `h-2 w-2 rounded-full bg-green-500`
- 图标按钮用 shadcn `Button`（variant="ghost", size="icon"）

**命令面板 / ⌘K**（command-palette.tsx）：
- 用 shadcn `Command` 组件替换手动实现
- 半透明蒙层 backdrop
- 搜索框带 `Search` 图标
- 候选列表带 `Kbd` 快捷键提示

**panel-layout.tsx**：
- 如果后续要统一，可以从 `re-resizable` 迁移到 shadcn `Resizable`
- 当前 `re-resizable` 功能正常，可暂不换

## Design Wiki 映射

| shadcn 组件 | Design Wiki 变体 | token |
|------------|------------------|-------|
| Button "ghost" | 1.1 Ghost | 默认 `rgba(255,255,255,0.02)` hover `rgba(255,255,255,0.08)` |
| Button "subtle" | 1.2 Subtle | 默认 `rgba(255,255,255,0.04)` |
| Button "default" | 1.4 Primary | 背景 `#5e6ad2` hover `#828fff` |
| Card | 数据列表卡片 | 背景 `var(--color-bg-surface-1)` 边框 `var(--color-border-subtle)` |
| Badge "secondary" | 标签系统 | 同 `bg-surface-1` + `text-tertiary` |
| Dialog | 模态框(modal.md) | 背景 `var(--color-bg-panel)` 无边框 `shadow-2xl` |
| Input | 输入框(input.md) | 背景 `var(--color-bg-surface-1)` 边框 `var(--color-border-subtle)` |
| Select | 选择器(select.md) | 同上 |
| Switch | — | accent 色 `var(--color-accent)` |

## 完成标准

- [ ] 命令面板显示卡片列表，hover 显示操作按钮
- [ ] Dialog 新增/编辑命令功能正常
- [ ] 速查面板对话气泡样式，发送/接收正常
- [ ] 设置面板所有控件布局规整
- [ ] 状态栏/侧边栏 tab 用 shadcn 组件
- [ ] xterm addon 静态导入无类型错误
- [ ] `tsc --noEmit` 通过
- [ ] `vite build` 通过
- [ ] 浏览器验证视觉效果
