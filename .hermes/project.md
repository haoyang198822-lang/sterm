# Project Identity: sterm

## 项目概述

xterm.js + node-pty 构建的桌面终端应用，Electron 打包为 macOS 原生应用。面向开发者的个人工具，强调键盘驱动、低视觉噪音、快速反馈。

## 设计哲学（来自 Design Wiki）

sterm 的 UI 设计严格遵循 `/Users/mac/Documents/Obsidian Vault/design wiki/` 中 Linear 设计体系，核心映射：

### 1. 世界观映射

| Linear 哲学（design-wiki/01/linear-design-philosophy.md） | sterm 应用 |
|----------------------------------------------------------|-----------|
| 界面不应该是「被看的」，应该是「被用的」 | 终端 UI 在终端激活时自动隐藏侧边栏、命令提示等次要元素，让用户只看到终端输出 |
| 黑暗不是模式，是介质（#08090a 画布） | 暗色为默认界面（#08090a canvas），亮色为可选切换 |
| 键盘是呼吸，鼠标是走路 | 全局 `⌘K` 命令面板、`/` 聚焦搜索、`⌘\` 切换侧边栏、`Escape` 关闭弹出层 |

### 2. 设计 Token 体系

CSS tokens 定义在 `public/css/app.css`，完全沿用 Linear Design Tokens（design-wiki/02/linear-design-tokens.md）：

**背景亮度梯度**：`#08090a` (canvas) → `#0f1011` (panel) → `#191a1b` (surface-1) → `#28282c` (surface-2) → `#323236` (surface-3)

**文字信息层级**：`#f7f8f8` (primary) → `#d0d6e0` (secondary) → `#8a8f98` (tertiary) → `#62666d` (quaternary)

**品牌色**：`--color-accent: #7170ff` — 统一的交互反馈色（选中态、Focus ring、CTA 按钮）

**关键规则**：
- 所有 hover 效果 0ms transition（参照 design-wiki/06/hover-and-focus.md）
- 间距使用 8px Grid（token: --space-*）
- 按钮默认用 Ghost 变体（rgba(255,255,255,0.02) 背景）
- Focus ring 用 `:focus-visible` 仅键盘 Tab 时显示，品牌紫 `2px`
- 无分割线 — 靠间距 + hover 高亮区分行

### 3. 字体系统

参照 design-wiki/02/linear-typography.md：

- UI 字体：Inter（Google Fonts 加载），字重体系 400/510/590
- 等宽字体：JetBrains Mono（终端使用）
- 全局开启 `font-feature-settings: "cv01", "ss03"`
- 页面 `body` 默认 font-size: 14px, 字重 400

### 4. 组件引用

所有 UI 组件的精确样式规格见 Design Wiki：

| 组件 | Design Wiki 文件 | sterm 位置 |
|------|-----------------|-----------|
| 按钮 (Ghost/Primary) | 03 Components/button.md | 侧边面板 Tab、命令收藏按钮、设置中的操作按钮、Dialog 按钮 |
| 输入框/搜索框 | 03 Components/input.md | 搜索命令输入框、⌘K 面板搜索、Dialog 表单输入 |
| 模态框 | 03 Components/modal.md | 收藏命令 Dialog |
| 键盘优先交互 | 05 UX Patterns/keyboard-first.md | 全局快捷键体系 |
| 命令面板 (⌘K) | 03 Components/modal.md（命令面板节） | `#command-palette` |
| 数据列表 / 操作隐藏到 hover | 04 Layout Patterns/data-list-page.md | 命令收藏列表（`panel-item-actions` hover 显示） |
| Hover/Focus/Selected | 06 Interaction/hover-and-focus.md | 所有交互元素（0ms transition） |

## 技术栈

