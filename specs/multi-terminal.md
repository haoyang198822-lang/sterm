# 多终端支持 — 实现规范

## 概述

当前 sterm 仅支持单个终端会话。本 spec 实现多终端（多标签页）功能，每个标签页独立运行自己的 node-pty 进程，关闭标签页不丢失其他终端。

## 架构

```
┌─ Tab Bar ───────────────────────────────┐
│ [bash ✓] [node ➕] [docker ◦]     [➕]   │
├─────────────────────────────────────────┤
│                                         │
│          xterm.js 实例                   │
│          (当前选中标签页)                │
│                                         │
└─────────────────────────────────────────┘
```

- **前端**: Tab bar + xterm.js 实例池（每个 tab 对应一个实例）
- **后端**: Express WebSocket 管理多个 PTY 会话，每个会话有唯一 session ID
- **WebSocket 协议扩展**: 请求/响应包增加 `sessionId` 字段

## 后端改动

### 1. 会话管理器 (`server.js`)

新增 `SessionManager` 类，替代单例 PTY：

```javascript
class SessionManager {
  constructor() { this.sessions = new Map(); }
  create(shell) { ... }
  destroy(id) { ... }
  get(id) { ... }
  list() { ... } // 返回 {id, shell, created, cwd?}[]
}
```

### 2. WebSocket 消息协议扩展

| 方向 | type | sessionId | 说明 |
|------|------|-----------|------|
| C→S | `create` | — | 创建新终端（无 sessionId） |
| S→C | `created` | `string` | 返回新会话 ID |
| C→S | `input` | `string` | 向指定 session 写入数据 |
| S→C | `output` | `string` | 来自指定 session 的输出 |
| C→S | `resize` | `string` | 调整指定 session 的 cols/rows |
| C→S | `list` | — | 请求会话列表 |
| S→C | `sessions` | `[...]` | 返回会话列表 |
| C→S | `destroy` | `string` | 关闭指定 session |

**向后兼容**: 无 `sessionId` 的消息视为操作 "当前活跃 session"（第一次连接自动创建）。

### 3. 初始化流程

```
WS 连接 → 自动创建第 1 个 PTY session → 返回 {type:'created', sessionId:'sess_xxx'}
         → 前端渲染第 1 个 tab + 连接 xterm
```

### 4. 输入/输出路由

```
C→S {type:'input', sessionId:'sess_xxx', text:'ls\n'}
    → sessions.get('sess_xxx').pty.write('ls\n')
    → pty.on('data') → S→C {type:'output', sessionId:'sess_xxx', text:'...'}
```

### 5. 关闭标签页

```
C→S {type:'destroy', sessionId:'sess_xxx'}
    → pty.kill() → sessions.delete('sess_xxx')
    → 如果已无 session → 断开 WS / 释放资源
```

## 前端改动

### 1. HTML 结构调整

```html
<div id="terminal-area">
  <div id="tab-bar">
    <div class="tab" data-session-id="sess_xxx">
      <span class="tab-label">bash</span>
      <button class="tab-close">×</button>
    </div>
    <button id="new-tab-btn">＋</button>
  </div>
  <div id="terminal-wrapper">
    <div class="xterm-container" data-session-id="sess_xxx"></div>
    <div class="xterm-container" data-session-id="sess_yyy" hidden></div>
  </div>
</div>
```

### 2. JS 改动 (`app.js`)

**新增状态**:
```javascript
const sessions = new Map();  // sessionId → {terminal, fitAddon, el, shell}
let activeSessionId = null;
```

**核心函数**:

| 函数 | 职责 |
|------|------|
| `initSession(sessionId, shell)` | 创建新 xterm + FitAddon，挂载到新 container，加入 sessions map |
| `activateSession(sessionId)` | 隐藏所有 container，显示目标 container；更新 tab 高亮 |
| `destroySession(sessionId)` | 销毁 xterm，关闭 PTY，删除 tab，切到下一个 |
| `createNewTab()` | 发 `{type:'create'}` 到 WS，等 `created` 响应后调用 initSession+activateSession |
| `renderTabBar()` | 遍历 sessions 刷新 tab DOM |

**事件绑定**:
- Tab 点击 → `activateSession(sessionId)`
- Tab 关闭按钮 → `destroySession(sessionId)`
- 新建按钮 → `createNewTab()`

**WS 消息路由**:
```javascript
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'output' && msg.sessionId) {
    sessions.get(msg.sessionId)?.terminal.write(msg.text);
  } else if (msg.type === 'created') {
    // 新 session 就绪
  }
};
```

### 3. Tab 样式 (`terminal.css`)

| 规则 | 值 |
|------|-----|
| Tab 高度 | 32px |
| Tab 文字 | 12px, 终端 shell 名 |
| 高亮 tab | `var(--color-accent)` 底色 |
| 新建按钮 | 24x24, `+` 图标 |
| 关闭按钮 | 16x16, 悬浮显示 |

### 4. 启动行为

- 页面加载 → WS 连接 → 自动创建第 1 个终端 (shell: zsh)
- 第 1 个终端自动激活
- 标签页显示 "bash"（当前 shell 名，或自定义名称）

## 边界情况

| 场景 | 行为 |
|------|------|
| 关闭最后一个标签页 | 允许（终端区域显示空白/提示"新建终端"） |
| WS 断线重连 | 前端清空 sessions map；后端清空 PTY 池；重连后重新创建 |
| 标签页过多 | 无硬限制，tab bar 可横向滚动 |
| 标签页同名 | 允许（shell 同则同名），可加数字后缀区分 |
| 新建标签页快速连续点击 | 防抖 300ms |

## 数据结构

### 服务端 Session 对象

```javascript
{
  id: 'sess_1742012345678_nj3r0s',  // 唯一 ID
  shell: 'zsh',
  pty: PseudoTerminal,
  createdAt: 1742012345678,
  cwd: process.cwd(),
}
```

### 前端 Session 对象

```javascript
{
  id: 'sess_xxx',
  shell: 'zsh',
  terminal: Terminal,          // xterm.js 实例
  fitAddon: FitAddon,
  container: HTMLElement,      // xterm-container div
}
```

## 工作量评估

| 模块 | 工作量 | 依赖 |
|------|--------|------|
| 服务端 SessionManager | ~40 行 | 无 |
| WS 协议扩展 + 消息路由 | ~30 行 | SessionManager |
| 前端 sessions map + 核心函数 | ~60 行 | 无 |
| Tab bar HTML + CSS | ~40 行 | 无 |
| Tab bar JS 事件绑定 | ~30 行 | 前端状态 |
| 重连处理 | ~10 行 | 前端状态 |
| **合计** | **~210 行** | |

## 验收条件

1. 启动后看到 1 个 tab（bash），终端可交互
2. 点击 ➕ 新建 tab，新终端独立运行
3. 在 tab A 输入 cd /tmp，切换到 tab B，tab B 仍在原目录
4. 关闭 tab B，tab A 不受影响
5. 关闭所有 tab，出现"新建终端"提示
6. 刷新页面，全部标签重置为初始状态（1 个 tab）
