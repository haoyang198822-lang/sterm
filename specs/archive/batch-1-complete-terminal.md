# batch-1: Trae 风格功能终端

## 需求说明

用 xterm.js + node-pty 构建一个功能完整的浏览器终端，视觉上完全复刻 Trae CN IDE 的底部终端面板。用户通过浏览器访问，能真正运行 zsh 命令。

## 目标目录

**所有文件操作限定在 `trae-terminal/` 目录下，禁止修改外部项目的任何文件。**

## 改动文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `package.json` | 新增 | 项目元数据 + 依赖声明 |
| `server.js` | 新增 | Express + WebSocket + node-pty 后端 |
| `public/index.html` | 新增 | 终端面板骨架 |
| `public/css/terminal.css` | 新增 | icube 主题 + 布局样式 |
| `public/js/theme.js` | 新增 | icube 配色常量（xterm Theme 接口） |
| `public/js/app.js` | 新增 | WebSocket 连接、xterm 实例化、UI 交互 |
| `README.md` | 新增 | 使用说明 |

## 详细规格

### 1. package.json

```json
{
  "name": "trae-terminal",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "ws": "^8.16.0",
    "node-pty": "^1.0.0",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0"
  }
}
```

依赖统一用 `npm install --save` 安装。无需 devDependencies。

### 2. server.js

**职责**：Express 静态服务器 + WebSocket 终端 I/O 桥接

**伪代码**：

```javascript
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { spawn } = require('node-pty');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 静态文件
app.use(express.static('public'));

// WebSocket 连接处理
wss.on('connection', (ws) => {
  // 1. 默认 shell 检测：process.env.SHELL || '/bin/zsh'
  const shell = process.env.SHELL || '/bin/zsh';
  const shellArgs = [];

  // 2. spawn pty，cwd=process.env.HOME
  const pty = spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env
  });

  // 3. pty 输出 → WebSocket 发送
  pty.onData(data => {
    try { ws.send(JSON.stringify({ type: 'data', text: data })); } catch (e) {}
  });

  // 4. pty 退出 → WebSocket 通知
  pty.onExit(({ exitCode }) => {
    try { ws.send(JSON.stringify({ type: 'exit', code: exitCode })); } catch (e) {}
    ws.close();
  });

  // 5. WebSocket 消息 → pty 写入
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'input') pty.write(msg.text);
      if (msg.type === 'resize') pty.resize(msg.cols, msg.rows);
    } catch (e) {}
  });

  // 6. 清理
  ws.on('close', () => {
    try { pty.kill(); } catch (e) {}
  });

  // 7. 错误处理
  ws.on('error', () => {
    try { pty.kill(); } catch (e) {}
  });
});

// 通用路由回退
app.get('*', (req, res) => res.sendFile(__dirname + '/public/index.html'));

// 监听 3000 端口
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`trae-terminal running at http://localhost:${PORT}`);
});
```

**注意事项**：
- 所有 WebSocket 消息都 JSON 序列化，包含 `type` 字段
- 错误处理要用 try-catch 包裹，避免未捕获异常杀死进程
- 不添加额外的安全认证（本地开发工具）

### 3. public/index.html

**职责**：终端面板 HTML 骨架

**结构**：

```
<body>
  <div id="app">
    <!-- Tab Bar -->
    <div id="tab-bar">
      <div id="tab-container">
        <div class="tab active" data-id="0">
          <span class="tab-icon">●</span>
          <span class="tab-label">bash</span>
          <button class="tab-close">✕</button>
        </div>
      </div>
      <div id="tab-actions">
        <button id="btn-new-tab" title="新建终端">+</button>
      </div>
    </div>

    <!-- Terminal Container -->
    <div id="terminal-container"></div>

    <!-- Bottom Toolbar -->
    <div id="bottom-bar">
      <div id="bottom-left">
        <button class="tool-btn" title="命令">@</button>
        <button class="tool-btn" title="标签">#</button>
        <button class="tool-btn" title="附件">🖼️</button>
      </div>
      <div id="bottom-center">
        <span class="mode-label">Auto</span>
        <span class="mode-arrow">▼</span>
      </div>
      <div id="bottom-right">
        <button class="tool-btn" title="语音">🎤</button>
        <button class="tool-btn submit-btn" title="发送">▶</button>
      </div>
    </div>
  </div>

  <script src="/js/theme.js"></script>
  <script src="/js/app.js"></script>
