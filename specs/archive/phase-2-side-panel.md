# Phase 2 — 侧边面板 + 命令收藏

## 改什么（只改这两个文件）

- `public/index.html` — 加 DOM 结构 + CSS
- `public/js/app.js` — 加逻辑

不碰 `terminal.css`、`theme.js`、`electron/`、`lib/`，不加新 npm 包。

---

## 1. index.html 改动

### 1.1 加 workspace 容器

当前 `#terminal-container` 是 body 的直接子元素。把它和侧边面板用 `#workspace` 包起来：

```html
<div id="workspace">
  <div id="terminal-container"></div>
  <!-- 侧边面板插在这里，见 1.2 -->
</div>
```

### 1.2 加侧边面板 DOM

在 `#terminal-container` 后面、`#workspace` 内部插入：

```html
<aside id="side-panel" class="collapsed" aria-label="侧边面板">
  <div id="side-panel-tabs" role="tablist">
    <button class="side-panel-tab active" data-tab="commands" role="tab" aria-selected="true">▸ 命令</button>
    <button class="side-panel-tab" data-tab="cheats" role="tab" aria-selected="false">□ 速查</button>
    <button class="side-panel-tab" data-tab="settings" role="tab" aria-selected="false">◇ 设置</button>
  </div>
  <div class="side-panel-body">
    <section class="side-panel-section active" data-panel="commands">
      <div class="panel-search-row">
        <input id="panel-search" type="search" placeholder="搜索命令或输入 / 聚焦" />
      </div>
      <div id="commands-list" class="panel-list"></div>
    </section>
    <section class="side-panel-section" data-panel="cheats">
      <div id="cheats-list" class="panel-list"></div>
    </section>
    <section class="side-panel-section" data-panel="settings">
      <div id="settings-list" class="settings-grid"></div>
    </section>
  </div>
</aside>
```

### 1.3 加 ⌘K 命令面板 DOM

放在 `#workspace` 外面、`#status-bar` 前面：

```html
<div id="command-palette" aria-hidden="true">
  <div id="command-palette-backdrop"></div>
  <div id="command-palette-dialog" role="dialog" aria-modal="true" aria-label="命令面板">
    <div class="palette-search-row">
      <input id="command-palette-search" type="search" placeholder="搜索收藏、速查或操作" />
    </div>
    <div id="command-palette-results"></div>
  </div>
</div>
```

这个面板 Phase 5 才实现功能，DOM 先放进去。

### 1.4 CSS

在 `<style>` 块里追加（不碰 terminal.css）：

**App 布局**
- `html,body { height: 100%; margin:0; background:#08090a; }`
- `#app { height: 100%; display:flex; flex-direction:column; overflow:hidden; }`
- `#workspace { flex:1; display:flex; overflow:hidden; min-height:0; }`
- `#terminal-container { flex:1; min-width:0; overflow:hidden; }`

**侧边面板**
- `#side-panel` → 宽 320px，背景 `#0f1011`，flex 列，左边框 `1px solid rgba(255,255,255,0.08)`
- `.collapsed` → 宽 0，溢出隐藏，无边框
- `#side-panel-tabs` → 高 36px，flex，下边框
- `.side-panel-tab` → flex:1，字号 12px/510，居中，active 时品牌色下划线
- `.side-panel-body` → flex:1，滚动
- `.side-panel-section` → display:none，`.active` 时 display:block

**搜索框**
- `#panel-search` → 宽 100%，背景 `#191a1b`，边框 `1px solid rgba(255,255,255,0.08)`，圆角 6px
- `::placeholder` 色 `#62666d`
- `:focus` 边框品牌色 `#7170ff`

**命令列表**
- `.panel-list` → padding: 8px 12px
- `.panel-item` → 宽 100%，文本左对齐，padding 10px 12px，flex 列，圆角 6px
- `.panel-item:hover` → 背景 `#191a1b`，边框可见
- `.panel-item-label` → 13px/510，下边距 2px
- `.panel-item-cmd` → 11px，等宽字体，色 `#8a8f98`
- `.panel-item-tag` → 10px，品牌色文字，`rgba(113,112,255,0.1)` 背景，圆角 2px
- `.panel-item-shortcut` → 10px，色 `#62666d`，右对齐
- `.cmd-group-title` → 10px/510，大写，色 `#62666d`

