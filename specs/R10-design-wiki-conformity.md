# R10: UI Design Wiki 对齐修复

## 目标

修复 sterm 界面与 `/Users/mac/Documents/Obsidian Vault/design wiki/` Linear 设计体系之间的偏差。

## 改动原则

- 每次改一个变量，改完确认效果再继续（视觉极度敏感，批量改不可追溯）
- 不改 xterm 终端本身，只改外围 UI（header/sidebar/dialog/palette/statusbar）
- 不改 xterm 主题色（theme.js 中的 terminal color 独立运行）

---

## 改 1：删除全局 `transition: none !important`

**文件**：`public/css/terminal.css`

**操作**：删除 L7 `transition: none !important;`。

```css
/* 之前 */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  transition: none !important;  /* ← 删除这行 */
}

/* 之后 */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
```

**作用**：恢复 Dialog 缩放动画、⌘K fade-in、侧边栏宽度过渡、Toggle knob 滑动、Backdrop 渐隐。所有设计 wiki 中定义的动画效果将立即生效。

**例外**：hover 效果（按钮/行/列表项）继续保持 0ms——因为 app.css 中只有侧边栏、dialog、palette、toggle 四处有 transition 声明，其他元素无 transition，hover 仍然是即时切换。

**验证**：
- [ ] `.side-panel` 展开/折叠有 0.15s 宽度过渡（不再是硬切）
- [ ] `#add-command-content` 打开时 scale(0.96→1) + fade 动画流畅
- [ ] `#command-palette` 打开时有 0.15s fade-in
- [ ] `.toggle-switch` knob 有 0.15s 滑动
- [ ] 按钮/列表项 hover 仍然是即时切换（0ms，不受影响）

**⚠️ 确认工具**：改完这行后立刻在浏览器测试，不要一次改多行。这是唯一可能导致界面"黏滞感"的改动——如果 hover 有过渡动画，说明还有其他 transition 声明未被覆盖。

---

## 改 2：输入框背景改为半透明

**文件**：`public/css/app.css`

**操作**：将输入框的背景从 `var(--bg-surface-1)` 实色改为 `rgba(255,255,255,0.02)` 半透明，聚焦态改为 `rgba(255,255,255,0.06)`。

引用：design-wiki/03 Components/input.md — "输入框背景用半透明（`rgba(255,255,255,0.02)`），不是纯色——它从背景中「浮现」而非「贴上」"

```css
/* 之前 */
#panel-search, #command-palette-search, .add-cmd-input, .add-cmd-textarea, .settings-select {
  width: 100%; padding: 6px 12px;
  background: var(--bg-surface-1);         /* ← ❌ #191a1b 实色 */
  border: 1px solid var(--border-standard);
  border-radius: 6px;
  ...
}

/* 之后 */
#panel-search, #command-palette-search, .add-cmd-input, .add-cmd-textarea, .settings-select {
  width: 100%; padding: 6px 12px;
  background: rgba(255,255,255,0.02);       /* ← ✅ 半透明浮现 */
  border: 1px solid var(--border-standard);
  border-radius: 6px;
  ...
}

/* 聚焦态加深 */
#panel-search:focus, #command-palette-search:focus,
.add-cmd-input:focus, .add-cmd-textarea:focus, .settings-select:focus {
  border-color: var(--color-accent);
  background: rgba(255,255,255,0.06);       /* ← ✅ 聚焦态稍深 */
}
```

**Light 模式对应**：
```css
body.light #panel-search, body.light #command-palette-search,
body.light .add-cmd-input, body.light .add-cmd-textarea, body.light .settings-select {
  background: rgba(0,0,0,0.02);
}
body.light #panel-search:focus, body.light #command-palette-search:focus,
body.light .add-cmd-input:focus, body.light .add-cmd-textarea:focus, body.light .settings-select:focus {
  background: rgba(0,0,0,0.04);
}
```

**验证**：
- [ ] 暗色模式下输入框背景为极淡的半透明白（不是 #191a1b 实色）
- [ ] 输入框聚焦时背景加深一级（0.02 → 0.06）
- [ ] Light 模式背景淡黑半透明（0.02/0.04）
- [ ] 输入框内的文字/占位符颜色不变

---

## 改 3：Dialog 动画时长 200ms → 100ms

**文件**：`public/css/app.css`

引用：design-wiki/03 Components/modal.md — "打开动画 100ms（轻微缩放 + 淡入）"

