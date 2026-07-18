# R07: 命令编辑与删除

## 改什么
- `public/js/app.js` — 编辑/删除逻辑、ICONS 新增、renderCommands 新增操作按钮
- `public/css/app.css` — 操作按钮样式

---

## 1. ICONS 新增

在 `app.js` 的 `ICONS` 对象末尾加两个图标：

```javascript
const ICONS = {
  // ... 现有图标 ...
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  delete: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
};
```

---

## 2. renderCommands 增加操作按钮

每个 `.panel-item` 内部，在 `.panel-item-meta` 之前插入操作区。

```html
<button class="panel-item" type="button" data-command="...">
  <div class="panel-item-label">${item.label}</div>
  <div class="panel-item-cmd">${item.command}</div>
  <div class="panel-item-actions">
    <button class="cmd-action-btn cmd-edit" data-index="${i}" type="button" title="编辑">${ICONS.edit}</button>
    <button class="cmd-action-btn cmd-delete" data-index="${i}" type="button" title="删除">${ICONS.delete}</button>
  </div>
  <div class="panel-item-meta">
    ...
  </div>
</button>
```

关键：`renderCommands(list)` 现在接收完整 list，遍历时用 `forEach((item, i) =>` 拿到索引，渲染到 `data-index`。

### 2.1 修改 renderCommands

当前渲染逻辑用 `groups` 分组，`groups[g].map()`。改为带索引的遍历：

```javascript
function renderCommands(list) {
  if (!list || list.length === 0) {
    commandsList.innerHTML = '<div class="panel-empty">暂无收藏命令<br/>点击右侧 + 可添加自定义命令</div>';
    return;
  }
  const groups = {};
  list.forEach((item, idx) => {
    const tag = (item.tags && item.tags[0]) || '通用';
    if (!groups[tag]) groups[tag] = [];
    groups[tag].push({ ...item, _idx: idx });
  });
  const groupOrder = Object.keys(groups).sort();
  commandsList.innerHTML = groupOrder.map((g) => `
    <div class="cmd-group">
      <div class="cmd-group-title">${g}</div>
      ${groups[g].map((item) => `
        <div class="panel-item" data-command="${item.command.replaceAll('"', '&quot;')}" data-index="${item._idx}">
          <div class="panel-item-main" onclick="handleItemClick(this.parentElement.dataset.command)">
            <div class="panel-item-label">${item.label}</div>
            <div class="panel-item-cmd">${item.command}</div>
          </div>
          <div class="panel-item-actions">
            <button class="cmd-action-btn cmd-edit" data-index="${item._idx}" type="button" title="编辑">${ICONS.edit}</button>
            <button class="cmd-action-btn cmd-delete" data-index="${item._idx}" type="button" title="删除">${ICONS.delete}</button>
          </div>
          <div class="panel-item-meta">
            <span class="panel-item-tag">${(item.tags && item.tags[1]) || g}</span>
            ${item.shortcut ? `<span class="panel-item-shortcut">${item.shortcut}</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  // 绑定点击执行
  commandsList.querySelectorAll('.panel-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.cmd-action-btn')) return;
      insertCommand(el.dataset.command);
    });
  });
  // 绑定编辑
  commandsList.querySelectorAll('.cmd-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditCommandDialog(parseInt(btn.dataset.index)));
  });
  // 绑定删除
  commandsList.querySelectorAll('.cmd-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteCommand(parseInt(btn.dataset.index)));
  });
}
```

注意：`panel-item` 从 `<button>` 改为 `<div>`，因为内部嵌套了按钮。点击 `panel-item` 主体执行命令，点击操作按钮则触发对应功能。

---

## 3. CSS：操作按钮

```css
.panel-item { ... /* 改为 div，原有样式不变 */ }
.panel-item-main { cursor: pointer; }
.panel-item-actions {
  display: flex;
  gap: 2px;
  margin: 4px 0;
  opacity: 0;
  transition: opacity 0.1s;
}
.panel-item:hover .panel-item-actions { opacity: 1; }
.cmd-action-btn {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 4px;
  color: var(--text-quaternary); cursor: pointer; padding: 0;
}
.cmd-action-btn:hover { background: var(--bg-surface-2); }
.cmd-edit:hover { color: var(--color-accent); }
.cmd-delete:hover { color: var(--color-error); }
```

---

## 4. 编辑逻辑

### 4.1 openEditCommandDialog

```javascript
let editingIndex = -1;

