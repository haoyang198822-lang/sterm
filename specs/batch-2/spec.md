# batch-2: 基于 Linear Design 哲学的 UI 重构

## 需求说明

trae-terminal 现在的 UI 源于 Trae IDE 的底部终端面板仿制，底部栏残留了 AI 聊天按钮（@ # 🖼️ 🎤 ▶），不适合独立终端应用。

参照 `/Users/mac/LLM/Lucerna` 项目背后的设计哲学——**Linear Design**（完整文档见 Obsidian `/design wiki/`），对整个界面做一次遵循设计原则的全面重构。

**Cursor 约束**：本 spec 引用的设计哲学已完整内嵌在下方 `## 设计推导` 部分，Cursor 不需要访问外部文件。

**核心设计目标**：让终端界面「感觉不到界面」——每次用户注意到 UI 本身（而不是终端内容），都是一次设计失败。

## 设计推导（从 Linear 哲学到终端设计）

### 推导 1：「黑暗是介质，不是模式」

Linear 认为暗色不是「给亮色界面套 dark theme」，而是**从黑暗中生长出来的 UI**。

终端天然是黑暗的——用户把 80% 的注意力放在终端文本上。所以 UI 控件（标签栏、状态栏）应该「从黑暗中浮现」，而不是「贴在亮条上」。

**终端设计应用**：
- 标签栏和状态栏的背景色与终端背景的亮度差 ≤ 10%（刚好够区分，不抢夺注意力）
- 边框用 `rgba(255,255,255,0.05)`（几乎不可见的「边界暗示」，不是「画线」）
- 纯黑 `#000` 不可用——用极深灰 `#0b0c0d` 保持像素微激活

### 推导 2：「颜色是信号，不是颜料」

Linear 的色彩纪律：只有 6 种语义色，整个系统没有冗余色。

**终端设计应用**：
- 终端指示器（绿点）：唯一的状态色，表示 `connected = 活跃`
- 品牌蓝：仅用于可交互元素（按钮 hover、选中态）
- 没有橙色、黄色、红色在正常状态出现——红色仅在终端进程异常退出时由 xterm 内部渲染
- 所有 UI 控件按钮在默认态用 `--text-tertiary`（柔灰），hover 提升到 `--text-secondary`

### 推导 3：「间距是看不见的线条」

Linear 不用边框线来分隔信息，用间距和背景色微妙变化。

**终端设计应用**：
- 标签页之间没有垂直分隔线 → 靠 `8px gap` 自然分组
- 标签栏和终端区域之间可以有 `1px` 淡边框（用户需要知道标题栏的结束点），但用最低透明度
- 状态栏和终端之间同理

### 推导 4：「每一次认知切换都是偷税」

用户每次在界面上「找东西」都是在缴认知税。

**终端设计应用**：
- 底部栏移除所有 AI 聊天按钮（@ # 🖼️ 🎤 ▶）——终端用户从不扫视「该点哪个按钮」
- 状态栏展示**真正有用的信息**：shell 类型、连接状态、当前路径
- 标签 hover 才显示关闭按钮 → 平时不争夺注意力

### 推导 5：「动效越快越好，1ms 也是等待」

**终端设计应用**：
- 所有 UI 控件（hover、active、focus）**0ms transition**
- 主题切换即时生效，无需过渡动画
- 标签切换、关闭、新建全部瞬间完成

### 推导 6：「510 字重：不粗不细的精确」

UI 标签用 `510` 字重，正文阅读用 `400`，强调用 `590`，**不使用 700（Bold）**。

**终端设计应用**：
- 标签栏上标签名用 `--font-weight-ui: 510`
- 状态栏的文字用 `--font-weight-read: 400`
- 终端本身用 `--font-mono`（JetBrains Mono），字重 400

## 改动文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `public/css/terminal.css` | 重写 | 全面采用 Linear Design Tokens + 新布局 |
| `public/index.html` | 修改 | 重构骨架：移除 AI 按钮，新增状态栏 |
| `public/js/app.js` | 修改 | 适配新 UI：主题切换、连接状态更新、cwd 显示 |
| `public/js/theme.js` | 修改 | 增加亮色 xterm 主题常量 |

