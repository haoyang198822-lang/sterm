# sterm

xterm.js + node-pty + Electron 桌面终端，面向开发者的个人工具。

## 项目结构

```
sterm/
├── server.js             # Express + WebSocket + node-pty（不动）
├── frontend/             # React SPA（v2 开发目录）
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/   # 14 个组件（纯 Tailwind, 无 shadcn）
│   │   ├── stores/       # 5 个 zustand stores
│   │   ├── hooks/
│   │   └── lib/
│   └── dist/
├── public/               # v1 vanilla（保留回退）
├── specs/
└── .hermes/project.md    # 项目身份（详细配置、设计决策）
```

## 当前阶段

**架构迁移 v1 → v2 已完成**。当前项目处于稳定迭代期：

- Phase A-B-C-D 全部完成（骨架 → 终端引擎 → 侧边栏 → ⌘K+收尾）
- S05 UI 精修（Lucerna 级别视觉打磨）— DONE
- S07 文件拖拽 — DONE
- R05-R13 扩展功能（Commands CRUD / Agent 搜索 / 对话式速查 / Design Wiki 对齐 / 粘贴多行修复 等）— DONE

详见 `specs/README.md`。

## 技术栈

- **前端**：Vite + React 19 + Tailwind CSS v4 + zustand + lucide-react（无 shadcn/ui 依赖）
- **终端**：xterm.js 5.x + FitAddon + WebLinksAddon
- **后端**：Express + WebSocket (ws) + node-pty
- **桌面**：Electron 34 + electron-builder 25
- **状态**：5 stores — terminal / panel / snippet / theme / command

## 关键组件

| 组件 | 用途 |
|------|------|
| `terminal-panel` | 多标签终端容器 |
| `xterm-wrapper` | xterm.js 实例 + WebSocket 桥接 |
| `side-panel` | 侧边栏容器（命令/速查/设置 三个 Tab） |
| `commands-panel` | 命令收藏 CRUD + 搜索/分类过滤 |
| `cheats-panel` | Agent 速查对话式 UI |
| `settings-panel` | 字体/主题/行为设置 |
| `command-palette` | `⌘K` 全局命令面板 |
| `panel-layout` | 主布局（Resizable 侧边栏） |
| `panel-status-bar` | 底部状态栏 |
| `theme-provider` | 暗/亮主题切换 |

## Hermes Spec Workflow

- Hermes 写 specs/ → Cursor 实现 → Hermes review
- 小改动（5行以内）直接在 review 时 patch
- 所有代码操作限定在 sterm/ 目录下
