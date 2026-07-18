# R05: 收藏命令 Dialog

## 改什么
- `public/index.html` — 加 Dialog DOM + CSS
- `public/js/app.js` — 加交互逻辑 + localStorage 持久化
- `public/css/terminal.css` — 不改

---

## 1. Entry Point：+ 收藏按钮

在 `#panel-search` 旁边加一个按钮。`panel-search-row` 改为 flex 行：

```html
<div class="panel-search-row">
  <div class="panel-search-with-btn">
    <input id="panel-search" type="search" placeholder="搜索命令或输入 / 聚焦" />
    <button id="btn-add-command" type="button" title="收藏当前命令">+</button>
  </div>
</div>
```

CSS：
```css
.panel-search-with-btn {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
.panel-search-with-btn #panel-search {
  flex: 1;
}
#btn-add-command {
  width: 32px;
  flex-shrink: 0;
  background: var(--bg-surface-1, #191a1b);
  border: 1px solid var(--border-standard, rgba(255,255,255,0.08));
  border-radius: 6px;
  color: var(--text-tertiary, #8a8f98);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
#btn-add-command:hover {
  background: var(--bg-surface-2, #28282c);
  color: var(--color-accent, #7170ff);
  border-color: var(--color-accent, #7170ff);
}
```

注意：`panel-search-row` 上原有的 `padding` 保留，内容从原来的单 input 改成 flex 行。

---

## 2. Dialog DOM

在 `#command-palette` 后面、`#status-bar` 前面加：

```html
<div id="add-command-dialog" aria-hidden="true">
  <div id="add-command-backdrop"></div>
  <div id="add-command-content" role="dialog" aria-modal="true" aria-label="收藏命令">
    <div class="add-cmd-header">
      <span class="add-cmd-title">收藏命令</span>
      <button id="add-cmd-close" type="button" aria-label="关闭">&times;</button>
    </div>
    <div class="add-cmd-body">
      <div class="add-cmd-field">
        <label class="add-cmd-label" for="add-cmd-name">名称</label>
        <input id="add-cmd-name" type="text" placeholder="例：查看服务器日志" class="add-cmd-input" />
      </div>
      <div class="add-cmd-field">
        <label class="add-cmd-label" for="add-cmd-command">命令</label>
        <textarea id="add-cmd-command" rows="3" placeholder="例：ssh sg-lucerna \"journalctl -u lucerna -n 50 --no-pager\"" class="add-cmd-textarea"></textarea>
      </div>
      <div class="add-cmd-field">
        <label class="add-cmd-label" for="add-cmd-tag">分组</label>
        <div class="add-cmd-tag-row">
          <select id="add-cmd-tag" class="settings-select"></select>
          <input id="add-cmd-tag-new" type="text" placeholder="或新建分组" class="add-cmd-input add-cmd-input-sm" />
        </div>
      </div>
      <div class="add-cmd-field">
        <label class="add-cmd-label" for="add-cmd-shortcut">快捷键提示（可选）</label>
        <input id="add-cmd-shortcut" type="text" placeholder="例：Cmd+Shift+L" class="add-cmd-input" />
      </div>
    </div>
    <div class="add-cmd-footer">
      <button id="add-cmd-cancel" type="button" class="status-btn">取消</button>
      <button id="add-cmd-save" type="button" class="add-cmd-btn-primary">保存</button>
    </div>
  </div>
</div>
```

---

## 3. Dialog CSS

与 ⌘K 面板一致的风格：

