# batch-4: sterm 扩展 — 命令面板 + 速查 + 设置

## 目录结构

```
sterm/
├── public/
│   ├── index.html         ← 加侧边面板 DOM 结构
│   ├── css/
│   │   ├── terminal.css   ← 不改（batch-2 已冻结）
│   │   └── xterm.css      ← 不改
│   └── js/
│       ├── app.js         ← 加侧面板初始化和路由
│       └── theme.js       ← 不改
├── lib/                   ← 不改（batch-3 已稳定）
├── electron/              ← 不改
└── sterm-data/            ← 新建：用户数据目录
    ├── snippets.json      ← 收藏的命令列表
    └── cheats/            ← 速查表 JSON 文件
        ├── python.json
        ├── git.json
        ├── linux.json
        └── docker.json
```

## 架构图

```
┌──────────────────────────────────────────────────┐
│                   index.html                       │
│  ┌──────────────────────┬────────────────────────┐ │
│  │    Terminal Area     │     Side Panel         │ │
│  │                      │  ┌──────────────────┐  │ │
│  │  ┌────────────────┐  │  │ Tab: ⚡ 命令      │  │ │
│  │  │  Terminal Tabs  │  │  ├──────────────────┤  │ │
│  │  ├────────────────┤  │  │  搜索命令或输入...                  Esc  │框            │  │ │
│  │  │                │  │  │ ├────────────────┤ │  │ │
│  │  │  xterm.js      │  │  │ │lsof -i :3000  │ │  │ │
│  │  │  terminal      │  │  │ │ssh sg-log ... │ │  │ │
│  │  │                │  │  │ │du -sh ./*     │ │  │ │
│  │  ├────────────────┤  │  │ └────────────────┘ │  │ │
│  │  │  状态栏        │  │  ├──────────────────┤  │ │
│  │  └────────────────┘  │  │ Tab: [] 速查     │  │ │
│  │                      │  │ ├────────────────┤ │  │ │
│  │                      │  │ │Python 32 条    │ │  │ │
│  │                      │  │ │Git 18 条       │ │  │ │
│  │                      │  │ │Docker 12 条    │ │  │ │
│  │                      │  │ └────────────────┘ │  │ │
│  │                      │  ├──────────────────┤  │ │
│  │                      │  │ Tab: ⚙ 设置      │  │ │
│  │                      │  │ 字体/字号/主题/行为│  │ │
│  │                      │  └──────────────────┘  │ │
│  └──────────────────────┴────────────────────────┘ │
└──────────────────────────────────────────────────────┘

                   数据流
 前端 localStorage  ←──────→  user settings
       │
  ~/.sterm/snippets.json  ←── 命令收藏（JSON 文件）
  ~/.sterm/cheats/*.json  ←── 速查表（只读）
       │
       ▼
  ws.send({type:"input", text:"ls -la"})  →  PTY 执行
```

## 核心概念

### 1. 侧边面板（SidePanel）

可折叠面板系统，三个 Tab 共享一套**面板切换机制**。

**布局约束**：
- 面板宽度：320px（Linear `--space-8` × 10）
- 面板高度：撑满状态栏以上的终端区域
- 终端区域比例：展开时 `1fr` vs `320px`，折叠时 `1fr` vs `0`
- 折叠状态存储在 localStorage：`sterm-panel-collapsed`
- 快捷键：`⌘\` 或 `⌘B` 折叠/展开

**Tab 切换**：
- Tab Bar 三个按钮：⚡ 命令 / [] 速查 / ⚙ 设置
- 点击切换 Tab，显示对应面板内容
- 当前 Tab 高亮线：`2px solid var(--color-accent)`
- 无动画，瞬时切换（遵循 Linear「零动效」原则）

### 2. 命令收藏（Commands Tab）

**收藏流程**：
```
用户在终端输入 → 按 ⌘⇧S → 弹出收藏对话框 → 分组 / 标签 → 保存
    
[Optional] 自动频率记录：相同命令使用 3 次后提示收藏
```

**命令数据结构**（`~/.sterm/snippets.json`）：

```json
{
  "version": 1,
  "snippets": [
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
  ],
  "recentCommands": [
    {"command": "lsof -i :3000", "lastUsed": "..."}
  ]
}
```

**插入流程**：
```
用户点击命令项 → app.js 处理 click 事件
  → 通过 ws.send(JSON.stringify({
      type: "input",
      text: command + "\n"
    }))
  → 命令立即在终端执行（尾部追加回车触发）