```css
/* 之前 */
#add-command-content {
  ...
  transition: transform 0.2s ease, opacity 0.2s ease;  /* ❌ 200ms */
  ...
}

/* 之后 */
#add-command-content {
  ...
  transition: transform 0.1s ease, opacity 0.1s ease;  /* ✅ 100ms */
  ...
}
```

同时改 backdrop：
```css
/* 之前 */
#add-command-backdrop { transition: opacity 0.2s ease; ... }

/* 之后 */
#add-command-backdrop { transition: opacity 0.1s ease; ... }
```

⌘K 面板 0.15s 保持不变（它是不需要模态感知的快速工具，0.15s 比 Dialog 快但比即时有反馈）。

**验证**：
- [ ] Dialog 打开动画约 0.1s，是 ⌘K 面板（0.15s）的 ~2/3 快

---

## 改 4：header-actions gap 2px → 4px

**文件**：`public/css/app.css`

引用：design-wiki/02 间距 token — "基础单位 8px，仅允许 4px 半单位"

```css
/* 之前 */
#header-actions { gap: 2px; }

/* 之后 */
#header-actions { gap: var(--space-1); }
```

**验证**：
- [ ] header 右端的两个按钮间距为 4px（肉眼几乎看不出区别，保持 grid 一致）

---

## 改 5：font-weight token 统一引用

**文件**：`public/css/app.css`

**5a.** 在 `:root` 中补充 font-weight token（从 terminal.css 迁移过来）：

```css
:root {
  /* ... 已有 tokens ... */
  /* 新增 */
  --font-weight-read: 400;
  --font-weight-ui: 510;
  --font-weight-emphasis: 590;
}
```

**5b.** 全局替换 app.css 中的硬编码 `510` → `var(--font-weight-ui)`：

搜索 `font-weight: 510` 替换为 `font-weight: var(--font-weight-ui)`。需要替换的位置：

| 行号（约） | 选择器 | 当前值 |
|-----------|--------|-------|
| L82 | `.side-panel-tab` | `font-weight: 510` |
| L105 | `.panel-item-label` | `font-weight: 510` |
| L117 | `.cmd-group-title` | `font-weight: 510` |
| L119 | `.cheat-section-title` | `font-weight: 510` |
| L127 | `.settings-group-label` | `font-weight: 510` |
| L135 | `.settings-number-value` | `font-weight: 510` |
| L160 | `.add-cmd-title` | `font-weight: 510` |
| L165 | `.add-cmd-label` | `font-weight: 510` |
| L172 | `.add-cmd-btn-primary` | `font-weight: 510` |

**5c.** 替换 `font-weight: 400` 为 `var(--font-weight-read)`：

| 行号（约） | 选择器 | 当前值 |
|-----------|--------|-------|
| L54 | `body` | `font-weight: 400` |

**5d.** 替换 `font-weight: 590` 或潜在的未来用法（当前无）——但已知 header title 等。

**验证**：
- [ ] app.css `:root` 中有 `--font-weight-*` 三个 token
- [ ] `grep "font-weight: 510" public/css/app.css` 返回空（全部被替换）
- [ ] `grep "font-weight: var" public/css/app.css | wc -l` 匹配替换数量
- [ ] 界面文字字重无视觉变化（token 值与之前硬编码值相同）

---

## 改 6：Inter Variable → 使用可变字体支持 510 字重

**文件**：`public/index.html`

引用：design-wiki/02/linear-typography.md — "使用可变字体（`wght@400;510;590`）——一个文件覆盖所有字重"

```html
<!-- 之前 -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono&family=Fira+Code&display=swap" rel="stylesheet" />

<!-- 之后 -->
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,510;14..32,590&family=JetBrains+Mono&family=Fira+Code&display=swap" rel="stylesheet" />
```

注意：从 `wght@400;500;600` 改为 `opsz,wght@14..32,400;14..32,510;14..32,590`。这是 Inter Variable 的 Google Fonts URL 格式。

**验证**：
- [ ] 页面加载后 `document.fonts.forEach(f => console.log(f.family, f.weight))` 显示 Inter 包含 510 和 590 字重
- [ ] 页面文字渲染无明显变化（500→510 差异极微，但更精确）

---

## 改 7：补充 `--color-brand` 品牌色 token + 对齐 accent 色

**文件**：`public/css/app.css`

引用：design-wiki/02/linear-design-tokens.md — 品牌紫 `#5e6ad2`，交互紫 `#7170ff`，hover 紫 `#828fff`

**7a.** 在 `:root` 中补充 brand 色，并修正 accent 色为 Linear 标准：

