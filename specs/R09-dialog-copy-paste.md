# R09: 弹窗输入框支持原生复制粘贴

## 现象

添加/编辑命令的 Dialog 中，`#add-cmd-name`、`#add-cmd-command`（textarea）、`#add-cmd-tag-new`、`#add-cmd-shortcut` 等输入框内无法使用 `Cmd+C` / `Cmd+V` 复制粘贴。

## 根因

`electron/main.js` L47-57 的 `before-input-event` 处理器对所有 `Cmd+C` 和 `Cmd+V` **无条件** `event.preventDefault()`，然后走 IPC 路由发送到 xterm 终端。当焦点在 HTML `<input>` / `<textarea>` 内时，这些快捷键应该由浏览器原生处理。

## 实现方案

改动最小原则：在 main.js 维护一个焦点状态标志 `isInputFocused`，拦截前先判断。焦点在输入框中时放行，让浏览器原生处理。

### 改什么

涉及 3 个文件：

### 1. `electron/preload.js`

在 `contextBridge.exposeInMainWorld('electronAPI', {...})` 中新增 IPC 发送方法：

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... 现有方法保持不变 ...
  sendFocusState: (isInput) => {
    ipcRenderer.send('sterm-focus-state', isInput);
  },
});
```

### 2. `public/js/app.js`

在 `initUI()` 函数末尾或 `DOMContentLoaded` 中（只要能确保 `window.electronAPI` 已定义），新增焦点变化监听：

## ⚠️ 关键陷阱：xterm.js 隐藏 textarea 干扰

xterm.js 内部有一个隐藏的 `<textarea>`（`INPUT` 标签）用来捕获键盘输入。当用户点击终端区域时，这个 textarea 获得焦点——如果 `focusin` 不加区分地标记 `isInput=true`，main.js 会跳过 Cmd+V 拦截，但 xterm.js 自身的 paste 在 Electron 34 + contextIsolation 下不触发，导致终端粘贴失效。

**必须在 `focusin` 中排除 xterm 容器内部的元素：**

```javascript
document.addEventListener('focusin', () => {
  const el = document.activeElement;
  if (!el) return;
  // 排除 xterm 内部 textarea——防止终端粘贴被跳过
  if (el.closest('#terminal-container') || el.closest('.xterm')) {
    window.electronAPI?.sendFocusState(false);
    return;
  }
  const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
  window.electronAPI?.sendFocusState(!!isInput);
});
```

`focusin` 是 bubbling 事件，任何焦点变化都会触发——包含 Dialog 打开、Tab 切换、回到终端等所有场景。不需要额外的 `focusout` 兜底。

### 3. `electron/main.js`

两处改动：

**A. 新增状态变量**（放在 `createWindow` 函数内，与 `copyPending` 平级）：

```javascript
let isInputFocused = false;
```

**B. 新增 IPC 监听**（放在 `sterm-copy-response` 附近，L63-64 区域）：

```javascript
ipcMain.on('sterm-focus-state', (_event, state) => {
  isInputFocused = state;
});
```

**C. 修改 `before-input-event`**（L43-58），在 `Cmd+C` 和 `Cmd+V` 拦截前加判断：

```javascript
mainWindow.webContents.on('before-input-event', (event, input) => {
  const isMod = input.meta || input.control;
  if (!isMod || input.type !== 'keyDown') return;
  const key = input.key.toLowerCase();
  if (key === 'c') {
    if (isInputFocused) return;            // ← 新增：输入框内不拦截
    event.preventDefault();
    if (copyPending) return;
    copyPending = true;
    mainWindow.webContents.send('sterm-copy-request');
  }
  if (key === 'v') {
    if (isInputFocused) return;            // ← 新增：输入框内不拦截
    event.preventDefault();
    const text = clipboard.readText();
    if (text && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sterm-paste', text);
  }
});
```

## 关键约束

- `isInputFocused` 的初始值是 `false`（终端默认聚焦），不要写成 `true`
- 改完后必须**关闭并重新打开 Sterm.app** 才能生效（`main.js` 和 `preload.js` 只在启动时加载）
- 不改动 xterm 的 `attachCustomKeyEventHandler` 或 `onCopyRequest`/`onPaste` 回调

## 涉及文件清单

| 文件 | 操作 | 改动类型 |
|------|------|---------|
| `electron/main.js` | 新增 `isInputFocused` 变量 + IPC 监听 + `before-input-event` 拦截前判断 | 修改 |
| `electron/preload.js` | 新增 `sendFocusState` IPC 方法 | 修改 |
| `public/js/app.js` | 新增 `focusin` 事件监听 | 修改 |

## 验收条件

1. 启动后终端 `Cmd+V` 粘贴工作正常（`isInputFocused` 初始值为 `false`）
2. 焦点在终端时 `Cmd+C`（有选中文本）→ 复制到剪贴板
3. 焦点在终端时 `Cmd+V` → 粘贴到终端
4. 打开添加命令 Dialog，焦点在名称输入框中 → `Cmd+V` 粘贴文本成功
5. 打开添加命令 Dialog，焦点在命令 textarea 中 → `Cmd+V` 粘贴文本成功
6. 打开添加命令 Dialog，焦点在快捷键输入框中 → `Cmd+C` 复制选中文本成功
7. 侧边栏搜索框也能 `Cmd+V` 粘贴
8. 切换回终端，复制粘贴仍然正常工作

## 被否决的方案（仅作记录，不实现）

### 方案 A：`executeJavaScript` 同步查询

在 `before-input-event` 中用 `mainWindow.webContents.executeJavaScript(...)` 检查焦点元素。**否决原因**：`executeJavaScript` 返回 Promise 是异步的，而 `event.preventDefault()` 必须在事件处理中同步执行。

### 方案 B：迁移复制逻辑到 xterm 的 `attachCustomKeyEventHandler`

移除 `main.js` 的 `before-input-event` 拦截，改为在 `app.js` 的 xterm `attachCustomKeyEventHandler` 中处理复制粘贴。**否决原因**：改动范围太大，触及 xterm 核心交互逻辑，风险不可控。