**命令面板（⌘K）**
- `#command-palette` → fixed 覆盖，z-index 1000，默认 display:none
- `.open` → display:flex，居中，距顶 15vh
- backdrop → absolute 铺满，`rgba(0,0,0,0.85)`
- dialog → 宽 560px，背景 `#191a1b`，圆角 12px，多层阴影
- `.palette-item` → flex 列，圆角 6px
- `.palette-item:hover` → 背景 `#28282c`

---

## 2. app.js 改动

### 2.1 新加变量

```javascript
let activeSideTab = 'commands';
let panelCollapsed = localStorage.getItem('sterm-panel-collapsed') === 'true';
let snippets = [];
let cheatsheets = [];
let settings = {};

const defaultSettings = {
  terminalFontFamily: "'JetBrains Mono', monospace",
  uiFontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 14,
  cursorBlink: true,
  cursorStyle: 'bar',
  wrap: true,
  autoRecord: true,
};
```

### 2.2 新加函数

**`loadSettings()`** — 从 localStorage 读取 `sterm-settings`，合并到 `defaultSettings`

**`saveSetting(key, value)`** — 写 localStorage + 调用 `applySettingsToTerminal()`

**`applySettingsToTerminal()`** — 把 settings 应用到 terminal.options（fontFamily, fontSize, cursorBlink, cursorStyle, wordWrap）

**`togglePanel()`** — 切换 `panelCollapsed`，classList toggle `collapsed`，写 localStorage

**`initSidePanel()`** — 
- 遍历 `.side-panel-tab`，绑定 click：切换 active class + 切换 section 显示
- 搜索框 focus：不用额外操作（天然聚焦）
- 搜索框 input 事件：过滤 snippet 并调用 `renderCommands()`
- 搜索框 keydown Enter：插入第一个结果

**`loadSnippets()`** — async，fetch `/sterm-data/snippets.json`，失败留空数组，然后调用 `renderCommands()`

**`renderCommands(list)`** — 
- 按 `tags[0]` 分组（没有 tag 的归入「通用」）
- 分组排序（字母序）
- 生成 HTML：group-title + panel-item 列表
- 每个 panel-item 绑定 click → `insertCommand(command)`

**`insertCommand(cmd)`** — `ws.send(JSON.stringify({ type: 'input', text: cmd + '\n' }))`

**`toggleCommandPalette(forceOpen)`** — 切换 `#command-palette` 的 `aria-hidden` 和 `.open` class，Phase 5 才完整实现，先做基础打开/关闭

### 2.3 `initUI()` 加快捷键

```javascript
document.addEventListener('keydown', (event) => {
  const mod = event.metaKey || event.ctrlKey;
  if (mod && event.key === '\\') { event.preventDefault(); togglePanel(); }
  if (mod && event.key.toLowerCase() === 'k') { event.preventDefault(); toggleCommandPalette(true); }
  if (mod && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); panelSearch?.focus(); }
  if (event.key === 'Escape') toggleCommandPalette(false);
});
```

### 2.4 `DOMContentLoaded` 中调用

```javascript
loadSettings();
initSidePanel();
loadSnippets();
// initTerminal() 和 initUI() 保持原顺序
```

注意：`loadSettings()` 要在 `initTerminal()` 之前，因为 terminal 初始化要用 settings 的值。

---

## 3. 验证标准

做完后浏览器打开 http://localhost:3000，检查：

- [ ] 面板在终端右侧，320px 宽
- [ ] 三个 Tab（▸ 命令 / □ 速查 / ◇ 设置）可点击切换
- [ ] `⌘\` 折叠/展开面板，刷新后保持状态
- [ ] `⌘⇧F` 聚焦搜索框
- [ ] 命令列表按 tag 分组，有标题行
- [ ] 每条命令显示：名称、命令、标签、快捷键（如有）
- [ ] 点击命令 → 命令输入到终端并自动执行
- [ ] 搜索框输入 → 过滤命令列表
- [ ] 搜索框 Enter → 执行第一条命令
- [ ] 页面不报 JS 错误
- [ ] 无新增 npm 包
- [ ] `terminal.css` 未修改
