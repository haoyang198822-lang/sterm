# batch-3: 架构重构 — 止血 + 建立边界

## 需求说明

基于 sterm 架构评审报告（见 Obsidian `sterm-architecture-review.md`）列出的架构问题，对项目做一次系统性重构。

**核心目标**：将项目从「可运行原型」升级为「工程架构清晰、可维护、可扩展」的桌面终端应用。

**执行策略**：本批次只改架构层，不改 UI 视觉层。UI 改动在 batch-2 中处理。

## 改动范围优先级

| 优先级 | 条目 | 对应评审章节 | 预估工作量 |
|--------|------|------------|-----------|
| P0 | ① 移除硬编码 Node 路径 | §3.1.1 | ~10 行 |
| P0 | ② 空 catch 替换为结构化日志 | §3.2.2 | ~30 行 + 新文件 |
| P0 | ③ 收缩 /node_modules 暴露范围 | §3.2.4 | ~5 行 |
| P1 | ④ server.js 拆分为三层 | §3.2.1 | ~150 行 + 新文件 |
| P1 | ⑤ 消息协议 schema 定义 | §3.2.3 | ~40 行 + 新文件 |
| P1 | ⑥ 移除 executeJavaScript 耦合 | §3.1.2 | ~30 行 |
| P1 | ⑦ 抽象 TerminalSession | §5.2 | ~80 行 + 新文件 |

**执行顺序**：按上表序号 ①→②→③→④→⑤→⑥→⑦ 依次进行。每完成一项，确认不破坏终端基本功能。

## 改动文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `electron/main.js` | 修改 | 移除硬编码 Node 路径 + 移除 executeJavaScript 耦合 |
| `electron/preload.js` | 修改 | 增加 IPC 通道替代 executeJavaScript |
| `server.js` | 修改 | 瘦身为 Express 启动入口，不直接处理 PTY/WS |
| `lib/logger.js` | **新建** | 结构化日志模块 |
| `lib/terminal-session.js` | **新建** | TerminalSession 抽象 |
| `lib/message-schema.js` | **新建** | WebSocket 消息 schema 定义 + 校验 |
| `lib/ws-transport.js` | **新建** | WebSocket 传输层 |
| `public/index.html` | 修改 | 调整 xterm.js 加载方式（去 /node_modules 依赖） |
| `package.json` | 修改 | 保持 main/scripts/build 不变 |
| `.gitignore` | 修改 | 增加 `lib/` 目录新建文件的 git 追踪确认 |

**禁止改动**：`public/css/terminal.css`、`public/js/theme.js`、`public/js/app.js`（UI 视觉层归 batch-2）。`electron/preload.js` 可以改。

## 详细规格

### ① 移除硬编码 Node 路径

#### 问题

`electron/main.js:13` 写死：
```javascript
const nodePath = '/Users/mac/.nvm/versions/node/v22.22.3/bin/node';
```

这导致：
- 只能在当前开发环境工作
- 打包后不可移植
- 机器迁移后直接失效

#### 解决方案

**方法 A：`process.execPath`（推荐）**

在主进程中使用 Electron 内置的 `process.execPath` 获取当前 Node.js 可执行路径。Electron 34 引入的 Node.js 版本与 `node-pty` 兼容性已改善（实测可用），不再需要 fork 外部 Node 子进程。

```javascript
// electron/main.js — 修改 startServer()
const nodePath = process.execPath;  // 当前 Electron 内置 Node 的路径
```

**但注意：** `node-pty` 是原生 C++ 模块，需要与 Electron 的 `NODE_MODULE_VERSION` 兼容。如果 `node-pty` 在 Electron 34 下直接 require 不报错，则 `process.execPath` 就是正确方案。

**方法 B（备选—如果 node-pty 不兼容）**：用 `which node` 动态查找：

```javascript
const { execSync } = require('child_process');
function findNodePath() {
  try {
    return execSync('which node', { encoding: 'utf8' }).trim();
  } catch {
    return '/usr/local/bin/node';  // 最终 fallback
  }
}
```

**验收标准**：
- [ ] `electron/main.js` 中没有 `/Users/mac/.nvm/versions/node/` 字面量
- [ ] 启动时 `[server] sterm running at ...` 正常输出
- [ ] 浏览器访问终端正常渲染，可执行命令

---

### ② 空 catch 替换为结构化日志

#### 问题

代码中大量出现：
```javascript
try {
  // ...
} catch (error) {}
```

