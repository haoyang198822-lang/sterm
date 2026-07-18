# R06: 扩展 UI 质感提升（Lucerna 级别）

## 目标

保持核心终端不动，把全部"扩展 UI"（侧边面板、设置、命令收藏、⌘K、Dialog、状态栏、Header）的视觉质感提升到与 Lucerna 同一水平。

## 改什么

- `public/index.html` — 删除 `<style>` 块，改为 `<link>`；DOM 微调
- **新建** `public/css/app.css` — 所有界面样式
- `public/js/app.js` — 改图标引用方式
- `public/js/theme.js` — 不改

不碰 `public/css/terminal.css`、`public/css/xterm.css`、`server.js`、`electron/`

---

## 1. 设计 Token 体系

当前 index.html 的 `<style>` 块里变量定义不全，而且 fallback 值写得到处都是。改为完整的 tokens，与 Lucerna 共用同一套变量：

### 1.1 CSS 变量

新建 `public/css/app.css`，以 `<link>` 引入。变量定义：

```css
:root {
  /* 背景亮度梯度 */
  --bg-canvas: #08090a;
  --bg-panel: #0f1011;
  --bg-surface-1: #191a1b;
  --bg-surface-2: #28282c;
  --bg-surface-3: #323236;

  /* 文字色梯度 */
  --text-primary: #f7f8f8;
  --text-secondary: #d0d6e0;
  --text-tertiary: #8a8f98;
  --text-quaternary: #62666d;

  /* 品牌色 */
  --color-brand: #5e6ad2;
  --color-accent: #7170ff;
  --color-accent-hover: #828fff;

  /* 功能色 */
  --color-success: #27a644;
  --color-error: #ef4444;

  /* 边框 */
  --border-subtle: rgba(255,255,255,0.05);
  --border-standard: rgba(255,255,255,0.08);
  --border-solid-1: #23252a;
  --border-solid-2: #34343a;

  /* 间距（8px Grid） */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  /* 阴影 */
  --shadow-modal:
    rgba(0,0,0,0) 0px 8px 2px,
    rgba(0,0,0,0.01) 0px 5px 2px,
    rgba(0,0,0,0.04) 0px 3px 2px,
    rgba(0,0,0,0.07) 0px 1px 1px,
    rgba(0,0,0,0.08) 0px 0px 1px;

  /* 字体 */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

/* 亮色模式 */
body.light {
  --bg-canvas: #f7f8f8;
  --bg-panel: #ffffff;
  --bg-surface-1: #ffffff;
  --bg-surface-2: #f3f4f5;
  --bg-surface-3: #e8e9eb;
  --text-primary: #1a1a1a;
  --text-secondary: #4a4a4a;
  --text-tertiary: #8a8a8a;
  --text-quaternary: #b0b0b0;
  --border-subtle: rgba(0,0,0,0.06);
  --border-standard: rgba(0,0,0,0.10);
  --border-solid-1: #d0d0d0;
  --border-solid-2: #b8b8b8;
}
```

### 1.2 全局样式

```css
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; overflow: hidden; }
body {
  background: var(--bg-canvas);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}

/* 焦点指示器 */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
:focus:not(:focus-visible) { outline: none; }

/* 自定义滚动条（整个应用） */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--border-solid-1);
  border-radius: var(--radius-full);
}
::-webkit-scrollbar-thumb:hover { background: var(--border-solid-2); }

/* 选中颜色 */
::selection { background: var(--color-accent); color: #fff; }
```

---

## 2. SVG 图标

### 2.1 替换方案

用 Lucide 图标（零依赖，内联 SVG path）。不引入 CDN，避免网络依赖。

公共图标函数（在 `app.js` 加）：

```javascript
const ICONS = {
  command: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><rect x="9" y="9" width="6" height="6"/></svg>',
  cheatsheet: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  settings: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  terminal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};
```

### 2.2 替换位置

- 侧边面板 Tab：`▸` → `ICONS.command` / `□` → `ICONS.cheatsheet` / `◇` → `ICONS.settings`
- `#btn-add-command`：`+` → `ICONS.plus`
- `#btnTheme`：`☀` / `☾` 文本 → `ICONS.sun` / `ICONS.moon`
- Tab close：`✕` → `ICONS.close`
- Header new tab：`+` → 小号 `ICONS.plus`