- **前端**：Vite + React 19 + shadcn/ui (Radix primitives) + Tailwind CSS v4 + zustand
- **终端**：xterm.js 5.x + @xterm/react + FitAddon + WebLinksAddon
- **后端**：Express + WebSocket (ws) + node-pty
- **桌面**：Electron 34 + electron-builder 25（仅包装，前端用 Vite build 产物）
- **内核**：系统 Node.js（fork 子进程模式）
- **字体**：Inter（UI）+ JetBrains Mono（终端）

## 核心架构

```
sterm/
├── server.js           # Express + WebSocket + SessionManager（不动）
├── lib/                # ws-transport, terminal-session（不动）
├── electron/           # main.js, preload.js（小改：serve 路径指向 frontend/dist）
├── scripts/            # agent.js, agent-tools.js（不动）
├── sterm-data/         # 静态数据（不动）
├── public/             # 原版 vanilla JS（保留回退）
├── frontend/           # React SPA（新）
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── stores/
│   │   ├── hooks/
│   │   └── lib/
│   └── dist/           # vite build 输出
└── specs/
```

- **开发模式**：`node server.js` + `cd frontend && vite dev`，Vite 代理 API/WS 到 server.js 端口
- **桌面模式**：Electron 主进程 fork 系统 Node.js 跑 Express，serve `frontend/dist/` 静态文件
- **状态管理**：zustand stores（terminal / panel / snippet / theme）
- **组件系统**：shadcn/ui components + 自定义布局组件
- **通信模型**：xterm.js 通过 WebSocket ↔ server.js ↔ node-pty（同旧架构）
- **原生模块**：node-pty 使用 fork 子进程方案（方案 B），避免 NODE_MODULE_VERSION 不匹配

## 全局功能清单

> **架构迁移中**：v1（vanilla JS）所有功能已完成。v2（React）正在重构，以下清单反映迁移状态。

### 核心终端
| 功能 | v1 (vanilla) | v2 (React) 状态 |
|------|-------------|----------------|
| 多标签页（xterm.js 实例池） | DONE | Phase B |
| WebSocket 实时桥接（sessionId 路由） | DONE | Phase B |
| Cmd+C 选中文本复制 | DONE | Phase D |
| Finder 文件拖入自动输入路径 | DONE | Phase D |
| 连接状态栏 | DONE | Phase A |
| 暗/亮主题切换 | DONE | Phase A |
| 窗口拖放区域 | DONE | Phase B |

### 扩展 UI
| 功能 | v1 (vanilla) | v2 (React) 状态 |
|------|-------------|----------------|
| 侧边面板 + 可折叠 `⌘\\` | DONE | Phase A |
| 命令收藏 Tab（CRUD + 标签分组） | DONE | Phase C |
| 速查 Agent 对话 Tab | DONE | Phase C |
| 设置 Tab（字体/主题/行为） | DONE | Phase C |
| ⌘K 命令面板 | DONE | Phase D |
| 收藏命令 Dialog | DONE | Phase C |

### 已实现快捷键
| 快捷键 | 操作 | 参考（keyboard-first.md） |
|--------|------|--------------------------|
| `⌘K` | 打开命令面板 | 全局级，最高优先级 |
| `⌘\` | 切换侧边栏 | 页面级（workspace 控制） |
| `/` | 聚焦侧边栏搜索 | 页面级 |
| `Escape` | 关闭弹出层/取消编辑 | 全局级，逐层关闭 |
| `Enter` | 执行选中命令 | 组件级 |
| `↑↓` | 命令面板导航 | 组件级 |

## 设计决策记录

### 为什么 accent 色用 #4a7cff 而非 Linear 的 #5e6ad2？
sterm 最初使用稍亮、偏蓝的强调色（#4a7cff），在深色终端背景下更明显。但 **R10 已对齐 Linear 标准**：
- `--color-brand: #5e6ad2`（紫蓝，Primary CTA 按钮）
- `--color-accent: #7170ff`（交互/选中态）
- 终端状态指示仍保持独立（xterm theme.js 中的 blue: #4a7cff 不变）