```css
:root {
  /* 已有 tokens... */

  /* 品牌 */
  --color-brand: #5e6ad2;         /* 新增 — 品牌紫 */
  --color-accent: #7170ff;        /* 修正 — 原 #4a7cff */
  --color-accent-hover: #828fff;  /* 不变，已经是 Linear 标准 */
}
```

**7b.** Light 模式对应的 accent 色：

```css
body.light {
  /* --color-accent: #3366e6;  修正 */
}
```

检查 light 模式中 `--color-accent` 的值。当前 light 模式（app.css L48）：
```css
--color-accent: #3366e6;
```
改为：
```css
--color-accent: #5e6ad2;
```

**7c.** Primary 按钮引用 brand 色：

```css
/* 之前 */
.add-cmd-btn-primary { background: var(--color-accent); ... }

/* 之后 */
.add-cmd-btn-primary { background: var(--color-brand); ... }
```

**7d.** 更新 xterm 选中色以匹配新的 accent 色：

`theme.js` 中：
```javascript
// DARK_TERMINAL_THEME
selectionBackground: 'rgba(74, 124, 255, 0.28)',   // 旧 #4a7cff
→ selectionBackground: 'rgba(113, 112, 255, 0.28)', // 新 #7170ff

selectionInactiveBackground: 'rgba(255,255,255,0.08)' // 不变

// LIGHT_TERMINAL_THEME
selectionBackground: 'rgba(51, 102, 230, 0.20)',     // 旧 #3366e6
→ selectionBackground: 'rgba(94, 106, 210, 0.20)',   // 新 #5e6ad2
```

**验证**：
- [ ] `:root` 中有 `--color-brand: #5e6ad2`
- [ ] `--color-accent` 从 `#4a7cff` 变为 `#7170ff`
- [ ] `add-cmd-btn-primary` 使用 `var(--color-brand)` 而非 `var(--color-accent)`
- [ ] 暗色模式选中文本的背景色变为紫蓝调
- [ ] Light 模式选中色相应变化

---

## 验证清单（完整）

### 动画（改 1+3）
- [ ] 侧边栏展开/折叠有 0.15s 宽度过渡
- [ ] Dialog 打开有 0.1s scale(0.96→1) + fade
- [ ] Dialog 关闭瞬间消失（无动画）
- [ ] ⌘K 面板打开有 0.15s fade-in
- [ ] Toggle switch knob 滑动流畅 0.15s
- [ ] 所有 hover 效果仍然 0ms 即时切换

### 输入框（改 2）
- [ ] 暗色模式输入框背景为极淡半透明（非 surface-1 实色）
- [ ] 聚焦时背景加深
- [ ] Light 模式同理

### 字重（改 5+6）
- [ ] `grep "font-weight: 510" public/css/app.css` 为 0
- [ ] token 在 app.css :root 中定义
- [ ] 页面文字渲染无退化

### 间距（改 4）
- [ ] header 按钮间距 4px

### 品牌色（改 7）
- [ ] `:root` 中有 `--color-brand: #5e6ad2`
- [ ] `--color-accent` 从 `#4a7cff` 变为 `#7170ff`
- [ ] Primary 按钮使用 `var(--color-brand)`
- [ ] xterm 选中色同步更新（theme.js）
- [ ] Light 模式 accent 色更新

## 注意事项

- ⚠️ **改 1 是唯一可能导致界面"黏滞感"的改动**：删除 `!important` 后，如果页面中有未预期的 transition 声明会暴露出来。改完立刻测试 hover 有无过渡动画
- ⚠️ **改 2 可能影响输入框在终端中的可见性**：半透明背景在 xterm 深色背景上可能太淡。如果不可读，回退到 `rgba(255,255,255,0.04)` 而非 `0.02`
- ⚠️ **改 6 需要网络**：Inter Variable 的 Google Fonts URL 可能被墙（视当前网络环境），建议保留 `&display=swap` 做 fallback
- **改 7 是可选**：sterm 之前有意选择蓝色（#4a7cff）而非 Linear 紫蓝（#5e6ad2），如果保留这个设计决策就跳过

## 涉及文件

| 文件 | 改 1 | 改 2 | 改 3 | 改 4 | 改 5 | 改 6 | 改 7 |
|------|------|------|------|------|------|------|------|
| `public/css/terminal.css` | ✅ | — | — | — | — | — | — |
| `public/css/app.css` | — | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| `public/index.html` | — | — | — | — | — | ✅ | — |