```css
/* Dialog overlay */
#add-command-dialog {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1001;
  align-items: center;
  justify-content: center;
}
#add-command-dialog.open { display: flex; }
#add-command-backdrop {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.85);
}
#add-command-content {
  position: relative;
  width: 480px;
  max-height: 80vh;
  background: var(--bg-surface-1, #191a1b);
  border: 1px solid var(--border-standard, rgba(255,255,255,0.08));
  border-radius: 12px;
  box-shadow:
    rgba(0,0,0,0) 0px 8px 2px,
    rgba(0,0,0,0.01) 0px 5px 2px,
    rgba(0,0,0,0.04) 0px 3px 2px,
    rgba(0,0,0,0.07) 0px 1px 1px,
    rgba(0,0,0,0.08) 0px 0px 1px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.add-cmd-header {
  display: flex;
  align-items: center;
  padding: 16px 20px 0;
}
.add-cmd-title {
  font-size: 15px;
  font-weight: 510;
  color: var(--text-primary, #f7f8f8);
  flex: 1;
}
#add-cmd-close {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 5px;
  color: var(--text-quaternary, #62666d);
  font-size: 18px; cursor: pointer;
}
#add-cmd-close:hover {
  background: var(--bg-surface-2, #28282c);
  color: var(--text-primary, #f7f8f8);
}

/* Body */
.add-cmd-body {
  padding: 16px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.add-cmd-field { display: flex; flex-direction: column; gap: 4px; }
.add-cmd-label {
  font-size: 12px; font-weight: 510;
  color: var(--text-secondary, #d0d6e0);
}
.add-cmd-input, .add-cmd-textarea {
  padding: 8px 12px;
  background: var(--bg-surface-2, #28282c);
  border: 1px solid var(--border-solid-1, #23252a);
  border-radius: 6px;
  font-family: var(--font-sans, "Inter", system-ui, sans-serif);
  font-size: 13px;
  color: var(--text-primary, #f7f8f8);
  outline: none;
}
.add-cmd-input:focus, .add-cmd-textarea:focus {
  border-color: var(--color-accent, #7170ff);
}
.add-cmd-input-sm { flex: 1; }
.add-cmd-textarea {
  resize: vertical;
  min-height: 60px;
  font-family: var(--font-mono, "JetBrains Mono", monospace);
  font-size: 12px;
  line-height: 1.5;
}
.add-cmd-tag-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.add-cmd-tag-row .settings-select { flex: 1; }

/* Footer */
.add-cmd-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
}
.add-cmd-btn-primary {
  padding: 6px 16px;
  background: var(--color-accent, #7170ff);
  border: none; border-radius: 6px;
  color: #fff; font-size: 13px; font-weight: 510;
  cursor: pointer;
}
.add-cmd-btn-primary:hover {
  background: var(--color-accent-hover, #828fff);
}
.add-cmd-btn-primary:disabled {
  opacity: 0.4; cursor: not-allowed;
}
```

---

## 4. JS 逻辑

### 4.1 数据层

```javascript
// localStorage key
const USER_SNIPPETS_KEY = 'sterm-user-snippets';

function loadUserSnippets() {
  const saved = localStorage.getItem(USER_SNIPPETS_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveUserSnippet(snippet) {
  const userSnippets = loadUserSnippets();
  snippet.id = 'usr_' + Date.now();
  snippet.createdAt = new Date().toISOString();
  snippet.usageCount = 0;
  userSnippets.push(snippet);
  localStorage.setItem(USER_SNIPPETS_KEY, JSON.stringify(userSnippets));
  return snippet;
}
```

### 4.2 修改数据加载（loadSnippets）

当前 `loadSnippets()` 只从 JSON 文件加载。改为合并两个来源：

```javascript
async function loadSnippets() {
  // 1. 加载服务器数据
  let serverSnippets = [];
  try {
    const res = await fetch('/sterm-data/snippets.json');
    const data = await res.json();
    serverSnippets = data.snippets || [];
  } catch {
    serverSnippets = [
      { label: '查看端口占用', command: 'lsof -i :3000' },
      { label: '进入项目目录', command: 'cd ./' },
    ];
  }
  // 2. 合并用户自建
  const userSnippets = loadUserSnippets();
  snippets = [...serverSnippets, ...userSnippets];
  renderCommands(snippets);
}
```

### 4.3 Dialog 开关