function openEditCommandDialog(index) {
  editingIndex = index;
  const item = snippets[index];
  if (!item) return;

  const groups = [...new Set(snippets.map((s) => (s.tags && s.tags[0]) || '通用'))];
  addCommandTag.innerHTML = groups.map((g) => `<option value="${g}">${g}</option>`).join('');

  addCommandName.value = item.label || '';
  addCommandCommand.value = item.command || '';
  addCommandTag.value = (item.tags && item.tags[0]) || '通用';
  addCommandTagNew.value = '';
  addCommandShortcut.value = item.shortcut || '';
  addCommandSave.disabled = !(addCommandName.value.trim() && addCommandCommand.value.trim());

  // 改 Dialog 标题
  document.querySelector('.add-cmd-title').textContent = '编辑命令';

  addCommandDialog.style.display = 'flex';
  addCommandDialog.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => { addCommandDialog.classList.add('open'); });
  setTimeout(() => addCommandName.focus(), 50);
}
```

### 4.2 handleSaveCommand 改为支持更新

```javascript
function handleSaveCommand() {
  const name = addCommandName.value.trim();
  const command = addCommandCommand.value.trim();
  const tag = addCommandTagNew.value.trim() || addCommandTag.value;
  const shortcut = addCommandShortcut.value.trim();
  if (!name || !command) return;

  if (editingIndex >= 0 && editingIndex < snippets.length) {
    // 更新已有命令
    const item = snippets[editingIndex];
    item.label = name;
    item.command = command;
    item.tags = [tag, ...(item.tags?.slice(1) || [])];
    item.shortcut = shortcut || undefined;
    updateUserSnippet(editingIndex, item);
  } else {
    // 新增
    const snippet = saveUserSnippet({ label: name, command, tags: [tag], shortcut: shortcut || undefined });
    snippets.push(snippet);
  }

  editingIndex = -1;
  document.querySelector('.add-cmd-title').textContent = '收藏命令';
  renderCommands(snippets);
  closeAddCommandDialog();
  showToast(editingIndex >= 0 ? '命令已更新' : '命令已收藏');
}
```

### 4.3 updateUserSnippet

```javascript
function updateUserSnippet(index, updatedItem) {
  const userSnippets = loadUserSnippets();
  // 查找匹配的用户 snippet（通过 id）
  if (updatedItem.id && updatedItem.id.startsWith('usr_')) {
    const ui = userSnippets.findIndex(s => s.id === updatedItem.id);
    if (ui >= 0) {
      userSnippets[ui] = { ...updatedItem };
      localStorage.setItem(USER_SNIPPETS_KEY, JSON.stringify(userSnippets));
    }
  }
  // 如果是服务端命令（无 usr_ id），编辑结果存为覆盖
  // 目前不做额外处理，只修改内存中的 snippets
}
```

---

## 5. 删除逻辑

```javascript
function deleteCommand(index) {
  const item = snippets[index];
  if (!item) return;
  if (!confirm(`确定删除「${item.label}」？`)) return;

  // 从用户 snippets 中移除（如果是用户自建）
  if (item.id && item.id.startsWith('usr_')) {
    const userSnippets = loadUserSnippets().filter(s => s.id !== item.id);
    localStorage.setItem(USER_SNIPPETS_KEY, JSON.stringify(userSnippets));
  }

  snippets.splice(index, 1);
  renderCommands(snippets);
  showToast('命令已删除');
}
```

---

## 6. Dialog 标题复位

在 `openAddCommandDialog()`（创建模式）中也设置标题为「收藏命令」：

```javascript
function openAddCommandDialog() {
  editingIndex = -1;
  document.querySelector('.add-cmd-title').textContent = '收藏命令';
  // ... 原有逻辑
}
```

---

## 完成标准

- [ ] 每条命令 hover 时显示编辑/删除图标
- [ ] 点击编辑 → 打开对话框，字段预填当前值
- [ ] 编辑保存 → 列表更新，用户自建命令同步到 localStorage
- [ ] 点击删除 → confirm 确认后移除
- [ ] 删除用户自建命令 → 同步清除 localStorage
- [ ] 创建/编辑模式下 Dialog 标题正确显示
- [ ] 点击命令主体仍然执行命令
- [ ] 操作按钮点击不触发命令执行
