# R14 — 速查本地优先搜索 + 分类浏览

## 概述

速查面板目前纯赖 LLM Agent（deepseek-v4-flash），每次输入都要走外网 API（2-15s），离线就全不能用。而背后 SQLite 里已有 4944 条结构化命令，`searchCommands()` 直查 FTS5 是微秒级的。

本 spec 做两件事：
1. **A — 本地优先搜索**：先直查 FTS5，结果即时返回。仅当本地空了或用户显式要求时，才走 LLM
2. **B — 分类浏览**：速查面板初始显示分类网格，用户可直接翻 git/docker/前端等分类，无需先想

## 目标文件

| 文件 | 改动量 | 说明 |
|------|--------|------|
| `server.js` | +30 行 | 新增 2 个 API 路由 |
| `scripts/agent-tools.js` | +20 行 | 新增 `browseCategory()` / `getCategories()` |
| `frontend/src/lib/api.ts` | +5 行 | 新增 API 调用 |
| `frontend/src/components/cheats-panel.tsx` | **重写** | 从纯对话 → 双模式视图 |
| `specs/R14-cheats-local-browse/spec.md` | 本文件 | — |

## 改动详解

### 1. `agent-tools.js` — 新增导出函数

新增两个函数，复用已有的 sqlite3 exec：

```javascript
// 获取所有分类（含命令数）
function getCategories() {
  const sql = `SELECT category, COUNT(*) as count FROM commands GROUP BY category ORDER BY count DESC`;
  const output = execFileSync('sqlite3', ['-json', DB_PATH, sql], { encoding: 'utf-8' });
  return output.trim() ? JSON.parse(output) : [];
}

// 按分类浏览命令（分页）
function browseCategory(category, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const sql = `SELECT name, code, description FROM commands WHERE category = ${escapeSqlLiteral(category)} ORDER BY name LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
  const output = execFileSync('sqlite3', ['-json', DB_PATH, sql], { encoding: 'utf-8' });
  return output.trim() ? JSON.parse(output) : [];
}
```

module.exports 加上这两个。

### 2. `server.js` — 新增 API 路由

在 `GET /api/cheats/search` 原有路由后新增：

```javascript
// Direct local FTS5 search (no LLM)
app.get('/api/cheats/local', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [], categories: getCategories() });
  const results = searchCommands(q);
  return res.json({ results, categories: getCategories() });
});

// Category listing with counts
app.get('/api/cheats/categories', (req, res) => {
  return res.json(getCategories());
});

// Browse by category
app.get('/api/cheats/browse', (req, res) => {
  const category = (req.query.category || '').trim();
  if (!category) return res.status(400).json({ error: '缺少 category 参数' });
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
  const commands = browseCategory(category, page, limit);
  return res.json(commands);
});
```

### 3. `api.ts` — 新增 API 调用

```typescript
export const api = {
  cheats: {
    // 保留原有 agent 搜索
    search: (q: string) => fetchJSON<CheatItem[]>(`/cheats/search?q=${encodeURIComponent(q)}`),
    categories: () => fetchJSON<{category:string,count:number}[]>(`/cheats/categories`),
    // 新增
    local: (q: string) => fetchJSON<{results: CheatItem[], categories: {category:string,count:number}[]}>(`/cheats/local?q=${encodeURIComponent(q)}`),
    browse: (category: string, page?: number) => fetchJSON<CheatItem[]>(`/cheats/browse?category=${encodeURIComponent(category)}${page ? `&page=${page}` : ''}`),
  },
  // ... commands 不变
};
```

### 4. `cheats-panel.tsx` — 重写

#### 4.0 当前问题

当前面板是纯对话视图：
- 初始显示"欢迎！输入问题搜索速查"
- 只接受自然语言 → LLM 处理
- 没分类、没浏览、没本地搜索
- 每次都是外网 API

#### 4.1 新视图结构

```
┌──────────────────────────────┐
│ [速查] [AI 增强]  ← tab/切换  │
├──────────────────────────────┤
│                              │
│  【初始状态 — 分类网格】       │
│                              │
│  ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ Git  │ │Docker│ │ 前端  │  │
│  │ 240  │ │  70  │ │ 488  │  │
│  └──────┘ └──────┘ └──────┘  │
│  ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ 数据库│ │容器  │ │Shell  │  │
│  │ 205  │ │  70  │ │  57  │  │
│  └──────┘ └──────┘ └──────┘  │
│         ...                  │
│                              │
│  ┌──────────────────────────┐│
│  │ 输入速查问题…             ││ ← textarea 区域
│  └──────────────────────────┘│
│  [发送]                      │
└──────────────────────────────┘
```

#### 4.2 状态机

三种状态：

| 状态 | 触发 | 视图 |
|------|------|------|
| `browse` | 初始 / 点击分类标签 | 显示分类网格 + 当前分类的命令列表 |
| `local` | 在 textarea 输入 → 按 Enter | 显示本地 FTS5 搜索结果 |
| `agent` | 在 textarea 输入 → 按 Ctrl+Enter | 显示 LLM Agent 搜索结果（保留现有对话流程） |

**交互细节：**

1. **初始加载**：调用 `GET /api/cheats/categories` 获取分类数据。显示分类网格
2. **点击分类**：调用 `GET /api/cheats/browse?category=xxx`，显示该分类下的命令列表。每项显示 name（标题）、code（代码块，带复制按钮）、description
3. **输入 + Enter**：调用 `GET /api/cheats/local?q=xxx`，FTS5 搜索结果即时展示。每条结果显示 name、description、code（带复制按钮）。底部显示"AI 增强搜索"按钮
4. **输入 + Ctrl+Enter 或点击"AI 增强"**：调用 `POST /api/agent/ask`（现有流程），保留当前对话式 UI（带聊天记录）
5. **本地搜索无结果**：自动显示"AI 增强搜索"按钮 + 提示文字

#### 4.3 关键组件变化

```tsx
// 当前组件拆分为：
// 1. CategoryGrid — 分类网格
// 2. CommandList — 命令列表（本地搜索/分类浏览共用）
// 3. AgentChat — 现有的 AI 对话视图（从 ChatPanel 提取）