涉及文件：
- `server.js:48` — pty.onData catch
- `server.js:54` — pty.onExit catch
- `server.js:56` — ws.close catch
- `server.js:70` — ws.on('message') catch
- `server.js:75` — pty.kill() catch
- `server.js:82` — pty.kill() catch（同）
- `app.js:76` — ws.onmessage JSON.parse catch
- `electron/main.js:91` — executeJavaScript catch（×2）

#### 解决方案

**新建 `/Users/mac/LLM/sterm/lib/logger.js`**：

```javascript
// lib/logger.js — 结构化日志模块
// 设计原则：简单、可 grep、不引入第三方依赖

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || 'INFO';

function formatTime() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function log(level, tag, message, data) {
  if (LOG_LEVELS[level] < LOG_LEVELS[CURRENT_LEVEL]) return;
  const prefix = `[${formatTime()}] [${level}] [${tag}]`;
  if (data !== undefined) {
    console.log(prefix, message, JSON.stringify(data));
  } else {
    console.log(prefix, message);
  }
}

module.exports = {
  debug: (tag, msg, data) => log('DEBUG', tag, msg, data),
  info:  (tag, msg, data) => log('INFO',  tag, msg, data),
  warn:  (tag, msg, data) => log('WARN',  tag, msg, data),
  error: (tag, msg, data) => log('ERROR', tag, msg, data),
};
```

**所有空 catch 改为**：

```javascript
// server.js — 修改示例
const logger = require('./lib/logger');

// pty.onData
pty.onData((data) => {
  try {
    ws.send(JSON.stringify({ type: 'data', text: data }));
  } catch (err) {
    logger.error('pty', 'onData 发送失败', { error: err.message });
  }
});

// ws.on('message')
ws.on('message', (raw) => {
  try {
    const msg = JSON.parse(raw.toString());
    // ...
  } catch (err) {
    logger.warn('ws', '消息解析失败', { raw: raw.toString().substring(0, 100) });
  }
});
```

**验收标准**：
- [ ] 搜索 `} catch (error) {}` 或 `} catch (e) {}` — 已全部替换为带日志的 catch
- [ ] `lib/logger.js` 存在且被 server.js 引用
- [ ] 运行 `LOG_LEVEL=DEBUG node server.js` 能看到每条 catch 的日志输出

---

### ③ 收缩 /node_modules 暴露范围

#### 问题

`server.js:12` 暴露了整个 `node_modules`：
```javascript
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
```

#### 解决方案

改为只暴露 xterm.js 及其 addons 的 UMD 文件。需要暴露的文件清单：

| 路径 | 用途 |
|------|------|
| `/node_modules/@xterm/xterm/lib/xterm.js` | xterm.js 主库 |
| `/node_modules/@xterm/xterm/css/xterm.css` | xterm.css（已在 public/css/ 中备份） |
| `/node_modules/@xterm/addon-fit/lib/addon-fit.js` | Fit 插件 |
| `/node_modules/@xterm/addon-web-links/lib/addon-web-links.js` | 链接识别 |

**修改 server.js**：

```javascript
// 替代 app.use('/node_modules', ...)
// 只暴露 xterm 必需的几个 UMD 文件
app.use('/node_modules/@xterm/xterm/lib/xterm.js', express.static(path.join(__dirname, 'node_modules/@xterm/xterm/lib/xterm.js')));
app.use('/node_modules/@xterm/addon-fit/lib/addon-fit.js', express.static(path.join(__dirname, 'node_modules/@xterm/addon-fit/lib/addon-fit.js')));
app.use('/node_modules/@xterm/addon-web-links/lib/addon-web-links.js', express.static(path.join(__dirname, 'node_modules/@xterm/addon-web-links/lib/addon-web-links.js')));
```

或者更简洁的方式——用 `serveStatic` 的多个精确路径：

```javascript
const xtermModules = [
  '@xterm/xterm/lib/xterm.js',
  '@xterm/addon-fit/lib/addon-fit.js',
  '@xterm/addon-web-links/lib/addon-web-links.js',
];
xtermModules.forEach((p) => {
  app.get('/node_modules/' + p, (req, res) => {
    res.sendFile(path.join(__dirname, 'node_modules', p));
  });
});
```

**验收标准**：
- [ ] `server.js` 中没有 `app.use('/node_modules', express.static(...))` 整目录暴露
- [ ] 启动后浏览器访问 `http://localhost:3000/node_modules/` 返回 404（不再列出目录）
- [ ] 浏览器访问 `http://localhost:3000/node_modules/@xterm/xterm/lib/xterm.js` 返回 200
- [ ] 终端界面正常渲染（xterm.js 成功加载）

