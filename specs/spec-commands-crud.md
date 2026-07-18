# Spec：server.js 加入命令 CRUD 路由

## 目标

在 server.js 中添加 `/api/commands/*` 路由，使前端「命令」面板的增删改查功能可用，并兼容已有的 v1 命令数据格式。

## 现状

### 问题 1：前端调 API 全部 404

`frontend/src/lib/api.ts` 定义了对 `/api/commands` 的 CRUD 调用：

```
GET    /api/commands          → 列表
POST   /api/commands          → 新增（body: { command, description, category }）
PUT    /api/commands/:id      → 修改
DELETE /api/commands/:id      → 删除
GET    /api/commands/categories → 分类列表
```

但 server.js 只定义了 `POST /api/agent/ask`，没有任何 commands 路由。前端面板打开时空列表，点击「确定」后 `POST /api/commands` 返回 404 → 对话框不关闭。

### 问题 2：v1 命令数据格式与 v2 不兼容

v1 命令存在 `sterm-data/snippets.json`，每条格式：

```json
{
  "id": "snp_1720941234567",
  "label": "查看服务器日志",
  "command": "ssh sg-lucerna \"journalctl -u lucerna -n 50 --no-pager\"",
  "tags": ["服务器", "日志"],
  "shortcut": "Cmd+Shift+L",
  "usageCount": 12,
  "createdAt": "2026-07-14T10:00:00Z",
  "updatedAt": "2026-07-14T11:00:00Z"
}
```

v2 前端期望的 `CommandItem` 接口（`frontend/src/lib/api.ts` 第 10-16 行）：

```typescript
interface CommandItem {
  id: string;
  command: string;
  description: string;
  category: string;
  createdAt?: string;
}
```

当前 v1 数据两条：
1. `ssh sg-lucerna "journalctl -u lucerna -n 50 --no-pager"` → 查看服务器日志
2. `lsof -i :3000` → 查看端口占用

### 文件结构

```
sterm/
├── server.js                  # Express 入口（加路由目标文件）
├── sterm-data/
│   └── snippets.json          # v1 命令存储（读写此文件）
└── frontend/src/lib/api.ts    # 前端 API 定义（不改）
```

### server.js 当前路由一览

`server.js` 中 `createApp()` 函数包含：
- `POST /api/agent/ask` — Agent 查询
- `GET /node_modules/@xterm/*` — xterm 模块静态资源
- `GET /sterm-data/*` — sterm-data 静态目录
- `GET *` — SPA fallback（生产模式指向 frontend/dist）

`app.use(express.json())` 已启用（第 19 行），body parser 无需额外安装。

## 改动要求

### A. server.js — 在 `createApp()` 中添加路由

在 `POST /api/agent/ask` 路由（第 34 行）之后、xtermModules 循环（第 36 行）之前，插入命令 CRUD 路由。

**文件路径常量：** `const COMMANDS_PATH = path.join(__dirname, 'sterm-data', 'snippets.json')`

#### 路由 1：GET /api/commands

返回命令列表数组。

```
读取 snippets.json → 取 snippets 数组
将每条从 v1 格式映射为 v2 CommandItem：
  { id, command, description: label, category: tags?.[0] || '', createdAt }
返回 JSON 数组
```

| 位置 | 旧 | 新 |
|------|----|----|
| server.js，agent/ask 路由之后 | （无） | `app.get('/api/commands', (req, res) => { ... })` |

#### 路由 2：POST /api/commands

新增一条命令，写入 snippets.json。

```
接收 body: { command, description, category }
生成 id: 'snp_' + Date.now()
生成新条目：{ id, command, label: description, tags: [category], shortcut: '', usageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
追加到 snippets 数组开头
写回 snippets.json
返回 v2 格式的 CommandItem
```

| 位置 | 旧 | 新 |
|------|----|----|
| server.js | （无） | `app.post('/api/commands', (req, res) => { ... })` |

#### 路由 3：PUT /api/commands/:id

修改现有命令。

```
接收 body: { command?, description?, category? }
读取 snippets.json
按 id 查找，更新对应字段（command→command, description→label, category→tags[0]）
更新 updatedAt
写回 snippets.json
返回 v2 格式的 CommandItem
```