## 详细规格

### 1. CSS Design Tokens（精确 Linear 值，不可随意替换）

以下 token 值直接来自 Design Wiki 的 Linear Design Tokens 文档。**每个色值都有出处，不可随意替换。** 终端色系做了微调（bg-canvas 略暖以适应终端长时间阅读）。

```css
:root {
  /* ── 背景表面（亮度梯度，从深到浅） ── */
  /* 哲学原理：「黑暗是介质」。终端背景最深，UI 控件逐级浮现 */
  --bg-canvas:    #0b0c0d;   /* 最深画布 ← 终端背景，比 #000 保留微像素 */
  --bg-panel:     #101112;   /* 面板背景 ← 标签栏/状态栏 */
  --bg-surface-1: #1a1b1d;   /* 标准表面 ← 标签激活态、hover 背景 */
  --bg-surface-2: #222326;   /* 高亮表面 ← 按钮 hover */

  /* ── 文字色（光衰减梯度，从亮到暗） ── */
  /* 哲学原理：「白色不是颜色，是亮度」 */
  --text-primary:   #ebedf0;   /* 主内容 → 标签名、状态文字 */
  --text-secondary: #a0a4ae;   /* 次要信息 → 次级标签 */
  --text-tertiary:  #6c7080;   /* 辅助信息 → 状态栏默认文字、按钮图标 */
  --text-quaternary:#4a4d57;   /* 最低层级 → 禁用态 */

  /* ── 品牌/强调色（仅一种） ── */
  /* 哲学原理：「颜色是信号，不是颜料」— 整个系统只有一种强调色 */
  --color-accent:       #4a7cff;   /* 可交互元素、选中态 */
  --color-accent-hover: #5c8aff;   /* 更亮版本用于 hover */

  /* ── 功能色（仅绿/红，没有黄色/橙色） ── */
  --color-success:      #2bae5c;   /* 连接活跃、状态指示 */
  --color-error:        #e64a4a;   /* 仅系统级错误，非品牌色 */

  /* ── 边框（极浅，仅「暗示边界」） ── */
  --border-subtle:   rgba(255,255,255,0.06);   /* 标签栏底部分隔 */
  --border-standard: rgba(255,255,255,0.10);   /* 组件边框 */

  /* ── 间距（8px Grid，不允许非 4 倍数值） ── */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;

  /* ── 圆角（不超过 3 种） ── */
  --radius-sm:    4px;     /* 小控件、标签 */
  --radius-md:    6px;     /* 按钮（最常用） */
  --radius-full:  9999px;  /* 状态指示点（绿点） */

  /* ── 字体 ── */
  /* UI 用 Inter，终端用等宽 */
  --font-sans: "Inter", "Inter Variable", "PingFang SC", -apple-system, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", "Consolas", monospace;

  /* ── 字重体系（Linear 签名系统，不使用 Bold/700） ── */
  --font-weight-read:     400;   /* 正文、状态文字 */
  --font-weight-ui:       510;   /* UI 标签、按钮（Linear 签名字重） */
  --font-weight-emphasis: 590;   /* 强调文案（极少使用） */

  /* ── 字号（Linear 微调体系） ── */
  --text-xs:   11px;   /* 状态栏 */
  --text-sm:   13px;   /* 标签栏 */
  --text-base: 14px;   /* 终端（xterm fontSize） */
}

/* ── Inter OpenType 特性（Linear 标志性字形） ── */
* {
  font-feature-settings: "cv01", "ss03";
}
```

**亮色模式**: `.light` class 加到 `<body>` 上时覆盖以下 token：