---

### ④ server.js 拆分为三层

#### 问题

当前 `server.js` 98 行同时承担：
- Express 启动
- WebSocket 服务
- PTY 生命周期管理
- shell 启动策略
- 环境变量处理

#### 解决方案

拆为以下文件结构：

```
lib/
├── logger.js            ← ① 已建
├── message-schema.js    ← ⑤
├── terminal-session.js  ← ⑦
├── ws-transport.js      ← 新增：WebSocket 传输层
```

**server.js 瘦身后的职责**：只剩 Express 启动 + 挂载中间件。

```javascript
// server.js — 重构后
const express = require('express');
const http = require('http');
const path = require('path');
const { createWSServer } = require('./lib/ws-transport');
const logger = require('./lib/logger');

function createApp() {
  const app = express();
  const server = http.createServer(app);

  // 静态文件（收缩后的 xterm 模块）
  // ...见 ③ 的方案

  // 常规静态文件
  app.use(express.static(path.join(__dirname, 'public')));

  // SPA 回退路由
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // WebSocket 终端服务
  createWSServer(server);

  return { app, server };
}

if (require.main === module) {
  const { server } = createApp();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    logger.info('sterm', '服务启动', { port: server.address().port });
  });
}

module.exports = { createApp };
```

**新建 `/Users/mac/LLM/sterm/lib/ws-transport.js`**：

负责 WebSocket 生命周期管理，消息路由到 TerminalSession。

```javascript
// lib/ws-transport.js
const { WebSocketServer } = require('ws');
const { TerminalSession } = require('./terminal-session');
const { validateMessage } = require('./message-schema');
const logger = require('./logger');

function createWSServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    logger.info('ws', '新连接');

    const session = new TerminalSession();
    const sessionId = session.id;
    logger.info('session', '会话创建', { sessionId });

    // session → ws
    session.onData((data) => {
      try {
        ws.send(JSON.stringify({ type: 'data', text: data }));
      } catch (err) {
        logger.error('ws', '发送 data 失败', { sessionId, error: err.message });
      }
    });

    session.onExit((exitCode) => {
      try {
        ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
        ws.close();
      } catch (err) {
        logger.error('ws', '发送 exit 失败', { sessionId, error: err.message });
      }
    });

    // ws → session
    ws.on('message', (raw) => {
      const parsed = validateMessage(raw.toString());
      if (!parsed.valid) {
        logger.warn('ws', '无效消息', { sessionId, error: parsed.error });
        return;
      }
      const msg = parsed.message;
      if (msg.type === 'input') {
        session.write(msg.text);
      } else if (msg.type === 'resize') {
        session.resize(msg.cols, msg.rows);
      }
    });

    ws.on('close', () => {
      logger.info('session', '连接关闭', { sessionId });
      session.destroy();
    });

    ws.on('error', (err) => {
      logger.error('ws', '连接异常', { sessionId, error: err.message });
      session.destroy();
    });
  });

  return wss;
}

module.exports = { createWSServer };
```

**验收标准**：
- [ ] `server.js` 不超过 40 行（瘦身成功）
- [ ] `lib/ws-transport.js` 存在，被 server.js 引用
- [ ] 启动后终端正常：输入命令、resize、退出后清理

---

### ⑤ 消息协议 schema 定义

#### 问题

当前 WebSocket 消息无 schema、无版本号、无校验。消息结构靠约定，不靠定义。

#### 解决方案

**新建 `/Users/mac/LLM/sterm/lib/message-schema.js`**：

定义消息格式、版本号、字段校验函数。

