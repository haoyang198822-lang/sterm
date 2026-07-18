# R13: 速查 Tab 对话式 UI

## 背景

R12 实现了 Agent 搜索接入侧边栏速查 tab，但 UI 简单：顶部输入框 + 单次结果替换。参考 Lucerna 对话界面（`/Users/mac/LLM/Lucerna/ui/`），改为类似聊天的对话式交互，提升视觉体验。

## 目标

将速查 tab 从「搜索框 + 单结果」改为「对话气泡 + 底部固定输入栏」，每次搜索保留为一条对话记录（用户问题 + Agent 回答）。

## 改动文件

| 文件 | 改动 |
|------|------|
| `public/index.html` | 重写速查 section DOM 结构 |
| `public/js/app.js` | 新增对话渲染逻辑，修改 `initAgentCheats` |
| `public/css/app.css` | 完整对话样式（替换原有 agent-result 样式） |

## 实现细节

### 1. `public/index.html` — 速查 section 新结构

```html
<section class="side-panel-section" data-panel="cheats">
  <div id="cheats-messages" class="cheats-messages">
    <!-- 空状态，由 JS 控制显隐 -->
    <div class="cheats-welcome" id="cheats-welcome">
      <div class="cheats-welcome-content">
        <p>输入你想执行的操作<br/>AI 会帮你找到对应的命令</p>
      </div>
    </div>
    <!-- 对话消息由 JS 动态插入 -->
  </div>
  <div class="cheats-input-bar">
    <div class="cheats-input-wrap">
      <textarea id="cheats-input" class="cheats-input" rows="1" placeholder="用自然语言描述命令…"></textarea>
      <button id="cheats-send" class="cheats-send-btn" type="button">
        <!-- 上传图标 SVG -->
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  </div>
</section>
```

说明：
- `#cheats-messages` — 可滚动消息容器，flex column 反向排列（最新在底部）
- `#cheats-welcome` — 初始空状态提示，有对话记录时隐藏
- `.cheats-input-bar` — 固定在底部的输入栏
- `#cheats-input` — 多行文本域，支持 Shift+Enter 换行，Enter 发送
- `#cheats-send` — 发送按钮（+ 图标，发送后变回 +）

### 2. `public/js/app.js` — 对话逻辑

修改 `initAgentCheats()` 为新逻辑，新增辅助函数：

```javascript
function initAgentCheats() {
  const input = document.getElementById('cheats-input');
  const sendBtn = document.getElementById('cheats-send');
  const container = document.getElementById('cheats-messages');
  const welcome = document.getElementById('cheats-welcome');
  let pendingRequest = null;

  function addMessage(role, content) {
    // 隐藏 welcome
    if (welcome) welcome.style.display = 'none';

    const div = document.createElement('div');
    div.className = 'cheats-msg cheats-msg-' + role;

    const bubble = document.createElement('div');
    bubble.className = 'cheats-bubble';
    bubble.innerHTML = content;
    div.appendChild(bubble);

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function showError(msg) {
    const div = addMessage('assistant', '<span style="color:var(--color-error)">' + escapeHtml(msg) + '</span>');
    return div;
  }

  async function send() {
    const query = input.value.trim();
    if (!query) return;

    // 用户消息
    addMessage('user', '<p>' + escapeHtml(query) + '</p>');

    // 清空输入
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    // loading 占位
    const loadingDiv = addMessage('assistant', '<div class="cheats-loading"><span class="cheats-dot"></span><span class="cheats-dot"></span><span class="cheats-dot"></span></div>');

    if (pendingRequest) pendingRequest.abort?.();
    try {
      const controller = new AbortController();
      pendingRequest = controller;

      const res = await fetch('/api/agent/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('请求失败 ' + res.status);
      const data = await res.json();

      // 替换 loading 为真实结果
      const html = markdownToHtml(data.answer || '未获取到结果');
      loadingDiv.querySelector('.cheats-bubble').innerHTML = html;

      // 为代码块绑定点击复制
      loadingDiv.querySelectorAll('.cheats-code-block').forEach((el) => {
        el.addEventListener('click', () => {
          navigator.clipboard.writeText(el.textContent || '').catch(() => {});
        });
      });
    } catch (err) {
      if (err.name === 'AbortError') return;
      loadingDiv.querySelector('.cheats-bubble').innerHTML =
        '<span style="color:var(--color-error)">查询失败：' + escapeHtml(err.message) + '</span>';
    } finally {
      sendBtn.disabled = false;
      pendingRequest = null;
      input.focus();
    }
  }

  // 发送按钮
  sendBtn.addEventListener('click', send);

  // Enter 发送，Shift+Enter 换行
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    // 自动调整高度
    setTimeout(() => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }, 0);
  });

  // 初始化高度
  input.style.height = 'auto';
}
```

同时需要更新 `markdownToHtml` 中的 CSS 类名，从 `agent-*` 改为 `cheats-*`：

```javascript
// markdownToHtml 中的类名改为 cheats-*
// agent-code-block → cheats-code-block
// agent-copy-hint → cheats-copy-hint
// agent-inline-code → cheats-inline-code
// agent-hr → cheats-hr
```

### 3. `public/css/app.css` — 完整对话样式

**移除**原有的 `.agent-result` / `.agent-code-block` / `.agent-copy-hint` / `.agent-inline-code` / `.agent-hr` 样式块（约 L192-252）。

**新增**以下样式：