</body>
```

**注意事项**：
- 用 `<div id="terminal-container"></div>` 作为 xterm 挂载点
- 所有按钮加上 `title` 属性，方便鼠标悬停提示
- Tab Bar 只包含预设的 `bash` 标签，动态创建由 app.js 管理

### 4. public/css/terminal.css

**职责**：完整 icube 主题 + 终端面板布局

**布局尺寸**（基于 Trae CN 实际比例）：

```
Tab Bar:      height 36px, background #17191A
Terminal:     flex:1, background #1A1B1D
Bottom Bar:   height 40px, background #222427
```

**配色体系**（CSS 变量实现）：

```css
:root {
  /* 基础 */
  --bg-primary:    #1A1B1D;
  --bg-secondary:  #222427;
  --bg-tertiary:   #2A2D31;
  --bg-tab:        #17191A;
  --bg-hover:      rgba(224,226,242,0.05);
  --bg-active:     rgba(224,226,242,0.08);

  /* 文字 */
  --text-primary:   #D1D3DB;
  --text-secondary: #9599A6;
  --text-disabled:  #666B75;
  --text-highlight: #F5F9FE;

  /* 边框 */
  --border-color:   rgba(224,226,242,0.09);
  --border-active:  rgba(224,226,242,0.13);

  /* 品牌色 */
  --accent-blue:    #387BFF;
  --accent-green:   #33C192;
  --accent-red:     #F65A5A;
  --accent-yellow:  #DC8730;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 6px;
}
```

**关键样式**：

- `#app`：全屏 flex 列布局，`height:100vh`，`font-family: -apple-system,BlinkMacSystemFont,PingFang SC,sans-serif`
- `#tab-bar`：flex 行，`height:36px`，`bg-tab`，底部 `1px solid border-color`
- `.tab`：inline-flex，`padding: 6px 12px`，`font-size: 12px`，`color: text-secondary`，`cursor:pointer`，`border-radius: radius-sm`
- `.tab.active`：`color: text-highlight`，`bg-active`
- `.tab-icon`（●）：`color: accent-green`（bash 用绿色圆点），`margin-right: 6px`
- `.tab-close`：隐藏（除非 hover），hover 时显示，`color: text-disabled`
- `#terminal-container`：flex:1，overflow:hidden
- `.xterm`：`height:100%`，`padding: 4px 0`
- `.xterm-viewport`：`scrollbar-width: thin`
- `#bottom-bar`：flex 行，`height:40px`，`bg-secondary`，`border-top: 1px solid border-color`，`padding: 0 12px`
- `#bottom-left`：flex 行，gap 4px
- `.tool-btn`：`width: 28px, height: 28px`，圆形或圆角，`bg-transparent`，hover 时 `bg-hover`，`color: text-secondary`
- `.submit-btn`：`bg-accent-blue`，`color: white`，`border-radius: 6px`，hover 时加亮
- `#bottom-center`：flex，align center，font-size 11px，color text-disabled
- `::-webkit-scrollbar` 细化样式：窄滚动条（`width:6px`），圆角 thumb

**xterm.js 自定义覆写**：`.terminal-editor .xterm` 系列的样式不用动（xterm 内部 canvas 渲染由 Theme 对象控制），但外层 wrapper 需要覆盖：

```css
#terminal-container .xterm {
  height: 100%;
  padding: 4px 8px;
}
```

### 5. public/js/theme.js

**职责**：导出 icube 配色常量（xterm.js ITheme 接口格式）