```javascript
// lib/message-schema.js
// 消息协议 v1

const PROTOCOL_VERSION = 1;

// 消息类型定义
const MESSAGE_SCHEMAS = {
  // 客户端→服务端
  input: {
    fields: {
      type:  { required: true, type: 'string', value: 'input' },
      text:  { required: true, type: 'string' },
    },
  },
  resize: {
    fields: {
      type:  { required: true, type: 'string', value: 'resize' },
      cols:  { required: true, type: 'number', min: 10, max: 500 },
      rows:  { required: true, type: 'number', min: 1,  max: 200 },
    },
  },

  // 服务端→客户端
  data: {
    fields: {
      type: { required: true, type: 'string', value: 'data' },
      text: { required: true, type: 'string' },
    },
  },
  exit: {
    fields: {
      type: { required: true, type: 'string', value: 'exit' },
      code: { required: true, type: 'number' },
    },
  },
};

/**
 * 校验消息
 * @param {string} raw - JSON 字符串
 * @returns {{ valid: boolean, message?: object, error?: string }}
 */
function validateMessage(raw) {
  if (typeof raw !== 'string') {
    return { valid: false, error: '消息必须是字符串' };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { valid: false, error: 'JSON 解析失败: ' + e.message };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: '消息必须是对象' };
  }

  const type = parsed.type;
  const schema = MESSAGE_SCHEMAS[type];
  if (!schema) {
    return { valid: false, error: '未知消息类型: ' + type };
  }

  for (const [field, rules] of Object.entries(schema.fields)) {
    const value = parsed[field];

    if (rules.required && (value === undefined || value === null)) {
      return { valid: false, error: '缺少必需字段: ' + field };
    }

    if (value === undefined) continue;

    if (rules.type === 'string' && typeof value !== 'string') {
      return { valid: false, error: '字段类型错误: ' + field + ' 应为 string' };
    }
    if (rules.type === 'number' && typeof value !== 'number') {
      return { valid: false, error: '字段类型错误: ' + field + ' 应为 number' };
    }

    if (rules.value !== undefined && value !== rules.value) {
      return { valid: false, error: '字段值错误: ' + field + ' 应为 ' + rules.value };
    }

    if (rules.min !== undefined && value < rules.min) {
      return { valid: false, error: '字段值过小: ' + field + ' 最小值 ' + rules.min };
    }
    if (rules.max !== undefined && value > rules.max) {
      return { valid: false, error: '字段值过大: ' + field + ' 最大值 ' + rules.max };
    }
  }

  return { valid: true, message: parsed };
}

module.exports = {
  PROTOCOL_VERSION,
  MESSAGE_SCHEMAS,
  validateMessage,
};
```

**验收标准**：
- [ ] `lib/message-schema.js` 存在，被 ws-transport.js 引用
- [ ] 发送合法消息（`{"type":"input","text":"ls"}`）→ 正常执行
- [ ] 发送非法消息（`{"type":"input"}` 缺少 text）→ 服务端 warn 日志，不崩溃
- [ ] 发送未知 type → warn 日志，不崩溃

---

### ⑥ 移除 executeJavaScript 耦合

#### 问题

`electron/main.js` 中 `before-input-event` handler 通过 `executeJavaScript` 读取 `window.__terminal` 和 `window.__ws` 全局变量：

```javascript
// Cmd+C 读选中文本
mainWindow.webContents.executeJavaScript(
  '(function(){ var t = window.__terminal; return t && t.hasSelection() ? t.getSelection() : ""; })()'
)

// Cmd+C 无选中 → SIGINT
mainWindow.webContents.executeJavaScript(
  'if(window.__ws&&window.__ws.readyState===1)window.__ws.send(JSON.stringify({type:"input",text:"\\\\x03"}))'
)
```

#### 解决方案

用 IPC + contextBridge 替代。preload.js 已经定义了 `onPaste` 和 `readClipboard`/`writeClipboard`，只需要补充选中文本查询的 IPC 通道。

**修改 `/Users/mac/LLM/sterm/electron/preload.js`**：

```javascript
const { contextBridge, webUtils, clipboard, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  getFilePath: (file) => webUtils.getPathForFile(file),
  readClipboard: () => clipboard.readText(),
  writeClipboard: (text) => clipboard.writeText(text),
  onPaste: (callback) => {
    ipcRenderer.on('sterm-paste', (_event, text) => callback(text));
  },
  // 新增：查询终端选中文本（renderer 内部状态）
  onQuerySelection: (callback) => {
    ipcRenderer.on('sterm-query-selection', () => {
      // renderer 通过 callback 返回选中文本
      const sel = callback();
      ipcRenderer.send('sterm-selection-result', sel);
    });
  },
  // 新增：发送输入到 WebSocket（renderer 内部 ws 状态）
  sendInput: (text) => {
    ipcRenderer.invoke('sterm-send-input', text);
  },
});
```

**修改 `/Users/mac/LLM/sterm/public/js/app.js`** — 在 DOMContentLoaded 中注册 IPC 回调：

```javascript
// 在 initTerminal() 或 initUI() 中添加
if (window.electronAPI && window.electronAPI.onQuerySelection) {
  window.electronAPI.onQuerySelection(() => {
    return terminal && terminal.hasSelection() ? terminal.getSelection() : '';
  });
}
```

