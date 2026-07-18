# R11: 命令速查 Reactive Agent

## 背景

sterm 已有 210 个速查 JSON（6780 条命令），经预处理后得到 `sterm-data/cheats.db`（3.4MB，FTS5 全文索引，4944 条有效命令）。当前用户只能通过侧边栏"速查参考 Tab"按分类浏览 + 关键词搜索，但命令太多（4944 条）没法有效浏览。

改用 **Reactive Agent** 做自然语言搜索——用户用口语描述想做的操作，LLM 理解意图 → 工具查命令 → 返回结果。

## 目标

在 sterm 项目中增加一个命令速查 Agent，提供两种接入方式：
1. **HTTP API** — Express 路由 `POST /api/agent/ask`
2. **CLI 模式** — `node scripts/agent.js "你的问题"`

## 前提

- `sterm-data/cheats.db` 已存在（FTS5 全文索引，4944 条命令）
- Node.js 22 可用
- AGICTO proxy API key 在 `~/.zshrc` 中（`export AGICTO_API_KEY=...`）

## 架构

```
用户输入
    │
    ▼
┌──────────────────────┐
│  API / CLI 入口       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│          Agent Loop                   │  ← 最多 3 轮
│                                      │
│  ┌──────────┐                        │
│  │ System   │  ← prompt: 命令速查助手  │
│  │ Prompt   │    有 search_commands 工具 │
│  └────┬─────┘                        │
│       ▼                              │
│  ┌──────────┐     tool_calls?        │
│  │  LLM     │───────yes──────────▶   │
│  │ (AGICTO) │                        │
│  │ Qwen     │     no                 │
│  └────┬─────┘                        │
│       ▼ 有 tool_calls                │
│  ┌────────────────┐                   │
│  │ search_commands │  ← SQLite FTS5    │
│  │ (query → 5条)   │     查询          │
│  └────────┬───────┘                   │
│           ▼                           │
│   结果→送回 LLM 再推理（最多 3 轮）   │
└──────────────────────────────────────┘
       │
       ▼
最终答案 → 返回给用户
```

## 涉及文件

### 新建文件

| 文件 | 用途 |
|------|------|
| `scripts/agent.js` | Agent 主入口 — CLI 模式 + AgentLoop 逻辑 |
| `scripts/agent-tools.js` | 工具定义（search_commands）+ SQLite 查询实现 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `server.js` | 新增 `POST /api/agent/ask` 路由 |
| `package.json` | 新增 `better-sqlite3` 依赖，新增 `"agent"` script |

## 实现细节

### 1. 安装依赖

```bash
cd /Users/mac/LLM/sterm
npm install better-sqlite3
```

`better-sqlite3` 是同步的 native 模块，与项目中已有的 `node-pty` 同类，适合 Agent loop 的同步风格。

### 2. `scripts/agent-tools.js` — 工具定义 + 数据库查询

```javascript
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'sterm-data', 'cheats.db');
const db = new Database(DB_PATH);

// === Tool Definition（给 LLM 的 JSON schema）===
const SEARCH_COMMANDS_TOOL = {
  type: 'function',
  function: {
    name: 'search_commands',
    description: '在速查数据库中搜索命令，支持自然语言查询。查询时要将用户的中文意图翻译为英文关键词以获得更好的匹配效果',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '命令描述或关键词（英文），例如："git revert commit"、"check port usage"、"compress files"'
        }
      },
      required: ['query']
    }
  }
};

// === Tool 实现 ===
function searchCommands(query) {
  const stmt = db.prepare(`
    SELECT c.name, c.code, c.description
    FROM commands_fts f
    JOIN commands c ON c.id = f.rowid
    WHERE commands_fts MATCH ?
    ORDER BY rank
    LIMIT 5
  `);
  const rows = stmt.all(query);
  return rows.map(r => ({
    name: r.name,
    command: r.code,
    description: r.description
  }));
}

module.exports = { SEARCH_COMMANDS_TOOL, searchCommands };
```

⚠️ **注意**：`better-sqlite3` 的 `MATCH` 查询支持 `*` 通配符。FTS5 默认的 tokenizer 会根据空格和标点分词，所以 "git revert" 会匹配到同时包含 git 和 revert 的记录。

### 3. `scripts/agent.js` — Agent 主循环 + CLI 入口

```javascript
const { SEARCH_COMMANDS_TOOL, searchCommands } = require('./agent-tools');
const fs = require('fs');
const path = require('path');

// === 从 ~/.zshrc 读取 AGICTO_API_KEY ===
function getApiKey() {
  const zshrc = fs.readFileSync(path.join(os.homedir(), '.zshrc'), 'utf-8');
  const match = zshrc.match(/export AGICTO_API_KEY=["']?([^"'\n]+)/);
  if (!match) throw new Error('AGICTO_API_KEY not found in ~/.zshrc');
  return match[1];
}

const API_KEY = getApiKey();
const AGICTO_URL = 'https://api.agicto.cn/v1/chat/completions';
const MODEL = 'deepseek-v4-flash';

// === System Prompt ===
const SYSTEM_PROMPT = `你是 sterm 命令速查助手。你的任务是理解用户想要做什么操作，然后通过 search_commands 工具查找对应的命令。