```css
.light {
  --bg-canvas:    #f0f1f3;
  --bg-panel:     #f8f9fa;
  --bg-surface-1: #ffffff;
  --bg-surface-2: #ecedf0;

  --text-primary:   #1a1b1e;
  --text-secondary: #4e5058;
  --text-tertiary:  #8a8e99;
  --text-quaternary:#b0b4be;

  --color-accent:       #3366e6;
  --color-accent-hover: #4477ff;
  --color-success:      #1e8b4c;

  --border-subtle:   rgba(0,0,0,0.06);
  --border-standard: rgba(0,0,0,0.10);
}
```

### 2. HTML 骨架（index.html）

**布局结构**（三段式，从「黑暗介质」中浮现）：

```
┌─ #header ──────────────────────────────────┐  height: 36px
│ [● bash] [● node]    [+] [⋮]              │  bg: --bg-panel
├─────────────────────────────────────────────┤  border-bottom: 1px solid --border-subtle
│                                             │
│          #terminal-container                │  flex: 1
│          终端内容 (bg: --bg-canvas)          │  bg: --bg-canvas
│                                             │
├─────────────────────────────────────────────┤  border-top: 1px solid --border-subtle
│ bash ●  已连接    │  ~/project     │ zsh  ☀ │  height: 28px, bg: --bg-panel
└─────────────────────────────────────────────┘
```

**header 设计说明**（来自 Linear：「间距是看不见的线条」）：
- 标签之间没有垂直分隔线 — 靠 `gap: 2px` 自然分组
- 标签激活态用 `--bg-panel`（比 header 背景 `--bg-panel` ...实际上 header 就是 panel 背景）
- 更正：标签激活态用 `--bg-surface-1`（比 header 亮一级，表明「选中」）

**完整 HTML**：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>trae-terminal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;510;590&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/terminal.css">
</head>
<body>
  <div id="app">
    <!-- Header: 标签栏（兼 Electron 拖拽区） -->
    <div id="header">
      <div id="tab-container">
        <div class="tab active" data-id="0">
          <span class="tab-dot"></span>
          <span class="tab-label">bash</span>
          <button class="tab-close" type="button">✕</button>
        </div>
      </div>
      <div id="header-actions">
        <button id="btn-new-tab" type="button" title="新建终端">+</button>
        <button id="btn-menu" type="button" title="菜单">⋮</button>
      </div>
    </div>

    <!-- 终端挂载点 -->
    <div id="terminal-container"></div>

    <!-- StatusBar: 终端状态信息 -->
    <div id="status-bar">
      <div class="status-group status-left">
        <span class="status-dot" id="statusDot"></span>
        <span class="status-label" id="statusShell">bash</span>
        <span class="status-sep"></span>
        <span class="status-label status-conn" id="statusConn">已连接</span>
      </div>
      <div class="status-group status-center">
        <span class="status-cwd" id="statusCwd">~</span>
      </div>
      <div class="status-group status-right">
        <span class="status-mono" id="statusType">zsh</span>
        <span class="status-sep"></span>
        <button class="status-btn" id="btnTheme" type="button" title="切换主题">☀</button>
      </div>
    </div>
  </div>

  <script src="/node_modules/@xterm/xterm/lib/xterm.js"></script>
  <script src="/node_modules/@xterm/addon-fit/lib/addon-fit.js"></script>
  <script src="/node_modules/@xterm/addon-web-links/lib/addon-web-links.js"></script>
  <script src="/js/theme.js"></script>
  <script src="/js/app.js"></script>
</body>
</html>
```

### 3. CSS 布局样式

**全局重置**（Linear：「动效越快越好」，所以 `transition: none`）：

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

body {
  background: var(--bg-canvas);
  color: var(--text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* Linear 铁律：所有交互元素 0ms transition */
button, a, input, select, textarea {
  transition: none !important;
}

button {
  font-family: inherit;
}
```

**#app 容器**：
```css
#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-canvas);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-read);
}
```

**#header（36px）**：
- 哲学：「间距是看不见的线条」— 标签栏和终端之间只有一条极浅边框，没有多余分隔
```css
#header {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  padding: 0 var(--space-2);
  -webkit-app-region: drag;
  user-select: none;
}
```