**修改 `/Users/mac/LLM/sterm/electron/main.js`** — 移除全部 `executeJavaScript`，改为 IPC：

```javascript
// 添加 IPC handler
const { ipcMain } = require('electron'); // 已经 import

// 处理 renderer 返回的选中结果
ipcMain.on('sterm-selection-result', (_event, selection) => {
  if (selection) {
    clipboard.writeText(selection);
  } else {
    // 无选中 → SIGINT：通过 IPC 让 renderer 发 Ctrl+C
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sterm-send-input', '\x03');
    }
  }
});

// renderer 请求发送输入
ipcMain.handle('sterm-send-input', (_event, text) => {
  // 这个由 preload 暴露的 sendInput 调用
  // renderer 端直接转发到 WebSocket
});

// 修改 before-input-event handler — 移除全部 executeJavaScript
mainWindow.webContents.on('before-input-event', (event, input) => {
  const isMod = input.meta || input.control;
  if (!isMod) return;

  if (input.key.toLowerCase() === 'c' && input.type === 'keyDown') {
    event.preventDefault();
    // 通过 IPC 请求 renderer 检查选中状态
    mainWindow.webContents.send('sterm-query-selection');
  }

  if (input.key.toLowerCase() === 'v' && input.type === 'keyDown') {
    event.preventDefault();
    const text = clipboard.readText();
    if (text && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sterm-paste', text);
    }
  }
});
```

**修改 `/Users/mac/LLM/sterm/public/js/app.js`** — 添加 IPC 'sterm-send-input' 监听：

```javascript
// 在 initUI() 中添加
if (window.electronAPI && window.electronAPI.onPaste) {
  window.electronAPI.onPaste((text) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', text: text }));
    }
  });
}
// 新增：接收主进程的输入指令（用于 Cmd+C 无选中时发 Ctrl+C）
if (window.electronAPI && window.electronAPI.sendInput) {
  window.electronAPI.sendInput((text) => {
    // 这里需要另一个 IPC 通道
  });
}
```

**注意**：上述 IPC 多方向通信设计需要仔细测试。如果 Cmd+C 的 IPC 流程太复杂（请求→回调→回复），也可以接受在主进程用 `executeJavaScript` 做单次 `ws.send`（写方向），但**读方向的 `window.__terminal` 必须移除**。

**验收标准**：
- [ ] `electron/main.js` 中搜索 `executeJavaScript` — 不超过 1 处残留（如果保留写方向）
- [ ] `window.__terminal` 和 `window.__ws` 的 `Object.defineProperty` 被移除
- [ ] Cmd+C 有选中时复制到剪贴板
- [ ] Cmd+C 无选中时发送 Ctrl+C 到终端
- [ ] Cmd+V 粘贴文本到终端

---

### ⑦ 抽象 TerminalSession

#### 问题

当前 PTY 会话在 `server.js` 的 `wss.on('connection')` 回调中直接创建，无法被管理、复用或扩展。

#### 解决方案

**新建 `/Users/mac/LLM/sterm/lib/terminal-session.js`**：

```javascript
// lib/terminal-session.js
const { spawn } = require('node-pty');
const logger = require('./logger');
const EventEmitter = require('events');

class TerminalSession extends EventEmitter {
  constructor(options = {}) {
    super();
    this.id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    this._pty = null;
    this._alive = false;

    // 用于展示在状态栏的 shell 类型
    this.shellType = this._detectShell();

    this._spawn(options);
  }

  _detectShell() {
    const shellPath = process.env.SHELL || '/bin/zsh';
    const name = shellPath.split('/').pop() || 'sh';
    return name;
  }

  _spawn(options) {
    try {
      const shell = process.env.SHELL || '/bin/zsh';
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !k.startsWith('CONDA_'))
      );
      env.LANG = 'zh_CN.UTF-8';
      env.LC_ALL = 'zh_CN.UTF-8';

      this._pty = spawn(shell, [], {
        name: 'xterm-256color',
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: process.env.HOME,
        env,
      });
      this._alive = true;
      logger.info('session', 'PTY 已启动', { id: this.id, shell });
    } catch (err) {
      logger.error('session', 'PTY 启动失败', { id: this.id, error: err.message });
      this._alive = false;
      this.emit('error', err);
      return;
    }

    this._pty.onData((data) => {
      try {
        this.emit('data', data);
      } catch (err) {
        logger.error('session', 'onData 处理失败', { id: this.id, error: err.message });
      }
    });

    this._pty.onExit(({ exitCode, signal }) => {
      this._alive = false;
      logger.info('session', 'PTY 已退出', { id: this.id, exitCode, signal });
      this.emit('exit', exitCode);
    });
  }

  write(text) {
    if (!this._alive || !this._pty) return;
    this._pty.write(text);
  }

  resize(cols, rows) {
    if (!this._alive || !this._pty) return;
    try {
      this._pty.resize(cols, rows);
    } catch (err) {
      logger.error('session', 'resize 失败', { id: this.id, error: err.message });
    }
  }

  destroy() {
    if (!this._alive || !this._pty) return;
    try {
      this._pty.kill();
    } catch (err) {
      logger.error('session', 'kill 失败', { id: this.id, error: err.message });
    }
    this._alive = false;
    this.removeAllListeners();
    logger.info('session', '会话已销毁', { id: this.id });
  }

  get alive() {
    return this._alive;
  }
}

module.exports = { TerminalSession };
```

