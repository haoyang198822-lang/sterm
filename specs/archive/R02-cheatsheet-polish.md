# R02: 速查 Tab 搜索集成 + 代码复制

## 改什么
只改 `public/js/app.js`

## 现状
速查数据已加载并渲染为卡片。但：
1. 侧边面板搜索框只在 commands tab 下工作，切到 cheats tab 后搜索无效
2. 速查卡片里的代码块点击不会复制到剪贴板

## 改动

### 1. 侧边搜索框根据 active tab 切换搜索范围

替换现有 `panelSearch` 监听（当前只有 Enter 键处理），改为：

```javascript
panelSearch?.addEventListener('input', () => {
  const q = panelSearch.value.trim().toLowerCase();
  if (activeSideTab === 'commands') {
    if (!q) { renderCommands(snippets); return; }
    const filtered = snippets.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.command.toLowerCase().includes(q) ||
      (item.tags || []).some(t => t.toLowerCase().includes(q))
    );
    renderCommands(filtered);
  } else if (activeSideTab === 'cheats') {
    renderCheatsheets(q);
  }
});
```

注意：现有代码中 `panelSearch` 的 input 事件是空的，只有 `keydown(Enter)`。加完 input 事件后，保留原有的 Enter 快捷键（只对 commands tab 生效）。

### 2. 代码点击复制

在 `loadCheatsheet()` 渲染完卡片后，加事件绑定：

```javascript
cheatsList.querySelectorAll('.cheat-entry-code').forEach(el => {
  el.addEventListener('click', () => {
    const text = el.textContent;
    navigator.clipboard.writeText(text).catch(() => {});
    // 可选：短暂视觉反馈（闪烁）
    el.style.opacity = '0.6';
    setTimeout(() => { el.style.opacity = ''; }, 200);
  });
});
```

### 3. renderCheatsheets 函数

当前 `loadCheatsheet()` 已渲染卡片。需要提取独立的 `renderCheatsheets(query)` 函数以支持搜索过滤。

```javascript
function renderCheatsheets(query) {
  const filtered = query
    ? cheatsheets.map(s => ({
        ...s,
        entries: s.entries.filter(e =>
          e.title.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query) ||
          e.code.toLowerCase().includes(query)
        )
      })).filter(s => s.entries.length > 0)
    : cheatsheets;

  cheatsList.innerHTML = filtered.map(sheet => {
    const entries = (sheet.entries || []).slice(0, 5);
    return `<article class="cheat-card">
      <div class="cheat-card-header">
        <span class="cheat-card-name">${sheet.name}</span>
        <span class="cheat-card-count">${sheet.count || entries.length} 条</span>
        <span class="cheat-card-category">${sheet.category || ''}</span>
      </div>
      ${entries.map(entry => `
        <div class="cheat-entry">
          <div class="cheat-entry-title">${entry.title}</div>
          <div class="cheat-entry-desc">${entry.description}</div>
          <code class="cheat-entry-code">${entry.code}</code>
        </div>
      `).join('')}
    </article>`;
  }).join('');

  // 绑定复制
  cheatsList.querySelectorAll('.cheat-entry-code').forEach(el => {
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(el.textContent).catch(() => {});
      el.style.opacity = '0.6';
      setTimeout(() => { el.style.opacity = ''; }, 200);
    });
  });
}
```

然后修改 `loadCheatsheet()`，加载完数据后调用 `renderCheatsheets()` 而不是内联渲染。

## 验证
- 侧边面板切换到「速查」tab
- 搜索框输入文字 → 只过滤速查条目
- 切回「命令」tab → 搜索过滤命令
- 点击速查卡片的代码块 → 复制到剪贴板