```css
/* ══════════════════════════════════════
   速查对话模式
   ══════════════════════════════════════ */

/* 消息容器 — 可滚动，填充剩余空间 */
.cheats-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 欢迎空状态 */
.cheats-welcome {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 12px;
}
.cheats-welcome-content {
  text-align: center;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.8;
}

/* 消息行 */
.cheats-msg {
  display: flex;
  flex-shrink: 0;
}
.cheats-msg.user {
  justify-content: flex-end;
}
.cheats-msg.assistant {
  justify-content: flex-start;
}

/* 消息气泡 */
.cheats-bubble {
  max-width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  border-radius: 8px;
  word-break: break-word;
}
.cheats-msg.user .cheats-bubble {
  background: rgba(94, 106, 210, 0.12);
  border: 1px solid rgba(94, 106, 210, 0.2);
  border-bottom-right-radius: 4px;
}
.cheats-msg.assistant .cheats-bubble {
  background: var(--bg-surface-1);
  border: 1px solid var(--border-standard);
  border-bottom-left-radius: 4px;
}

/* 气泡内的 Markdown */
.cheats-bubble strong {
  font-weight: var(--font-weight-emphasis);
  color: var(--text-primary);
}
.cheats-bubble p {
  margin: 4px 0;
}
.cheats-bubble p:first-child { margin-top: 0; }
.cheats-bubble p:last-child { margin-bottom: 0; }

/* 代码块 */
.cheats-code-block {
  position: relative;
  background: var(--bg-canvas);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 8px 0;
  font-family: var(--terminal-font-family);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  cursor: pointer;
  color: var(--text-secondary);
}
.cheats-code-block:hover {
  border-color: var(--color-accent);
}

.cheats-copy-hint {
  position: absolute;
  right: 6px;
  top: 6px;
  font-size: 10px;
  color: var(--text-quaternary);
  font-family: var(--ui-font-family);
  opacity: 0;
  transition: opacity 0.15s;
}
.cheats-code-block:hover .cheats-copy-hint {
  opacity: 1;
}

/* 行内代码 */
.cheats-inline-code {
  background: var(--bg-surface-1);
  border-radius: 3px;
  padding: 1px 5px;
  font-family: var(--terminal-font-family);
  font-size: 12px;
  color: var(--color-accent);
}

/* 分割线 */
.cheats-hr {
  border: none;
  border-top: 1px solid var(--border-standard);
  margin: 12px 0;
}

/* 加载动画 */
.cheats-loading {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 8px 0;
}
.cheats-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: cheats-bounce 1.4s ease-in-out infinite both;
}
.cheats-dot:nth-child(1) { animation-delay: -0.32s; }
.cheats-dot:nth-child(2) { animation-delay: -0.16s; }
.cheats-dot:nth-child(3) { animation-delay: 0s; }

@keyframes cheats-bounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* ══════════════════════════════════════
   速查输入栏 — 固定在底部
   ══════════════════════════════════════ */
.cheats-input-bar {
  padding: 8px 12px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-panel);
  flex-shrink: 0;
}

.cheats-input-wrap {
  position: relative;
  display: flex;
  align-items: flex-end;
}

.cheats-input {
  flex: 1;
  width: 100%;
  padding: 8px 36px 8px 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--border-standard);
  border-radius: 20px;
  color: var(--text-primary);
  font-family: var(--ui-font-family);
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
  min-height: 34px;
  max-height: 80px;
}
.cheats-input::placeholder {
  color: var(--text-quaternary);
}
.cheats-input:focus {
  border-color: var(--color-accent);
  background: rgba(255,255,255,0.06);
}

.cheats-send-btn {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 26px;
  height: 26px;
  padding: 0;
  background: var(--color-brand);
  color: #fff;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.cheats-send-btn:hover {
  background: var(--color-accent-hover);
}
.cheats-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cheats-send-btn svg {
  display: block;
}
```

### 4. 修改 `initSidePanel` 中的 tab 切换逻辑

当前代码在切换到 cheats tab 时会重置为空状态。改为：

```javascript
if (activeSideTab === 'cheats') {
  // 不再重置内容，保留对话历史
  const welcome = document.getElementById('cheats-welcome');
  if (welcome && container.querySelectorAll('.cheats-msg').length > 0) {
    welcome.style.display = 'none';
  }
}
```

## 注意事项

1. ❌ 不要修改 `server.js`、`scripts/`、`lib/`、`electron/`
2. ❌ 不要修改 `public/index.html` 中除 cheats section 之外的 DOM
3. ❌ 不要修改 `public/css/app.css` 中除 agent/cheats 相关样式之外的内容
4. ⚠️ 移除旧的 `.agent-*` CSS 类后，确保 `markdownToHtml` 中同时改为 `.cheats-*`
5. ⚠️ `escapeHtml` 已经存在，直接复用
6. ⚠️ 对话模式下结果不再清空历史，每次搜索追加一条用户消息 + 一条助手消息

## 验证标准

```bash
# 1. 速查 tab 显示对话界面：底部输入栏 + 空状态 welcome
# 2. 输入文字按 Enter → 显示用户消息气泡 + 加载动画 → 显示助手结果气泡
# 3. 代码块可点击复制
# 4. 再次搜索 → 追加新对话，历史保留
# 5. 输入栏自动增高（多行）
# 6. 切换 tab 再切回，对话历史保留
# 7. Shift+Enter 换行，Enter 发送
```
