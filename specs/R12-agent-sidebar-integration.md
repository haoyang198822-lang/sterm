# R12: Agent 接入侧边栏速查 Tab

## 背景

R11 实现了命令速查 Reactive Agent（`POST /api/agent/ask` + `node scripts/agent.js`），但入口只有 CLI 和 curl，没有 UI。需要在侧边栏的"速查" tab 中集成 Agent 搜索界面，让用户直接在界面上用自然语言查命令。

## 目标

将 `data-panel="cheats"` tab 从静态速查展示改造为 Agent 自然语言搜索界面。用户输入口语化命令描述 → 调 Agent API → 显示结果。

## 改动文件

| 文件 | 改动 |
|------|------|
| `public/index.html` | 速查 section 内添加搜索输入框 + 结果容器 |
| `public/js/app.js` | 新增 `initAgentCheats()` 函数，处理搜索和结果渲染 |
| `public/css/app.css` | 新增 Agent 结果区域的样式 |

## 实现细节

### 1. `public/index.html` — 改造速查 section

原内容：
```html
<section class="side-panel-section" data-panel="cheats">
  <div id="cheats-list" class="panel-list"></div>
</section>
```

改为：
```html
<section class="side-panel-section" data-panel="cheats">
  <div class="panel-search-row">
    <div class="panel-search-with-btn">
      <input id="cheats-search" type="search" placeholder="用自然语言描述命令，例如：怎么查看端口占用" />
    </div>
  </div>
  <div id="cheats-list" class="panel-list">
    <div class="panel-empty">输入你想执行的操作，AI 会帮你找到对应的命令</div>
  </div>
</section>
```

说明：
- 保留 `cheats-list` 作为结果容器（兼容现有 JS 代码）
- 新增 `#cheats-search` 输入框，与 `#panel-search` 同类结构
- 初始空状态显示提示文字

### 2. `public/js/app.js` — 新增 agent 搜索逻辑

在文件末尾、`initUI()` 旁边新增函数：