```javascript
function openAddCommandDialog() {
  // 填充分组下拉：从现有 snippets 提取所有 tags[0]
  const groups = [...new Set(snippets.map(s => (s.tags && s.tags[0]) || '通用'))];
  const select = document.getElementById('add-cmd-tag');
  select.innerHTML = groups.map(g => `<option value="${g}">${g}</option>`).join('');
  
  // 清空表单
  document.getElementById('add-cmd-name').value = '';
  document.getElementById('add-cmd-command').value = '';
  document.getElementById('add-cmd-tag').value = groups[0] || '通用';
  document.getElementById('add-cmd-tag-new').value = '';
  document.getElementById('add-cmd-shortcut').value = '';
  
  // 打开
  document.getElementById('add-command-dialog').classList.add('open');
  document.getElementById('add-command-dialog').setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('add-cmd-name').focus(), 0);
}

function closeAddCommandDialog() {
  document.getElementById('add-command-dialog').classList.remove('open');
  document.getElementById('add-command-dialog').setAttribute('aria-hidden', 'true');
}
```

### 4.4 保存逻辑

```javascript
function handleSaveCommand() {
  const name = document.getElementById('add-cmd-name').value.trim();
  const command = document.getElementById('add-cmd-command').value.trim();
  const tag = document.getElementById('add-cmd-tag').value;
  const newTag = document.getElementById('add-cmd-tag-new').value.trim();
  const shortcut = document.getElementById('add-cmd-shortcut').value.trim();

  if (!name || !command) return; // 必填校验

  const tags = [newTag || tag];

  const snippet = saveUserSnippet({ label: name, command, tags, shortcut: shortcut || undefined });
  snippets.push(snippet);
  renderCommands(snippets);
  closeAddCommandDialog();

  // 反馈 toast（直接用 status 栏闪烁提示）
  showToast('命令已收藏');
}
```

### 4.5 Toast 反馈

简单 toast 不依赖第三方库：

```javascript
function showToast(msg) {
  const existing = document.querySelector('.cmd-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'cmd-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2000);
}
```

CSS：
```css
.cmd-toast {
  position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
  padding: 8px 16px; background: var(--bg-surface-2, #28282c);
  border: 1px solid var(--border-solid-1, #23252a);
  border-radius: 8px; font-size: 13px; color: var(--text-primary, #f7f8f8);
  z-index: 2000; opacity: 0; transition: opacity 0.3s;
  pointer-events: none;
}
.cmd-toast.show { opacity: 1; }
```

### 4.6 事件绑定

在 `initUI()` 或 `initSidePanel()` 内：

```javascript
document.getElementById('btn-add-command').addEventListener('click', openAddCommandDialog);
document.getElementById('add-cmd-close').addEventListener('click', closeAddCommandDialog);
document.getElementById('add-cmd-backdrop').addEventListener('click', closeAddCommandDialog);
document.getElementById('add-cmd-cancel').addEventListener('click', closeAddCommandDialog);
document.getElementById('add-cmd-save').addEventListener('click', handleSaveCommand);
// Enter 保存
document.getElementById('add-command-dialog').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    handleSaveCommand();
  }
  if (e.key === 'Escape') closeAddCommandDialog();
});
```

---

## 5. 完成标准

- [ ] 命令 Tab 搜索栏右侧显示「+」按钮
- [ ] 点击按钮弹出 Dialog，背景遮罩
- [ ] Dialog 有名称、命令、分组、快捷键四个字段
- [ ] 分组下拉自动提取已有标签
- [ ] 分组支持输入新标签（覆盖下拉选择）
- [ ] 名称或命令为空时保存按钮置灰不可点
- [ ] 点击保存 → 存入 localStorage → 刷新列表 → 显示 toast
- [ ] 页面刷新后，用户自建命令与 JSON 数据合并显示
- [ ] 自建命令和 JSON 命令都支持搜索/过滤/点击执行
- [ ] Dialog 可通过 Escape/遮罩点击/取消按钮关闭
- [ ] 与现有 ⌘K 面板不冲突（z-index 1001 > 1000）
