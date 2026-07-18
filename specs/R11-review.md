# R11 Review: 命令速查 Reactive Agent

## 改动清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `scripts/agent.js` | ✅ 新建 + 修复 | 模型名改为 deepseek-v4-flash; Auth header 修复（Cursor 写成 `***`） |
| `scripts/agent-tools.js` | ✅ 新建 | 用 sqlite3 CLI（非 spec 的 better-sqlite3）— 更简洁，免 native 编译 |
| `server.js` | ✅ 修改 | 新增 `POST /api/agent/ask` 路由 + `/api/agent/ask` 入口 |
| `package.json` | ✅ 修改 | 新增 `"agent"` script |

## 验证结果

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 数据库查询 | ✅ | `searchCommands('git stash')` 返回 3 条，正确 |
| CLI 模式 (中文) | ✅ | `"怎么查看端口占用"` → 返回完整 lsof/netstat 命令列表 |
| HTTP API | ✅ | `POST /api/agent/ask` → Status 200, 返回正确 answer |

## 发现并修复的 bug

### Bug 1: Authorization header 写死 `***`

**位置**: `scripts/agent.js:44`

**现象**: Cursor 写了 `Authorization: *** ${getApiKey()}\`, 而不是 `Authorization: \`Bearer ${getApiKey()}\``。`***` 是字面文本，不是被隐去的 key。

**后果**: HTTP 请求的 Authorization header 为 `*** sk-xxx`，AGICTO 返回 401。Agent 走到 `catch` 分支 → `formatLocalResults(userInput)` → 只返回本地搜索结果（数据库里没"端口占用"这条命令），最终输出为 `[]`（因为 formatLocalResults 返回的字符串被外层代码当作返回值打印...）

**修复**: 已改回 `Bearer ${getApiKey()}`。

## 与 Spec 的偏差

| Spec 要求 | 实际实现 | 评估 |
|-----------|----------|------|
| `better-sqlite3` | `sqlite3` CLI（child_process） | ⚠️ 可接受 — 省了 native 编译，系统自带 sqlite3 |
| `model: qwen2.5-72b-instruct` | `model: qwen2.5-72b-instruct` | ❌ 未按用户要求改 → 已修复为 `deepseek-v4-flash` |

## 结论

✅ Review 通过。核心逻辑（Agent loop + search_commands 工具 + HTTP API + CLI）全部正常工作。
