# R08: 速查功能 — 集成 jaywcjlove/reference

## 目标

用 jaywcjlove/reference（210 个开发者速查表）替换当前简陋的 4 个静态 JSON，保留侧边栏速查 Tab 交互，数据改为本地预生成 JSON。

## 改什么

- **新建** `scripts/generate-cheats.mjs` — 生成脚本
- **改** `public/js/app.js` — `loadCheatsheet()` + `renderCheatsheets()`
- **改** `public/css/app.css` — section 样式
- 不改 `server.js`、`electron/`、`index.html`

---

## 1. 数据格式

### 新 JSON 格式（每文件）

```json
{
  "name": "Git",
  "description": "Git 常用命令速查",
  "category": "版本控制",
  "count": 98,
  "source": "https://github.com/jaywcjlove/reference",
  "sections": [
    {
      "title": "入门",
      "entries": [
        {
          "title": "创建存储库",
          "description": "",
          "code": "# 创建一个新的本地存储库\ngit init [项目名称]"
        },
        {
          "title": "做出改变",
          "description": "",
          "code": "git status\ngit add [file]"
        }
      ]
    }
  ]
}
```

### index.json 格式

```json
[
  { "name": "Git", "category": "版本控制", "count": 98, "file": "git.json" },
  { "name": "CSS", "category": "前端", "count": 133, "file": "css.json" },
  { "name": "Vim", "category": "工具", "count": 51, "file": "vim.json" }
]
```

---

## 2. 生成脚本

新建 `scripts/generate-cheats.mjs`：

### 流程

1. GET `https://api.github.com/repos/jaywcjlove/reference/contents/docs`
2. 过滤 `.md` 文件列表（约 210 个）
3. 并发下载 raw markdown（并发数 8）
4. 解析 markdown → JSON（用已验证的 parser 逻辑，附本章末尾）
5. 写入 `sterm-data/cheats/{filename}.json`
6. 生成 `sterm-data/cheats/index.json`

### Parser 逻辑

```javascript
function parseCheatsheet(md) {
  const lines = md.split('\n');
  const result = { name: '', sections: [] };
  let currentSection = null, currentEntry = null;
  let pendingText = [], codeLines = [], inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Setex H1: ===
    if (/^={2,}\s*$/.test(line) && i > 0 && lines[i-1].trim() && !result.name) {
      result.name = lines[i-1].trim().replace(/备忘清单.*$/, '').replace(/备忘单.*$/, '').trim();
      continue;
    }

    // Setex H2: --- 且上一行不是 H1
    if (/^-{2,}\s*$/.test(line) && i > 0 && lines[i-1].trim()) {
      const prev = lines[i-1];
      if (prev.startsWith('#')) continue; // ATX 标题的下划线不是 setex
      const h2Title = prev.trim();
      // flush
      currentSection = { title: h2Title, entries: [] };
      result.sections.push(currentSection);
      currentEntry = null; pendingText = []; codeLines = [];
      continue;
    }

    // ATX H3
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      // flush previous entry
      if (currentEntry) { currentEntry.description = pendingText.join('\n').trim(); currentEntry.code = codeLines.join('\n').trim(); }
      if (currentEntry?.title && currentSection) currentSection.entries.push(currentEntry);
      currentEntry = { title: h3Match[1].trim(), description: '', code: '' };
      pendingText = []; codeLines = []; inCodeBlock = false;
      continue;
    }

    // Code block toggle
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) { inCodeBlock = false; } else { inCodeBlock = true; codeLines = []; }
      continue;
    }
    if (inCodeBlock) { codeLines.push(line); continue; }

    // Skip separators / HTML comments
    if (/^-{3,}\s*$/.test(line) && !lines[i-1]?.trim()) continue;
    if (line.startsWith('<!--') || line.startsWith('-->')) continue;
    if (!line.trim()) continue;

    pendingText.push(line.trim());
  }

  // Flush last entry
  if (currentEntry) { currentEntry.description = pendingText.join('\n').trim(); currentEntry.code = codeLines.join('\n').trim(); }
  if (currentEntry?.title && currentSection) currentSection.entries.push(currentEntry);

  result.sections = result.sections.filter(s => s.entries.length > 0);
  return result;
}
```

### argv 支持

- `node scripts/generate-cheats.mjs` — 生成全部
- 默认输出到 `sterm-data/cheats/`
- 运行时打印进度：`[3/210] git.md → git.json (98 entries)`

---

## 3. app.js 改动

### 3.1 loadCheatsheet() 重构

```javascript
async function loadCheatsheet() {
  try {
    const res = await fetch('/sterm-data/cheats/index.json');
    const index = await res.json();
    // index is array of {name, category, count, file}
    // Store metadata for listing, lazy-load content on click
    cheatsheets = index.map(item => ({ ...item, entries: [], sections: [], loaded: false }));
    renderCheatsheets();
  } catch {
    cheatsheets = [];
    renderCheatsheets();
  }
}
```

### 3.2 lazyLoadCheatsheet(filename, index)

点击速查卡片时调用：

```javascript
async function lazyLoadCheatsheet(filename, index) {
  if (cheatsheets[index]?.loaded) return;
  try {
    const res = await fetch(`/sterm-data/cheats/${filename}`);
    const data = await res.json();
    cheatsheets[index] = {
      ...cheatsheets[index],
      sections: data.sections || [],
      entries: [],
      loaded: true,
    };
    renderCheatsheets();
  } catch {}
}
```