> 注意：xterm v5 的 Theme 接口支持 16 色 + 界面色，ITheme 类型定义见 `@xterm/xterm`。

```javascript
const ICUBE_THEME = {
  background: '#1A1B1D',
  foreground: '#D1D3DB',
  cursor: '#FFFFFF',
  cursorAccent: '#1A1B1D',
  selectionBackground: 'rgba(53, 121, 255, 0.28)',
  selectionInactiveBackground: 'rgba(58, 61, 65, 0.5)',

  // 标准 16 ANSI 色
  black: '#2A2D31',
  red: '#F65A5A',
  green: '#33C192',
  yellow: '#DC8730',
  blue: '#387BFF',
  magenta: '#B38CFF',
  cyan: '#80BBFF',
  white: '#D1D3DB',

  brightBlack: '#666B75',
  brightRed: '#F86262',
  brightGreen: '#5ED4AD',
  brightYellow: '#EB9B61',
  brightBlue: '#4C88FF',
  brightMagenta: '#C77DFF',
  brightCyan: '#98CEFF',
  brightWhite: '#F5F9FE',
};
```

**禁止改动**：颜色值是精确提取自 Trae CN `theme-icube/dark_color.json`，每个色值都有出处，不可随意替换。

### 6. public/js/app.js

**职责**：应用主逻辑 — WebSocket 连接、xterm 实例化、UI 事件绑定

**伪代码**（精确到函数签名）：

