# sterm specs

项目：https://github.com/haoyang198822-lang/sterm

xterm.js + node-pty 终端，Express + WebSocket 后端。

---

## 架构迁移：v1 (vanilla JS) → v2 (React)

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase A | Vite + shadcn + 布局骨架 | **DONE** | `S01-phase-a-skeleton.md` |
| Phase B | WebSocket + xterm 终端引擎 | **DONE** | `S02-phase-b-terminal-engine.md` |
| Phase C | 侧边栏（命令/速查/设置） | **SPEC DONE** | `S03-phase-c-sidebar.md` |
| Phase D | ⌘K + 拖放 + bundle 集成 | **SPEC DONE** | `S04-phase-d-finale.md` |

## v1 已完成的 specs（vanilla JS，仅供参考）

- `R01-command-palette-arrow-nav.md`
- `R02-cheatsheet-polish.md`
- `R03-ui-visual-alignment.md`
- `R04-minor-polish.md`
- `R05-add-command-dialog.md`
- `R06-ui-polish-lucerna-level.md`
- `R07-edit-delete-commands.md`
- `R08-cheatsheet-reference.md`
- `R09-dialog-copy-paste.md`
- `R10-design-wiki-conformity.md`
- `R11-command-search-agent.md`
- `R12-agent-sidebar-integration.md`
- `R13-cheats-conversation-ui.md`
- `multi-terminal.md`

## Active（待实现）

| Spec | 内容 | 状态 |
|------|------|------|
| `R14-cheats-local-browse/spec.md` | 速查本地优先搜索 + 分类浏览 | **待实现** |

## 参考

- `archive/` — 各 batch 原始 spec，历史存档
- `reference/design-mockup.html` — UI 设计稿（v1）