### 3.3 renderCheatsheets() 重写

```javascript
function renderCheatsheets(query) {
  const q = (query || '').trim().toLowerCase();

  // Filter index
  let shown = q
    ? cheatsheets.filter(s => s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q))
    : cheatsheets;

  cheatsList.innerHTML = shown.map((sheet, i) => {
    const sections = sheet.loaded ? (sheet.sections || []) : [];
    const totalEntries = sections.reduce((n, s) => n + s.entries.length, 0);

    return `<article class="cheat-card ${sheet.loaded ? 'cheat-card-expanded' : 'cheat-card-collapsed'}" data-cheat-index="${i}">
      <div class="cheat-card-header" data-action="toggle-cheat">
        <span class="cheat-card-name">${sheet.name}</span>
        <span class="cheat-card-count">${totalEntries || sheet.count || 0} 条</span>
        <span class="cheat-card-category">${sheet.category || ''}</span>
        <span class="cheat-card-arrow">${sheet.loaded ? '▾' : '▸'}</span>
      </div>
      ${sheet.loaded ? sections.map(sec => `
        <div class="cheat-section">
          <div class="cheat-section-title">${sec.title}</div>
          ${sec.entries.slice(0, 10).map(entry => `
            <div class="cheat-entry">
              <div class="cheat-entry-title">${entry.title}</div>
              ${entry.description ? `<div class="cheat-entry-desc">${entry.description}</div>` : ''}
              ${entry.code ? `<code class="cheat-entry-code">${escapeHtml(entry.code)}</code>` : ''}
            </div>
          `).join('')}
          ${sec.entries.length > 10 ? `<div class="cheat-more">…还有 ${sec.entries.length - 10} 条</div>` : ''}
        </div>
      `).join('') : ''}
    </article>`;
  }).join('');

  // Click header to expand/collapse
  cheatsList.querySelectorAll('[data-action="toggle-cheat"]').forEach(el => {
    el.addEventListener('click', () => {
      const card = el.closest('.cheat-card');
      const idx = Number(card.dataset.cheatIndex);
      const sheet = cheatsheets[idx];
      if (!sheet.loaded) {
        lazyLoadCheatsheet(sheet.file, idx);
      } else {
        // Toggle expanded
        card.classList.toggle('cheat-card-expanded');
        card.classList.toggle('cheat-card-collapsed');
        const arrow = card.querySelector('.cheat-card-arrow');
        if (arrow) arrow.textContent = card.classList.contains('cheat-card-expanded') ? '▾' : '▸';
      }
    });
  });

  // Copy code on click
  cheatsList.querySelectorAll('.cheat-entry-code').forEach(el => {
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(el.textContent || '').catch(() => {});
      el.style.opacity = '0.6';
      setTimeout(() => { el.style.opacity = ''; }, 200);
    });
  });
}
```

### 3.4 搜索联动

侧边栏搜索已在 `initSidePanel()` 中绑定了 `panelSearch?.addEventListener('input')`，搜索时调用 `renderCheatsheets(panelSearch.value)`。

当前逻辑检查 `activeSideTab === 'cheats'` 时调用 `renderCheatsheets(q)`，保持不变。

### 3.5 loadCheatsheet 调用时机

`DOMContentLoaded` 中已有 `loadCheatsheet()` 调用，不变。

---

## 4. CSS 改动

加到 `public/css/app.css` 末尾：

```css
/* 速查 Section 样式 */
.cheat-section { margin-bottom: 12px; }
.cheat-section-title {
  font-size: 11px;
  font-weight: 510;
  color: var(--text-quaternary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 6px 0 4px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 6px;
}

/* 折叠/展开指示器 */
.cheat-card-arrow {
  font-size: 10px;
  color: var(--text-quaternary);
  margin-left: auto;
  transition: transform 0.15s;
}
.cheat-card-header { cursor: pointer; }
.cheat-card-collapsed .cheat-section { display: none; }
.cheat-card-expanded .cheat-section { display: block; }

/* 更多提示 */
.cheat-more {
  font-size: 10px;
  color: var(--text-quaternary);
  padding: 4px 0;
  text-align: center;
}

/* 当前 cheat-card 微调 */
.cheat-card { cursor: default; }
.cheat-card-header:hover { opacity: 0.8; }

/* 代码块在 320px 侧边栏内的适配 */
.cheat-entry-code {
  display: block;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
```

---

## 5. 运行方式

```bash
cd /Users/mac/LLM/sterm
node scripts/generate-cheats.mjs
```

安装依赖：零（只用 Node.js 内置 fetch + fs）

---

## 6. 完成标准

- [ ] `node scripts/generate-cheats.mjs` 成功生成全部 JSON 到 `sterm-data/cheats/`
- [ ] `index.json` 中列出所有 210 个速查表
- [ ] 浏览器打开后，速查 Tab 显示可点击的速查列表（带 count + category）
- [ ] 点击一个速查 → 显示加载中 → 展开显示 sections → entries（标题+描述+代码）
- [ ] 代码块点击可复制
- [ ] 搜索框输入 → 按名称/分类过滤速查列表
- [ ] 折叠/展开可反复切换
- [ ] section 标题为灰色大写
- [ ] 页面加载不报错
- [ ] Edge cases: 有些文件无 sections（空文件），显示「无内容」