```javascript
// 1. 等待 DOM 就绪
document.addEventListener('DOMContentLoaded', () => {
  initTerminal();
  initUI();
});

// 2. 获取 terminal-container 元素
const terminalContainer = document.getElementById('terminal-container');

// 3. 创建 WebSocket 连接
let ws = null;
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => { /* 可选：发送心跳或初始化消息 */ };
  ws.onclose = () => {
    // 5 秒后重连
    setTimeout(connectWebSocket, 5000);
  };
  ws.onerror = () => { /* 自动触发 onclose */ };
}

// 4. 初始化 xterm
let terminal = null;
function initTerminal() {
  // 加载 xterm.js (ESM from CDN or bundled)
  // 使用 @xterm/xterm CDN:
  // import { Terminal } from '...';
  // import { FitAddon } from '...';

  terminal = new Terminal({
    theme: ICUBE_THEME,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    cursorBlink: true,
    cursorStyle: 'bar',
    allowProposedApi: true,
    cols: 80,
    rows: 24,
  });

  // Fit addon
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  // Web Links addon
  const webLinksAddon = new WebLinksAddon();
  terminal.loadAddon(webLinksAddon);

  // 挂载到 DOM
  terminal.open(terminalContainer);

  // 首次适配
  setTimeout(() => fitAddon.fit(), 50);

  // 监听 resize
  const resizeObserver = new ResizeObserver(() => fitAddon.fit());
  resizeObserver.observe(terminalContainer);

  // 终端输入 → WebSocket
  terminal.onData(data => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', text: data }));
    }
  });

  // WebSocket 消息 → 终端输出
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'data') {
      terminal.write(msg.text);
    } else if (msg.type === 'exit') {
      terminal.write(`\r\n\x1b[33m[进程退出，代码: ${msg.code}]\x1b[0m\r\n`);
    }
  };
}

// 5. UI 交互
function initUI() {
  // 新建标签按钮
  document.getElementById('btn-new-tab').addEventListener('click', () => {
    // 写入新行提示
    terminal.write('\r\n$ ');
  });

  // 发送按钮
  document.querySelector('.submit-btn').addEventListener('click', () => {
    terminal.write('\r');
  });

  // 标签关闭
  document.querySelectorAll('.tab-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // 关闭终端（演示用）
      terminal.dispose();
      ws.close();
    });
  });
}

// 6. 窗口 resize 重新 fit
window.addEventListener('resize', () => {
  if (terminal) fitAddon.fit();
});

// 7. 启动
initTerminal();
connectWebSocket();
```

**CDN 加载方式**：由于项目没有打包工具，xterm.js 及其 addon 通过 CDN 的 ESM 方式加载：

```html
<script type="importmap">
{
  "imports": {
    "@xterm/xterm": "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.mjs",
    "@xterm/addon-fit": "https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.mjs",
    "@xterm/addon-web-links": "https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0.11.0/lib/addon-web-links.mjs"
  }
}
</script>
<script type="module" src="/js/app.js"></script>
```

> 如果使用 module 方式，app.js 也要改为 `export`/`import` 模式，theme.js 也要改为 ESM 导出。

**实际实现时选择以下两种方式之一**（不要混用）：

**方案 A（CDN + importmap）**：
- index.html 用 `<script type="importmap">` 声明 CDN
- app.js 用 `import { Terminal } from '@xterm/xterm'`
- theme.js 用 `export const ICUBE_THEME = {...}`
- 优点：零构建步骤
- 缺点：需要浏览器支持 importmap

**方案 B（npm + <script> 标签）**：
- 从 node_modules 复制 xterm.css 到 public/css/
- 用 `<script src="/node_modules/...">` 加载
- 优点：离线可用
- 缺点：需要处理路径

**推荐方案 A**，更简洁。

### 7. README.md

项目根目录的简短使用说明，包含：
- 项目简述
- 前置要求（Node.js >= 18）
- 安装步骤：`npm install`
- 启动：`npm start`
- 访问：`http://localhost:3000`

## API 契约

### WebSocket 消息格式（双向 JSON）

| 方向 | type 字段 | 数据字段 | 说明 |
|------|-----------|----------|------|
| Server→Client | `data` | `text: string` | 终端输出（含 ANSI 转义） |
| Server→Client | `exit` | `code: number` | 进程退出 |
| Client→Server | `input` | `text: string` | 用户输入（含 ANSI 转义序列） |
| Client→Server | `resize` | `cols: number, rows: number` | 终端尺寸变更 |

### 端口

- HTTP 服务：`3000`（可通过 `PORT` 环境变量覆盖）
- WebSocket：与 HTTP 共享端口

## 注意事项

1. **xterm.js 的 z-index/滚动样式**：xterm 内部 canvas 使用绝对定位，terminal-container 必须设 `position: relative` 和 `overflow: hidden`
2. **node-pty 踩坑**：macOS 上需要 Xcode Command Line Tools，如果无法 spawn shell 检查 `process.env.SHELL`
3. **WebSocket 粘包**：服务端 data event 可能频繁触发，JSON 序列化单条发送即可
4. **Resize 防抖**：xterm fitAddon.fit() 绑定到 ResizeObserver 已够用，不要再额外 debounce
5. **字体**：优先使用 JetBrains Mono / Fira Code 等等宽字体，若用户未安装则 fallback 到 Consolas/monospace
6. **不要动 node_modules**：依赖安装后不要修改包内容
7. **CSP 策略**：CDN 加载时确保没有 Content-Security-Policy 阻止外部脚本（本地开发无需 CSP，不加即可）

## 验收标准

- [x] ❌ `npm install && npm start` 后浏览器访问 `http://localhost:3000` 显示终端界面
- [x] ❌ 终端面板布局：Tab Bar（36px）、Terminal 区域、Bottom Bar（40px）
- [x] ❌ Tab Bar 显示一个 "bash" 标签，带绿色圆点图标
- [x] ❌ Bottom Bar 显示 @ # 🖼️ Auto ▼ 🎤 ▶ 按钮
- [x] ❌ 终端渲染 zsh 提示符，能执行 ls、pwd、cd 等命令并看到正确输出
- [x] ❌ xterm 背景色 #1A1B1D，前景色 #D1D3DB（icube 主题）
- [x] ❌ 窗口缩放时终端自动适配列数行数
- [x] ❌ URL 在终端中可点击打开
- [x] ❌ 关闭终端标签 / 刷新页面后 WebSocket 自动重连
- [x] ❌ 无 JS 控制台错误