```

**键盘插入**：
```
面板搜索框聚焦时，↓↑ 导航，Enter 插入命令
搜索框 `/` 或 ⌘⇧F 聚焦
```

**快捷键绑定**：

| 快捷键 | 操作 |
|--------|------|
| `⌘K` | 打开命令面板（覆盖层，类似 Linear） |
| `⌘⇧S` | 收藏当前终端输入（最后一条命令） |
| `⌘⇧F` | 聚焦面板搜索框 |
| `⌘\` | 折叠/展开侧边面板 |
| `⌘⇧L` | 插入自定义快捷命令（1-5 可自定义） |
| `⌘⇧P` | 查看端口占用 |

### 3. 速查参考（Cheatsheet Tab）

**数据来源**：
- 内置 JSON 文件：`sterm-data/cheats/*.json`
- 每个文件一个主题（python / git / linux / docker）
- 纯静态内容，不需要后端，不需要网络

**JSON 格式**：

```json
{
  "name": "Python",
  "description": "Python 3 常用语法速查",
  "icon": "python",
  "category": "编程语言",
  "count": 32,
  "source": "https://wangchujiang.com/reference/docs/python.html",
  "entries": [
    {
      "id": "py_list_comp",
      "title": "List Comprehension",
      "description": "列表推导式：快速生成和过滤列表",
      "code": "[x**2 for x in range(10) if x % 2 == 0]",
      "output": "# → [0, 4, 16, 36, 64]"
    },
    {
      "id": "py_lambda",
      "title": "Lambda",
      "description": "匿名函数配合 map/filter",
      "code": "list(map(lambda x: x * 2, [1, 2, 3]))",
      "output": "# → [2, 4, 6]"
    }
  ]
}
```

**渲染方式**：
- 卡片式布局，每张卡片包含：标题 + 描述 + 代码预览
- 代码预览区域使用 `--font-mono` + 暗色背景（`--bg-canvas`）
- 语法高亮：手动标注（JSON 中用 `{ "syntax": "python" }` 标识，前端用简单关键词着色）
- 卡片 hover：背景从 `--bg-surface-1` → `--bg-surface-2`

**交互**：
- 点击代码区域 → 复制到剪贴板
- 点击右上角链接图标 → 在浏览器打开原文（`source` URL）

### 4. 设置面板（Settings Tab）

**四个功能组**：

| 分组 | 设置项 | 存储 |
|------|--------|------|
| 字体 | 终端字体选择、UI 字体选择、字号 | localStorage |
| 主题 | 深色模式切换、配色方案 | localStorage |
| 光标 | 光标闪烁、光标样式（bar/block/underline） | localStorage |
| 行为 | 自动换行、命令自动记录 | localStorage |

**字体设置实时预览**：
- 字体选择下拉 → 预览框文本立即切换字体
- 字号下拉 → 终端区域字号实时变化（通过 CSS custom property）

### 5. 命令面板覆盖层（⌘K 模式）

参考 Linear 的 ⌘K 模式，独立于侧边面板：

```
┌─────────────────────────────────────────┐
│  > 搜索
├─────────────────────────────────────────┤
│                                         │
│  收藏命令                                │
│  → 查看服务器日志              ⌘⇧L      │
│  → 端口占用检查                ⌘⇧P      │
│  → 构建 sterm 发布版                    │
│  → 重启后端服务                          │
│                                         │
│  速查                                    │
│  → Python: List Comprehension            │
│  → Python: Lambda & Map/Filter           │
│  → Git: 交互式 Rebase                    │
│                                         │
│  操作                                    │
│  → 设置字体                              │
│  → 切换主题                              │
│  → 打开快捷键帮助                        │
└─────────────────────────────────────────┘
```

- 宽度 560px，背景 `--bg-surface-1`，圆角 `--radius-panel`，阴影堆叠 (同 modal)
- 遮罩 `rgba(0,0,0,0.85)`
- 自动聚焦搜索框
- 搜索结果分组：收藏命令 / 速查 / 操作

## 技术实现约束

### 前端文件（只改这三个）

| 文件 | 改动 |
|------|------|
| `public/index.html` | 加侧边面板 DOM 结构（面板 tab bar + 三个面板内容区） |
| `public/js/app.js` | 加 `initSidePanel()`、`initCommandPalette()`、负责 ws.send 插入命令 |
| `sterm-data/` (新建) | 存放 snippets.json 和 cheats/ JSON 文件 |

### 不动

- ❌ `electron/main.js`（batch-3 已冻结）
- ❌ `electron/preload.js`（不需要新 IPC）
- ❌ `lib/`（全部后端文件）
- ❌ `server.js`
- ❌ `public/css/terminal.css`（batch-2 已冻结）
- ❌ `public/js/theme.js`
- ❌ 新增 npm 依赖

### 数据存储策略

| 数据 | 存储位置 | 读写方式 |
|------|----------|----------|
| 设置项 | `localStorage` | 同步读写，key: `sterm-*` |
| 命令收藏 | `~/.sterm/snippets.json` | 通过 `fetch()` 读取（Electron 环境下用 Node fs） |
| 速查表 | `sterm-data/cheats/*.json` | 通过 `fetch()` 读取 |
| 最近使用 | localStorage | `sterm-recent-commands` |

### Electron 特有路径处理

Electron 环境下 `fetch()` 不能直接读本地文件系统。需要：

```javascript
// 方案 A：preload 暴露读文件能力（推荐）
// electron/preload.js 加：
ipcRenderer.handle('sterm-read-data', async (_event, path) => {
  return fs.readFileSync(path, 'utf8');
});

// app.js 中用：
if (window.electronAPI) {
  const data = await window.electronAPI.readData('snippets.json');
} else {
  const res = await fetch('/sterm-data/snippets.json');
  const data = await res.text();
}
```

**简化方案（本批次用）**：
先只支持 `fetch()` 路径（HTTP 模式），Electron 模式作为后续批次。

## 改动的具体规格

### 1. 侧边面板 DOM 结构

在 `public/index.html` 的 `#terminal-container` 容器外新增侧边面板容器。终端区域和侧边面板用 flexbox 横向排列。

### 2. app.js 新增模块

```javascript
// 新函数清单

// 侧边面板
function initSidePanel()          // 挂载事件：tab切换、折叠/展开
function focusPanelSearch()       // 聚焦面板搜索框
function togglePanel()            // 折叠/展开（⌘\）

// 命令收藏
function loadSnippets()           // 加载 ~/.sterm/snippets.json
function saveSnippet(snippet)     // 收藏当前命令
function insertCommand(cmd)       // 通过 ws.send 插入命令到终端

// 速查
function loadCheatsheet()         // 加载 sterm-data/cheats/*.json
function renderCheatsheets(data)  // 渲染卡片列表

// 设置
function loadSettings()           // 从 localStorage 读取设置
function applySettings()          // 应用字体/主题/光标设置到 terminal
function saveSetting(key, value)  // 写入 localStorage

// 命令面板
function toggleCommandPalette()   // 打开/关闭 ⌘K 面板
function renderCommandResults()   // 分组渲染搜索结果
function executeCommandItem(item) // 执行选中的命令
```

---

## 执行计划

| 步骤 | 内容 | 预估 |
|------|------|------|
| 1 | index.html 加侧边面板 DOM（空结构 + CSS） | 0.5h |
| 2 | app.js 加 `initSidePanel()` + tab 切换 + 折叠 | 0.5h |
| 3 | 命令收藏：数据结构 + 加载 + 渲染 + 插入终端 | 1h |
| 4 | 命令收藏：收藏当前命令（⌘⇧S） + 自动频率记录 | 0.5h |
| 5 | 速查表：JSON 数据文件 + 加载 + 卡片渲染 | 1h |
| 6 | 设置面板：字体选择 + 字号 + 深色模式 + 持久化 | 1h |
| 7 | ⌘K 命令面板覆盖层 | 1h |
| 8 | 快捷键绑定 + 键盘导航 + Electron 适配 | 0.5h |
| 9 | 端到端验证 | 0.5h |

**总计**：约 6.5h