```javascript
function initAgentCheats() {
  const searchInput = document.getElementById('cheats-search');
  const resultsContainer = document.getElementById('cheats-list');
  let pendingRequest = null;

  // 回车触发搜索
  searchInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const query = searchInput.value.trim();
    if (!query) return;

    // 显示加载状态
    resultsContainer.innerHTML = '<div class="panel-empty" style="opacity:0.5">正在搜索...</div>';
    searchInput.disabled = true;

    // 取消上一次未完成的请求
    if (pendingRequest) {
      pendingRequest.abort?.();
    }

    try {
      const controller = new AbortController();
      pendingRequest = controller;

      const res = await fetch('/api/agent/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal
      });

      if (!res.ok) throw new Error(`请求失败 ${res.status}`);

      const data = await res.json();
      renderAgentResult(resultsContainer, data.answer || '未获取到结果');
    } catch (err) {
      if (err.name === 'AbortError') return;
      resultsContainer.innerHTML = `<div class="panel-empty">查询失败：${escapeHtml(err.message)}</div>`;
    } finally {
      searchInput.disabled = false;
      searchInput.focus();
      pendingRequest = null;
    }
  });
}

function renderAgentResult(container, markdownText) {
  // 将 Agent 返回的文本转为 HTML
  // 支持：```bash code ``` → 代码块、**加粗**、--- 分割线
  const html = markdownToHtml(markdownText);
  container.innerHTML = `<div class="agent-result">${html}</div>`;

  // 代码块点击复制
  container.querySelectorAll('.agent-code-block').forEach((el) => {
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(el.textContent || '').catch(() => {});
    });
  });
}

function markdownToHtml(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  // 代码块 ```bash ... ``` 或 ``` ... ```
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const trimmed = code.trim();
    return `<pre class="agent-code-block" data-lang="${lang || ''}"><code>${trimmed}</code><span class="agent-copy-hint">点击复制</span></pre>`;
  });
  // **加粗**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 行内 `code`
  html = html.replace(/`([^`]+)`/g, '<code class="agent-inline-code">$1</code>');
  // --- 分割线
  html = html.replace(/^---+$/gm, '<hr class="agent-hr" />');
  // 换行 → <br>
  html = html.replace(/\n/g, '<br>');
  return html;
}
```

其中 `markdownToHtml` 中的 `escapeHtml` 复用已有的 `escapeHtml()` 函数（已在 L55 定义）。

### 3. `public/css/app.css` — Agent 结果样式

在文件末尾追加：

```css
/* Agent 搜索结果 */
.agent-result {
  padding: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.agent-result strong {
  color: var(--text-primary);
  font-weight: 590;
}

.agent-code-block {
  position: relative;
  background: var(--bg-surface-1);
  border: 1px solid var(--border-standard);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 8px 0;
  font-family: var(--terminal-font-family);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  cursor: pointer;
  color: var(--text-primary);
}

.agent-code-block:hover {
  border-color: var(--color-accent);
}

.agent-copy-hint {
  position: absolute;
  right: 6px;
  top: 6px;
  font-size: 10px;
  color: var(--text-tertiary);
  font-family: var(--ui-font-family);
  opacity: 0;
  transition: opacity 0.15s;
}

.agent-code-block:hover .agent-copy-hint {
  opacity: 1;
}

.agent-inline-code {
  background: var(--bg-surface-1);
  border-radius: 3px;
  padding: 1px 5px;
  font-family: var(--terminal-font-family);
  font-size: 12px;
  color: var(--color-accent);
}

.agent-hr {
  border: none;
  border-top: 1px solid var(--border-standard);
  margin: 12px 0;
}

.agent-result br {
  content: '';
  display: block;
  margin: 4px 0;
}
```

⚠️ 注意：CSS 变量名（`--bg-surface-1`、`--border-standard`、`--text-primary` 等）已在 `app.css` 的 design tokens 中定义。不要新建变量。

### 4. `public/js/app.js` — 挂载到初始化

在 `initSidePanel()` 函数末尾（约 L94），在 tab 切换逻辑中：

```javascript
// 在 activeSideTab 切换处，原代码：
if (activeSideTab === 'cheats') renderCheatsheets();

// 改为：
if (activeSideTab === 'cheats') {
  // 如果用户还没有搜索过，显示空状态
  const cheatsList = document.getElementById('cheats-list');
  if (!cheatsList.querySelector('.agent-result')) {
    cheatsList.innerHTML = '<div class="panel-empty">输入你想执行的操作，AI 会帮你找到对应的命令</div>';
  }
}
```

在 `DOMContentLoaded` 初始化末尾（约 L97，`loadLinuxCheatsheet()` 之后），移除 `loadLinuxCheatsheet()` 调用（不再需要静态 JSON），改为：

```javascript
// 原来
await loadLinuxCheatsheet();

// 改为
initAgentCheats();  // 初始化 Agent 搜索
```

## 注意事项

1. ❌ 不要修改 `index.html` 中除 cheats section 之外的任何 DOM 结构
2. ❌ 不要修改 `server.js`、`scripts/agent.js`、`scripts/agent-tools.js`
3. ⚠️ `escapeHtml()` 已定义在 app.js L55，直接复用
4. ⚠️ Agent 响应可能包含 Markdown 格式，`markdownToHtml` 函数要正确处理代码块和加粗
5. Agent 返回结果中的命令代码块支持点击复制
6. 输入框回车触发搜索，支持 loading 状态和错误处理

## 验证标准

```bash
# 启动服务
node server.js &
sleep 1

# 1. 侧边栏「速查」tab 显示搜索输入框
# 2. 输入"怎么压缩文件"按回车 → 显示加载状态 → 显示结果
# 3. 结果中的代码块可点击（复制）
# 4. 搜索新内容时旧结果被清空，显示新加载状态
# 5. 网络错误时显示错误提示

# HTML 结构验证
grep -n 'cheats-search' public/index.html        # 输入框存在
grep -n 'initAgentCheats' public/js/app.js        # 函数定义存在
grep -n 'agent-result\|agent-code-block' public/css/app.css  # 样式存在

kill %1
```