**验收标准**：
- [ ] `lib/terminal-session.js` 存在，`TerminalSession` 导出
- [ ] `createWSServer` 使用 `new TerminalSession()` 而非直接 `spawn`
- [ ] session 启动后终端正常交互
- [ ] session.destroy() 后 PTY 进程被杀死
- [ ] session 的 `alive` 属性在退出后变为 false

---

## API 契约（更新版）

### WebSocket 消息协议 v1

**双向消息格式**：

```json
{
  "type": "<message-type>",
  "...fields": "..."
}
```

**服务端→客户端**：

| type | 字段 | 说明 |
|------|------|------|
| `data` | `text: string` | 终端输出（含 ANSI 转义） |
| `exit` | `code: number` | 进程退出码 |

**客户端→服务端**：

| type | 字段 | 说明 |
|------|------|------|
| `input` | `text: string` | 用户输入（含 ANSI 转义序列） |
| `resize` | `cols: number, rows: number` | 终端尺寸变更，cols 10-500, rows 1-200 |

**校验规则**：
- 所有消息必须含有 `type` 字段
- `resize` 的 `cols`/`rows` 为 number 且在范围内
- `input` 的 `text` 为 string
- 未知 type → 服务端日志警告，不处理，不崩溃
- schema 定义在 `lib/message-schema.js`，引入新 type 时同步更新

---

## 保留的旧 API

以下不变：
- 端口：`PORT` 环境变量（默认 `3000`）
- `require.main === module` 双模式（CLI + module）

---

## 验证方法

```bash
# 1. 启动服务
cd /Users/mac/LLM/sterm && node server.js

# 2. 基本终端功能
# 浏览器访问 http://localhost:3000
# 看到终端提示符，输入 ls、pwd、cd 正常

# 3. 消息校验测试
curl -X POST -H "Content-Type: application/json" \
  -d '{"type":"input","text":"ls"}' \
  http://localhost:3000/  # 应返回 404（正常，没有 POST endpoint）

# 4. WebSocket 直接测试（手动）
# 浏览器 DevTools → WebSocket 连接 ws://localhost:3000
# 发送 {"type":"resize","cols":100,"rows":30} → 无报错
# 发送 {"type":"input"} → 服务端日志：无效消息

# 5. 日志验证
LOG_LEVEL=DEBUG node server.js
# 应有 [INFO] [sterm] 服务启动 ...
# 连接后有 [INFO] [session] 会话创建 ...

# 6. 验证 /node_modules 不可目录浏览
curl http://localhost:3000/node_modules/  # 应返回 404
curl http://localhost:3000/node_modules/@xterm/xterm/lib/xterm.js  # 应返回 200

# 7. Electron 模式
npm run electron:dev
# 终端正常，Cmd+C 复制，Cmd+V 粘贴
```

---

## 改动顺序建议

1. 先建 `lib/logger.js`（① 的组件）
2. 改 `reader.js` 空 catch → logger（②）
3. 缩 /node_modules 路由（③）
4. 建 `lib/message-schema.js`（⑤）
5. 建 `lib/terminal-session.js`（⑦）
6. 建 `lib/ws-transport.js` + 瘦身 server.js（④）
7. 改 Electron IPC（⑥）
8. 整体验证

## 约束

- ❌ 不要修改 `public/css/terminal.css`
- ❌ 不要修改 `public/js/theme.js`
- ❌ 不要新增依赖包（不需要 express-ws 等第三方 ws 封装）
- ✅ 可以使用 Node.js 内置模块（events, path, fs）
- ✅ 新建文件放在 `lib/` 目录下
