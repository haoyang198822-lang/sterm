# Project Identity: sterm

## 项目概述
xterm.js + node-pty 构建的 sterm 桌面终端应用，使用 Electron 打包为 macOS 原生应用。

## 技术栈
- **前端**：xterm.js 5.x + FitAddon + WebLinksAddon
- **后端**：Express + WebSocket (ws) + node-pty
- **桌面**：Electron 34 + electron-builder 25
- **内核**：系统 Node.js（fork 子进程模式）

## 核心架构
- **开发模式**：`node server.js` 直接启动 Web 版，浏览器访问 localhost:3000
- **桌面模式**：Electron 主进程 fork 系统 Node.js 跑 Express 服务，用随机端口避免冲突
- **原生模块**：node-pty 使用 fork 子进程方案（方案 B），避免 NODE_MODULE_VERSION 不匹配
- **路径**：开发时 `baseDir = path.join(__dirname, '..')`，打包后 `process.resourcesPath + '/app'`

## 构建命令
```bash
cd /Users/mac/LLM/trae-terminal
npx electron-builder --mac --dir    # 构建 .app 到 dist/mac/
# electronDist 配置指向 node_modules/electron/dist，无需下载
```

## 已知功能
- Express 静态服务 / WebSocket 终端桥接
- Cmd+C 选中文本复制（`attachCustomKeyEventHandler` + `navigator.clipboard.writeText`）
- Finder 文件拖入自动输入路径（`webUtils.getPathForFile()` 通过 preload IPC）
- 暗/亮主题切换
- 状态栏：连接状态 + 当前目录 + shell 类型
- macOS 12.x EGL 兼容性警告（不影响功能）

## 关键文件
- `electron/main.js` — Electron 主进程
- `electron/preload.js` — contextBridge 安全桥接
- `server.js` — Express + WebSocket + node-pty 服务（支持 `require` 和 CLI 双模式）
- `public/index.html` — 终端 UI 布局
- `public/js/app.js` — 终端初始化、WebSocket 连接、拖放/复制逻辑
- `public/js/theme.js` — 暗/亮主题色定义
- `public/css/terminal.css` — UI 样式

## 构建产物
`/Users/mac/LLM/sterm/dist/mac/Sterm.app`

## 注意事项
- Electron 34 中 `File.path` 不可用（contextIsolation 限制），必须用 `webUtils.getPathForFile()`
- Electron 缓存在 `~/Library/Caches/electron/`，删除后需要代理或本地 `electronDist` 配置
- 默认不签名，首次打开需右键 → 打开（Gatekeeper）
- `asar: false` 必须，子进程需要直接文件系统访问
