# sterm

xterm.js + node-pty 构建的 sterm 终端。

## 项目结构

```
sterm/
├── server.js       # Express + WebSocket + node-pty
├── package.json
├── AGENTS.md
├── specs/
│   ├── _index.md
│   └── batch-1/
│       ├── spec.md
│       └── review.md
└── public/
    ├── index.html
    ├── css/
    │   └── terminal.css
    └── js/
        ├── app.js
        └── theme.js
```

## Hermes Spec Workflow

- Hermes 写 specs/ → Cursor 实现 → Hermes review
- 小改动（5行以内）直接在 review 时 patch
- 所有代码操作限定在 sterm/ 目录下