### 为什么终端本身不遵循 Linear 设计？
xterm.js 的终端显示区（terminal buffer）使用自己的 xterm 主题色，不应用 Linear CSS tokens。只外围 UI（header/tabs/sidebar/statusbar/dialogs）应用 Linear 风格。

### 为什么侧边面板有 transition 而其他 hover 没有？
侧边面板的展开/折叠使用 0.15s transition（app.css L79）。因为这是一个「布局变化」而非「交互反馈」——布局变化需要平滑过渡以避免视觉跳跃。而所有 hover/focus 效果都保持 0ms 即时切换。

### 为什么 Dialog 有 0.2s 入场动画但 ⌘K 面板只有 0.15s？
Dialog 是模态操作，用户需要感知「模式切换」，所以用稍慢的 0.2s scale+fade。而 ⌘K 面板是键盘驱动的快速操作（用户期望即时弹出），所以仅 0.15s fade。

### 为什么弹窗粘贴不用 IPC 状态同步（isInputFocused）而用 executeJavaScript 异步路由？
Electron 的 `before-input-event` 里 `event.preventDefault()` 必须同步调用，但判断焦点在弹窗输入框还是终端需要查 DOM。用 IPC 状态同步 (`focusin` → `ipcMain.send('sterm-focus-state')` → 主进程 `isInputFocused` 标记) 存在两个问题：
1. xterm.js 内部隐藏 `<textarea>` 的 `INPUT` tagName 和弹窗 `<input>` 无法区分，导致终端粘贴也被跳过
2. IPC 消息和键盘事件的时序不同步，存在竞态

最终方案：`before-input-event` 中始终同步 `event.preventDefault()`，再用 `mainWindow.webContents.executeJavaScript()` 异步检查 `document.activeElement` 是否在弹窗/侧边栏的 input/textarea 中。如果是 → 用 `document.execCommand('insertText')` 粘贴到该元素；否则 → IPC 发送到 PTY。该方案还延伸覆盖了 Cmd+C（选中文本复制）。

详见 `specs/R09-dialog-copy-paste.md`。

## 关键文件结构

```
sterm/
├── server.js                    # Express + WebSocket + SessionManager（不动）
├── package.json                 # electron-builder 配置
├── AGENTS.md                    # 项目级代理规范
├── .hermes/project.md           # 项目身份信息
├── specs/
│   ├── README.md                # 架构迁移总览
│   ├── R*.*.md                  # v1 vanilla JS specs（已完成）
│   └── S*.*.md                  # v2 React specs（进行中）
├── public/                     # v1 vanilla（保留回退）
├── frontend/                   # v2 React SPA
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── stores/
│   │   ├── hooks/
│   │   └── lib/
│   └── dist/                   # build 输出
├── electron/                   # main.js, preload.js（小改）
├── lib/                        # ws-transport, terminal-session
├── scripts/                    # agent.js, agent-tools.js
├── sterm-data/                 # 静态数据
└── dist/mac/Sterm.app           # 构建产物
```

## 构建注意事项

- Electron 34 中 `File.path` 不可用（contextIsolation 限制），必须用 `webUtils.getPathForFile()`
- Electron 缓存在 `~/Library/Caches/electron/`，删除后需要代理或本地 `electronDist` 配置
- 默认不签名，首次打开需右键 → 打开（Gatekeeper）
- `asar: false` 必须，子进程需要直接文件系统访问
- macOS 12.x EGL 兼容性警告（不影响功能）

## 已知问题 / 待改进

- [FIXED] 弹窗输入框 Cmd+V/Cmd+C 被 before-input-event 拦截 → 用 executeJavaScript 异步路由解决
- macOS 12.x hiddenInset 标题栏模式下有 1px 白边（已用 #header::before 遮盖）
- 暂无「明/暗」跟随系统（仅手动切换）
- 暂无终端搜索（xterm 的 search addon 未启用）