**#tab-container**（水平滚动，gap 分隔）：
```css
#tab-container {
  display: flex;
  align-items: center;
  flex: 1;
  overflow-x: auto;
  gap: 2px;
  -webkit-app-region: no-drag;
  scrollbar-width: none;
}
#tab-container::-webkit-scrollbar { display: none; }
```

**Tab 样式**：
```css
.tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  height: 28px;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-ui);  /* 510 — Linear 签名字重 */
  color: var(--text-tertiary);         /* 未选中 = 低调 */
  cursor: pointer;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  -webkit-app-region: no-drag;
}
.tab.active {
  color: var(--text-primary);
  background: var(--bg-surface-1);     /* 选中 = 表面浮现 */
}
.tab:hover {
  color: var(--text-secondary);
  background: var(--bg-surface-1);     /* hover 即时响应，无过渡 */
}
```

**Tab 指示点（绿点）**：
```css
.tab-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--color-success);
  flex-shrink: 0;
}
```

**Tab 关闭按钮**（hover 才显示）：
- 哲学：「每次认知切换都是偷税」— 平时不出现，需要时才浮现
```css
.tab-close {
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-quaternary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  opacity: 0;
  -webkit-app-region: no-drag;
}
.tab:hover .tab-close { opacity: 1; }
.tab-close:hover {
  background: var(--bg-surface-2);
  color: var(--text-secondary);
}
```

**#header-actions**（新建 + 菜单按钮）：
```css
#header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  -webkit-app-region: no-drag;
}
#header-actions button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-lg);
}
#header-actions button:hover {
  background: var(--bg-surface-2);
  color: var(--text-secondary);
}
```

**#terminal-container**：
```css
#terminal-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--bg-canvas);
}
#terminal-container .xterm {
  height: 100%;
  padding: var(--space-1) var(--space-2);
}
#terminal-container .xterm-viewport {
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.08) transparent;
}
```

**#status-bar（28px）**：
- 哲学：「颜色是信号」— 绿/灰指示器直接传达连接状态
- 28px 比原 40px 紧凑，把更多空间留给终端
```css
#status-bar {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 var(--space-3);
  background: var(--bg-panel);
  border-top: 1px solid var(--border-subtle);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-read);  /* 400 — 不抢眼 */
  flex-shrink: 0;
  user-select: none;
}

.status-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-left { flex-shrink: 0; }
.status-center {
  flex: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-right { flex-shrink: 0; }
```

**状态指示器（绿/灰点）**：
```css
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--color-success);
  flex-shrink: 0;
}
.status-dot.disconnected {
  background: var(--text-quaternary);
}
```

**状态文字**：
```css
.status-label {
  color: var(--text-secondary);
  font-weight: var(--font-weight-ui);  /* 510 */
  font-size: var(--text-xs);
}
.status-label.status-conn {
  color: var(--color-success);
}
.status-label.status-conn.disconnected {
  color: var(--text-tertiary);
}

.status-cwd {
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.status-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.status-sep {
  width: 1px;
  height: 12px;
  background: var(--border-standard);
}
```

**状态栏按钮（主题切换）**：
```css
.status-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.status-btn:hover {
  background: var(--bg-surface-2);
  color: var(--text-secondary);
}
```

**滚动条（极简，不抢夺注意力）**：
```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }

.light ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); }
.light ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.15); }
```

### 4. app.js 修改

**新增功能**：
1. 主题切换（深色↔亮色），localStorage 持久化
2. 状态栏连接状态指示更新（WebSocket 连接/断开时更新绿点 + 文字）
3. 状态栏 cwd 显示（预留接口，初始显示 `~`）
4. 由于 AI 聊天按钮已移除，删除对应的 `#` `#` `🖼️` `🎤` `▶` 事件绑定

**完整伪代码**（覆盖原有 initUI 和 initTerminal）：