### 2.3 applyTheme 更新

```javascript
function applyTheme() {
  document.body.classList.toggle('light', isLightTheme);
  btnTheme.innerHTML = isLightTheme ? ICONS.moon : ICONS.sun;
  if (terminal) terminal.options.theme = isLightTheme ? LIGHT_TERMINAL_THEME : DARK_TERMINAL_THEME;
}
```

---

## 3. 浮层入场动画

当前 Dialog 和 ⌘K 面板都是直接 display 切换。加入场动画：

### 3.1 CSS

```css
/* ⌘K 面板入场 */
#command-palette {
  display: none;
  /* ...现有属性... */
  opacity: 0;
  transition: opacity 0.15s ease;
}
#command-palette.open {
  display: flex;
  opacity: 1;
}

/* Dialog 入场 */
#add-command-dialog {
  display: none;
  /* ...现有属性... */
  opacity: 0;
}
#add-command-dialog.open { display: flex; }

#add-command-content {
  /* ...现有属性... */
  transform: scale(0.96);
  transition: transform 0.2s ease, opacity 0.2s ease;
  opacity: 0;
}
#add-command-dialog.open #add-command-content {
  transform: scale(1);
  opacity: 1;
}
#add-command-backdrop {
  transition: opacity 0.2s ease;
  opacity: 0;
}
#add-command-dialog.open #add-command-backdrop {
  opacity: 1;
}
```

### 3.2 JS 调整

`toggleCommandPalette()` 中，打开时延迟设 opacity（`requestAnimationFrame`），关闭时先渐隐再 display:none。

```javascript
function toggleCommandPalette(forceOpen) {
  const open = typeof forceOpen === 'boolean' ? forceOpen : commandPalette.getAttribute('aria-hidden') === 'true';
  if (open) {
    commandPalette.style.display = 'flex';
    commandPalette.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => { commandPalette.classList.add('open'); });
    setTimeout(() => commandPaletteSearch.focus(), 50);
  } else {
    commandPalette.classList.remove('open');
    commandPalette.setAttribute('aria-hidden', 'true');
    setTimeout(() => { commandPalette.style.display = ''; }, 150);
  }
}
```

同样处理 `openAddCommandDialog` / `closeAddCommandDialog`，利用 `display: none` 的同步/异步切换。

---

## 4. index.html 清理

### 4.1 删除 `<style>` 块

整个 `<style>...</style>` 删除，换为：

```html
<link rel="stylesheet" href="/css/app.css?v=1" />
```

### 4.2 Tab 文本改图标

```html
<button class="side-panel-tab active" type="button" data-tab="commands" role="tab">
  ${ICONS.command} 命令
</button>
```

注意：这里要在 JS 里生成 tab DOM，而不是硬编码在 HTML。因为 ICONS 对象在 JS 中定义。
或者保留 HTML 占位符，JS 初始化时替换 innerHTML。

**推荐方案**：HTML 中保留现有结构，在 `initSidePanel()` 中统一替换：

```javascript
function initSidePanel() {
  // 替换 tab 图标
  document.querySelector('[data-tab="commands"]').innerHTML = `${ICONS.command} 命令`;
  document.querySelector('[data-tab="cheats"]').innerHTML = `${ICONS.cheatsheet} 速查`;
  document.querySelector('[data-tab="settings"]').innerHTML = `${ICONS.settings} 设置`;

  // 替换按钮图标
  btnAddCommand.innerHTML = ICONS.plus;
  // ... rest of initSidePanel
}
```

---

## 5. 完成标准

- [ ] `<style>` 块从 index.html 删除，CSS 独立为 `app.css`
- [ ] 设计 Token 完整（所有 UI 颜色引用 token，无硬编码 fallback）
- [ ] Light 模式切换正常（`<body class="light">` 触发所有变量替换）
- [ ] 全站自定义滚动条（暗色/亮色适配）
- [ ] `:focus-visible` 焦点指示器
- [ ] 侧边面板 Tab 显示 SVG 图标
- [ ] Theme 按钮用日月 SVG 图标
- [ ] "+" 按钮用带圈加号 SVG
- [ ] Dialog 打开时有 scale + fade 入场
- [ ] ⌘K 面板打开时有 fade 入场
- [ ] 页面加载后不报任何 JS/CSS 错误
- [ ] 核心终端功能不受影响