// 主组件 CheatsPanel 控制状态切换
export function CheatsPanel() {
  const [mode, setMode] = useState<'browse' | 'local' | 'agent'>('browse');
  const [categories, setCategories] = useState<{category:string,count:number}[]>([]);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [commands, setCommands] = useState<CheatItem[]>([]);
  const [loading, setLoading] = useState(false);
  // ...
}
```

#### 4.4 AI 增强按钮逻辑

- 本地搜索有结果时 → 结果显示后，底部有一个"AI 增强搜索"按钮（小型、幽灵样式）
- 点击后：用相同 query 调用 `POST /api/agent/ask`，把 LLM 回答追加到本地结果下方
- 本地搜索无结果时 → 自动显示强烈推荐按钮，文案"Ask AI →"
- 显式切换 Tab "AI 增强" → 进入纯对话模式

#### 4.5 底部输入框行为变化

- 始终显示 textarea（与当前一致）
- Enter → **本地 FTS5 搜索**（这是关键变化！）
- Shift+Enter → 换行
- Ctrl+Enter → AI Agent 搜索（原有流程）
- 提示文字更新为：`Enter 搜索本地，Ctrl+Enter AI 增强`

## 验收标准

- [ ] 启动后速查面板显示分类网格，非空白欢迎语
- [ ] 点击"Git"分类，展示 240 条 git 命令列表
- [ ] 输入"git commit" → Enter → 毫秒级返回 FTS5 结果
- [ ] 每条结果有命令代码（code）、描述（description）、复制按钮
- [ ] 输入无意义文字 → 显示"未找到" + "AI 增强"按钮
- [ ] 点击"AI 增强" → 调 LLM，返回结果
- [ ] Ctrl+Enter 直接走 AI 搜索（保留原有对话 UI）
- [ ] 提示文字显示 `Enter 搜索本地，Ctrl+Enter AI 增强`
- [ ] 切换 Tab 再回来，状态保持

## 实现顺序

1. `agent-tools.js` — 新增 `getCategories()` + `browseCategory()`
2. `server.js` — 新增 3 个路由
3. `api.ts` — 新增 API 调用
4. `cheats-panel.tsx` — 重写为双模式
5. 调试：启动开发模式验证

## 注意事项

- `searchCommands()` FTS5 MATCH 支持自然语言查询（已 work），不需要用户输入特定语法
- `<无分类>` 的 2415 条不显示在分类网格中（不友好）。过滤 `WHERE category != '' AND category != '<无分类>'`
- 分类网格最多显示两行，超出的用"查看更多"折叠
- 命令列表中的 code 代码块需要 monospace 字体 + 可复制
- 所有样式对齐当前 `cheats-panel.tsx` 的 CSS token（`--color-bg-surface-1` / `--color-border-subtle` 等），不引入新样式
- 不要改动 terminal-panel、commands-panel、side-panel 等其他组件
- 不要改动 server.js 中除新增路由外的任何已有逻辑