```javascript
var terminalContainer = document.getElementById('terminal-container');
var terminal = null;
var fitAddon = null;
var ws = null;

var FitAddon = window.FitAddon.FitAddon || window.FitAddon;
var WebLinksAddon = window.WebLinksAddon.WebLinksAddon || window.WebLinksAddon;

// ── 主题切换 ──
function toggleTheme() {
  var isLight = document.body.classList.toggle('light');
  var btn = document.getElementById('btnTheme');
  btn.textContent = isLight ? '☾' : '☀';
  if (terminal) {
    terminal.setOption('theme', isLight ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME);
  }
  localStorage.setItem('trae-terminal-theme', isLight ? 'light' : 'dark');
}

// ── 连接状态更新 ──
function setConnectionStatus(connected) {
  var dot = document.getElementById('statusDot');
  var conn = document.getElementById('statusConn');
  dot.className = 'status-dot' + (connected ? '' : ' disconnected');
  conn.className = 'status-label status-conn' + (connected ? '' : ' disconnected');
  conn.textContent = connected ? '已连接' : '已断开';
}

// ── cwd 更新（预留，初始值为 ~） ──
function setCwd(path) {
  document.getElementById('statusCwd').textContent = path || '~';
}

// ── WebSocket（保持原有逻辑，增加状态通知） ──
function connectWebSocket() {
  var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(protocol + '//' + location.host);

  ws.onopen = function () {
    setConnectionStatus(true);
  };
  ws.onclose = function () {
    setConnectionStatus(false);
    setTimeout(connectWebSocket, 5000);
  };
  ws.onerror = function () {};

  ws.onmessage = function (event) {
    if (!terminal) return;
    try {
      var msg = JSON.parse(event.data);
      if (msg.type === 'data') {
        terminal.write(msg.text);
      } else if (msg.type === 'exit') {
        terminal.write('\r\n\x1b[33m[进程退出，代码: ' + msg.code + ']\x1b[0m\r\n');
      }
    } catch (e) {}
  };
}

// ── 初始化 xterm ──
function initTerminal() {
  // 检查 localStorage 主题偏好
  var savedTheme = localStorage.getItem('trae-terminal-theme');
  var isLight = savedTheme === 'light';
  if (isLight) {
    document.body.classList.add('light');
    document.getElementById('btnTheme').textContent = '☾';
  }

  terminal = new Terminal({
    theme: isLight ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    cursorBlink: true,
    cursorStyle: 'bar',
    allowProposedApi: true,
    cols: 80,
    rows: 24,
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());
  terminal.open(terminalContainer);

  setTimeout(function () {
    fitAddon.fit();
    sendResize();
  }, 50);

  var resizeObserver = new ResizeObserver(function () {
    fitAddon.fit();
    sendResize();
  });
  resizeObserver.observe(terminalContainer);

  terminal.onData(function (data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', text: data }));
    }
  });

  connectWebSocket();

  window.addEventListener('resize', function () {
    if (terminal && fitAddon) {
      fitAddon.fit();
      sendResize();
    }
  });
}

function sendResize() {
  if (!terminal || !fitAddon || !ws || ws.readyState !== WebSocket.OPEN) return;
  var dims = fitAddon.proposeDimensions();
  if (dims) {
    ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
  }
}

// ── 新 UI 事件绑定（移除 AI 按钮相关代码） ──
function initUI() {
  // 主题切换
  document.getElementById('btnTheme').addEventListener('click', toggleTheme);

  // 新建终端标签
  document.getElementById('btn-new-tab').addEventListener('click', function () {
    if (terminal) terminal.write('\r\n$ ');
  });

  // 标签关闭
  document.querySelectorAll('.tab-close').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (terminal) terminal.dispose();
      if (ws) ws.close();
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initTerminal();
  initUI();
});
```

### 5. theme.js 修改

原有的 `ICUBE_THEME` 重命名为 `DARK_TERMINAL_THEME`（语义更明确），并新增亮色主题：