规则：
- 当用户问命令时，优先用工具搜索，不要凭自己的知识回答
- 将用户的中文意图翻译为英文关键词传给 search_commands
- 如果工具返回了匹配结果，整理后清晰呈现给用户（含命令代码块）
- 如果工具没有返回结果，告知用户没找到，再用自己的知识提供相近建议
- 只回答与命令速查相关的问题，不相关时礼貌拒绝`;

// === Agent Loop ===
async function agentLoop(userInput) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userInput }
  ];

  let maxTurns = 3;

  while (maxTurns-- > 0) {
    const response = await callAGICTO(messages);

    // 检查 tool_calls
    if (response.choices?.[0]?.message?.tool_calls) {
      const msg = response.choices[0].message;
      messages.push(msg);

      for (const call of msg.tool_calls) {
        if (call.function.name === 'search_commands') {
          const args = JSON.parse(call.function.arguments);
          const result = searchCommands(args.query);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result)
          });
        }
      }
      // 继续循环——把工具结果送回 LLM
    } else {
      // LLM 直接回答了，结束循环
      return response.choices?.[0]?.message?.content || '暂无回应';
    }
  }

  // 超过最大轮数，返回最后一次回答
  const lastMsg = messages[messages.length - 1];
  return lastMsg.content || '未能找到合适结果';
}

// === 调用 AGICTO（OpenAI 兼容接口）===
async function callAGICTO(messages) {
  const body = {
    model: MODEL,
    messages: messages,
    tools: [SEARCH_COMMANDS_TOOL],
    tool_choice: 'auto',
    max_tokens: 1024,
    temperature: 0.1
  };

  const res = await fetch(AGICTO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AGICTO API error ${res.status}: ${text}`);
  }

  return res.json();
}

// === CLI 入口 ===
if (require.main === module) {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.error('用法: node scripts/agent.js <查询内容>');
    console.error('示例: node scripts/agent.js "git怎么撤销上一次commit"');
    process.exit(1);
  }
  agentLoop(query).then(result => {
    console.log(result);
  }).catch(err => {
    console.error('Agent 错误:', err.message);
    process.exit(1);
  });
}

module.exports = { agentLoop };
```

### 4. `server.js` — 新增 API 路由

在 `createApp()` 函数中，`createWSServer(server)` 之前，加入：

```javascript
// Agent API
app.use(express.json());
app.post('/api/agent/ask', async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: '缺少 query 参数' });
  }
  try {
    const { agentLoop } = require('./scripts/agent');
    const answer = await agentLoop(query);
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### 5. `package.json` — 新增 script

```json
"scripts": {
  "start": "node server.js",
  "agent": "node scripts/agent.js",
  "electron:dev": "electron .",
  "electron:build": "electron-builder --mac --dir"
}
```

## 验证标准

```bash
# 1. CLI 模式 — 正常查询
node scripts/agent.js "git怎么撤销上一次commit"
# 期望：返回 git reset HEAD~1 或 git revert HEAD 等命令，含代码块

# 2. CLI 模式 — 中文自然语言
node scripts/agent.js "查看端口占用"
# 期望：返回 netstat/lsof 等命令

# 3. CLI 模式 — 查不到
node scripts/agent.js "量子计算编程"
# 期望：告知未找到，提供相近建议

# 4. HTTP API
curl -X POST http://localhost:3000/api/agent/ask \
  -H 'Content-Type: application/json' \
  -d '{"query":"压缩文件"}'
# 期望：{"answer":"..."}

# 5. 数据库连接确认
node -e "const s = require('./scripts/agent-tools'); console.log(JSON.stringify(s.searchCommands('git stash'), null, 2))"
# 期望：返回 git stash 相关命令列表

# 6. server.js 启动无报错
node server.js &
sleep 1
curl -s http://localhost:3000/api/agent/ask -X POST -H 'Content-Type: application/json' -d '{"query":"test"}' | head -c 200
kill %1
# 期望：返回 JSON 响应，无 500 错误
```

## 注意事项

1. **AGICTO_API_KEY** 从 `~/.zshrc` 读取（格式 `export AGICTO_API_KEY=sk-xxx`），不要硬编码
2. **better-sqlite3** 是 native 模块，`npm install` 时需要本地编译环境（已有 node-pty，环境已就绪）
3. **Agent 循环最多 3 轮**，防止无限循环消耗 token
4. **tool_choice: 'auto'** — 让 LLM 自主决定是否调工具
5. FTS5 的 MATCH 查询对特殊字符敏感（如 `git stash --help` 中的 `--` 会被忽略），这是 FTS5 正常行为
6. 这个 Agent **不保留对话历史**，每次请求独立——如果需要多轮对话后续扩展

## 完成标记

实现完成后，更新 `specs/README.md` 完成状态表，新增一行：
| 命令速查 Agent（自然语言搜索） | DONE |