| 位置 | 旧 | 新 |
|------|----|----|
| server.js | （无） | `app.put('/api/commands/:id', (req, res) => { ... })` |

#### 路由 4：DELETE /api/commands/:id

删除一条命令。

```
读取 snippets.json
按 id 过滤掉该条
写回 snippets.json
返回 204
```

| 位置 | 旧 | 新 |
|------|----|----|
| server.js | （无） | `app.delete('/api/commands/:id', (req, res) => { ... })` |

#### 路由 5：GET /api/commands/categories

返回去重后的分类列表。

```
读取 snippets.json 的 snippets 数组
提取所有 tags，flatMap 后去重
返回字符串数组
```

| 位置 | 旧 | 新 |
|------|----|----|
| server.js | （无） | `app.get('/api/commands/categories', (req, res) => { ... })` |

### B. 注意事项

- snippets.json 用 `fs.readFileSync` / `fs.writeFileSync` 同步读写（本身数据量极小，< 100 条，同步够用且简单）
- 写之前用 `JSON.parse`，写之后用 `JSON.stringify(data, null, 2)` 保持可读性
- 文件不存时（首次或已删除），`GET /api/commands` 返回 `[]`，不抛异常
- 所有路由放在 `app.use(express.json())` 之后

## 禁止改动

1. **不改 frontend/ 下任何文件** — 前端 API 调用方式不动
2. **不改 server.js 中的 WebSocket 逻辑** — `createWSServer(server)` 调用和 ws-transport 相关内容不动
3. **不改 server.js 中的静态文件服务** — xtermModules 循环、sterm-data 静态目录、SPA fallback 都不动
4. **不改 sterm-data/snippets.json 的顶层结构** — 文件保持 `{ version: 1, snippets: [...], recentCommands: [...] }` 结构
5. **不改 snippets.json 中已有的两条数据** — 迁移只在读取时做格式映射，不修改原始文件中的数据
6. **不改 snippets.json 中的 recentCommands** — 保留原样，不做读写

## 验证标准

```bash
# 启动 server
cd /Users/mac/LLM/sterm && PORT=3001 node server.js &
sleep 1

# 验证 1：GET 列表返回 v2 格式
curl -s http://localhost:3001/api/commands | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d)>=2; assert 'description' in d[0]; assert 'category' in d[0]; print('OK:', len(d), 'commands')"

# 验证 2：POST 新增
curl -s -X POST http://localhost:3001/api/commands -H 'Content-Type: application/json' -d '{"command":"echo test","description":"测试命令","category":"工具"}' | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['command']=='echo test'; print('OK: created', d['id'])"

# 验证 3：GET categories 返回分类
curl -s http://localhost:3001/api/commands/categories | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d,list); print('OK:', len(d), 'categories')"

# 验证 4：PUT 修改（用上一步返回的 id）
ID=$(curl -s http://localhost:3001/api/commands | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
curl -s -X PUT "http://localhost:3001/api/commands/$ID" -H 'Content-Type: application/json' -d '{"description":"改过的描述"}' | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['description']=='改过的描述'; print('OK: updated')"

# 验证 5：DELETE 删除
curl -s -X DELETE "http://localhost:3001/api/commands/$ID" | python3 -c "import sys,json; print('OK: deleted (204)')"

# 验证 6：v1 兼容 — label → description, tags → category
curl -s http://localhost:3001/api/commands | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert all('description' in i for i in d)
assert all('category' in i for i in d)
assert d[0].get('description')  # 不应为空
print('OK: v1 field mapping')
"

# 验证 7：不在改造范围内的 api/agent/ask 继续可用
curl -s -X POST http://localhost:3001/api/agent/ask -H 'Content-Type: application/json' -d '{"query":"hello"}' | python3 -c "import sys; print('OK: agent route status', 'works' if 'answer' in sys.stdin.read() else 'check')"

# 清理：恢复 snippets.json（删除测试新增的那条）
# 停 server
kill %1 2>/dev/null
```

执行后将 server 切回 PORT=3000 重新打包 Electron app。