```javascript
// 深色 xterm 主题（与 Linear Design 配色一致）
var DARK_TERMINAL_THEME = {
  background: '#0B0C0D',
  foreground: '#EBEDF0',
  cursor: '#FFFFFF',
  cursorAccent: '#0B0C0D',
  selectionBackground: 'rgba(74, 124, 255, 0.28)',
  selectionInactiveBackground: 'rgba(255,255,255,0.08)',
  black: '#4A4D57',
  red: '#E64A4A',
  green: '#2BAE5C',
  yellow: '#D4942E',
  blue: '#4A7CFF',
  magenta: '#8B5CF6',
  cyan: '#22D3EE',
  white: '#A0A4AE',
  brightBlack: '#6C7080',
  brightRed: '#F06060',
  brightGreen: '#3DC97A',
  brightYellow: '#E8A84C',
  brightBlue: '#5C8AFF',
  brightMagenta: '#A78BFA',
  brightCyan: '#67E8F9',
  brightWhite: '#EBEDF0',
};

// 亮色 xterm 主题
var LIGHT_TERMINAL_THEME = {
  background: '#F0F1F3',
  foreground: '#1A1B1E',
  cursor: '#1A1B1E',
  cursorAccent: '#F0F1F3',
  selectionBackground: 'rgba(51, 102, 230, 0.20)',
  selectionInactiveBackground: 'rgba(0,0,0,0.06)',
  black: '#8A8E99',
  red: '#D63939',
  green: '#1E8B4C',
  yellow: '#B87A1F',
  blue: '#3366E6',
  magenta: '#8B5CF6',
  cyan: '#0891B2',
  white: '#4E5058',
  brightBlack: '#B0B4BE',
  brightRed: '#E64A4A',
  brightGreen: '#2DA85E',
  brightYellow: '#D4942E',
  brightBlue: '#4477FF',
  brightMagenta: '#A78BFA',
  brightCyan: '#22D3EE',
  brightWhite: '#1A1B1E',
};
```

### 6. Electron 适配（不修改 main.js，但记录设计决策）

Electron 窗口的 `main.js` 已设置 `backgroundColor: '#1A1B1D'`，改为 `backgroundColor: '#0B0C0D'` 与新配色对齐：

```javascript
// main.js createWindow 部分，仅修改 backgroundColor
mainWindow = new BrowserWindow({
  // ... 其他参数保持不变 ...
  backgroundColor: '#0B0C0D',
  titleBarStyle: 'hiddenInset',  // macOS: 保留 traffic lights
  // ...
});
```

## 设计验证检查清单（验收标准）

从 Linear Design 哲学推导出的验收标准：

| # | 标准 | 对应哲学 |
|---|------|---------|
| 1 | 界面只有 6 种语义色（主/次/辅/最低 + 品牌蓝 + 成功绿），无多余颜色 | 颜色是信号 |
| 2 | 移除所有 AI 聊天按钮（@ # 🖼️ 🎤 ▶），不再出现 | 认知切换是偷税 |
| 3 | StatusBar 28px，比原 40px 紧凑 | 界面不是被看的 |
| 4 | 状态栏绿/灰点直接表达连接状态，无需额外文字说明 | 颜色是信号 |
| 5 | 所有 hover/active 无 transition 动画 | 动效越快越好 |
| 6 | 标签栏没有垂直分隔线，靠间距自然分组 | 间距是线条 |
| 7 | 标签激活态用 `--bg-surface-1`，与 header 有亮度差 | 黑暗是介质 |
| 8 | 标签关闭按钮默认隐藏，hover 才显示 | 认知切换是偷税 |
| 9 | UI 文字用 Inter，字重 510（标签）/ 400（状态文字），无 Bold | 510 字重 |
| 10 | 所有间距是 4/8/12/16/24/32 的倍数，没有奇数间距 | 8px Grid |
| 11 | 主题切换后 xterm 颜色同步变化 | 界面完整 |
| 12 | localStorage 保存主题偏好 | 用户体验 |
| 13 | 无 JS 控制台错误 | 工程质量 |
| 14 | 终端功能完整：命令执行、resize、WebSocket 重连 | 产品完整 |
