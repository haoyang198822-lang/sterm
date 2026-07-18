# S02: 终端引擎 — Frontend Phase B

## 背景

Phase A 搭建了 Vite + React + shadcn 骨架，终端区域为占位文字。Phase B 接入 xterm.js + WebSocket，实现真正的终端 I/O。

## 目标

1. WebSocket 连接到 server.js，自动创建 PTY 会话
2. xterm.js 渲染终端输出，支持输入转发
3. 多会话管理（新建/切换/关闭 tab）
4. 自动重连（断开后 5s 重试）
5. 状态栏显示连接状态
6. 终端 resize 同步（fit addon）

## 改动文件

| 文件 | 改动 | 行数估算 |
|------|------|---------|
| `hooks/use-websocket.ts` | **新建** — WS 连接管理 | ~80 行 |
| `components/xterm-wrapper.tsx` | **新建** — xterm.js 组件封装 | ~80 行 |
| `stores/terminal-store.ts` | 补充 WS 相关状态 + 方法 | ~+20 行 |
| `components/terminal-panel.tsx` | 替换占位文字为真实终端 | ~50 行 |
| `components/panel-status-bar.tsx` | 联动连接状态 | ~+5 行 |

## 实现细节

### 1. `stores/terminal-store.ts` — 补充状态

保留 Phase A 所有接口，新增 ws 相关字段：

```typescript
import { create } from 'zustand'

interface TerminalSession {
  id: string
  title: string
  shell?: string
}

interface TerminalStore {
  sessions: TerminalSession[]
  activeSessionId: string | null
  wsConnected: boolean
  // 新增
  ws: WebSocket | null
  setWs: (ws: WebSocket | null) => void
  addSession: (session: TerminalSession) => void
  removeSession: (id: string) => void
  setActive: (id: string) => void
  setWsConnected: (connected: boolean) => void
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: [],
  activeSessionId: null,
  wsConnected: false,
  ws: null,
  setWs: (ws) => set({ ws }),
  addSession: (session) =>
    set((state) => ({ sessions: [...state.sessions, session], activeSessionId: session.id })),
  removeSession: (id) =>
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== id)
      return {
        sessions: remaining,
        activeSessionId: state.activeSessionId === id
          ? (remaining[remaining.length - 1]?.id ?? null)
          : state.activeSessionId,
      }
    }),
  setActive: (id) => set({ activeSessionId: id }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
}))
```

### 2. `hooks/use-websocket.ts` — WebSocket 管理器

```typescript
import { useEffect, useRef } from 'react'
import { useTerminalStore } from '@/stores/terminal-store'

type MessageHandler = (msg: any) => void

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const { setWs, setWsConnected } = useTerminalStore()
  const handlerRef = useRef(onMessage)
  handlerRef.current = onMessage

  const connect = () => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${location.host}`)

    ws.onopen = () => {
      setWsConnected(true)
      setWs(ws)
      wsRef.current = ws
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        handlerRef.current(msg)
      } catch {}
    }

    ws.onclose = () => {
      setWsConnected(false)
      setWs(null)
      wsRef.current = null
      timerRef.current = setTimeout(connect, 5000)
    }

    ws.onerror = () => {}
  }

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [])
}
```

### 3. `components/xterm-wrapper.tsx` — 终端渲染器

```typescript
import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useTerminalStore } from '@/stores/terminal-store'
import '@xterm/xterm/css/xterm.css'

interface Props {
  sessionId: string
}

export function XTermWrapper({ sessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ws = useTerminalStore((s) => s.ws)

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: '#08090a',
        foreground: '#d0d6e0',
        cursor: '#d0d6e0',
        selectionBackground: '#7170ff',
      },
      allowProposedApi: true,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())

    term.open(containerRef.current)

    setTimeout(() => fit.fit(), 50)
    terminalRef.current = term
    fitRef.current = fit

    // 输出处理 — 监听 WS 消息
    const unsub = useTerminalStore.subscribe((state, prev) => {
      // 当 ws 对象变化时，挂载 onmessage
    })

    // 输入转发
    term.onData((data) => {
      const ws = useTerminalStore.getState().ws
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', sessionId, text: data }))
      }
    })

    // resize 同步
    const observer = new ResizeObserver(() => fit.fit())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      term.dispose()
      terminalRef.current = null
      fitRef.current = null
    }
  }, [sessionId])

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
    />
  )
}
```

### 4. `components/terminal-panel.tsx` — 替换占位文字

```typescript
import { useCallback, useEffect, useRef } from 'react'
import { XTermWrapper } from '@/components/xterm-wrapper'
import { useWebSocket } from '@/hooks/use-websocket'
import { useTerminalStore } from '@/stores/terminal-store'

export function TerminalPanel() {
  const sessions = useTerminalStore((s) => s.sessions)
  const activeId = useTerminalStore((s) => s.activeSessionId)
  const addSession = useTerminalStore((s) => s.addSession)
  const removeSession = useTerminalStore((s) => s.removeSession)
  const setActive = useTerminalStore((s) => s.setActive)
  const outputRef = useRef<Map<string, (data: string) => void>>(new Map())

  // WS 消息分发
  const handleMessage = useCallback((msg: any) => {
    if (msg.type === 'created') {
      addSession({ id: msg.id, title: msg.shell || 'zsh', shell: msg.shell })
    } else if (msg.type === 'output' && msg.sessionId) {
      const writer = outputRef.current.get(msg.sessionId)
      if (writer) writer(msg.text)
    } else if (msg.type === 'exit' && msg.sessionId) {
      removeSession(msg.sessionId)
    }
  }, [addSession, removeSession])

  useWebSocket(handleMessage)

  // 注册 xterm 数据写入函数
  const registerWriter = useCallback((id: string, write: (data: string) => void) => {
    outputRef.current.set(id, write)
    return () => { outputRef.current.delete(id) }
  }, [])

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-canvas)]">
      {/* Tab Bar */}
      <div className="flex h-9 items-center gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-3">
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs ${
              s.id === activeId
                ? 'bg-[var(--color-bg-surface-1)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${s.id === activeId ? 'bg-green-500' : 'bg-gray-500'}`} />
            {s.title}
            <button
              onClick={(e) => { e.stopPropagation(); removeSession(s.id) }}
              className="ml-1 text-[var(--color-text-quaternary)] hover:text-[var(--color-text-primary)]"
            >×</button>
          </div>
        ))}
      </div>

      {/* 终端容器 */}
      <div className="flex-1">
        {activeId ? (
          <XTermWrapperWithWrite sessionId={activeId} registerWriter={registerWriter} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-quaternary)]">
            已关闭所有终端
          </div>
        )}
      </div>
    </div>
  )
}

// 封装 XTermWrapper + writer 注册
function XTermWrapperWithWrite({
  sessionId,
  registerWriter,
}: {
  sessionId: string
  registerWriter: (id: string, write: (data: string) => void) => () => void
}) {
  const onWrite = useCallback((write: (data: string) => void) => {
    useEffect(() => registerWriter(sessionId, write), [sessionId])
  }, [sessionId, registerWriter])
  return <XTermWrapper sessionId={sessionId} onWrite={onWrite} />
}
```

### 5. `components/panel-status-bar.tsx` — 状态联动

已有关联 `useTerminalStore((s) => s.wsConnected)`，不需要额外修改。Phase A 代码已写好连接状态渲染。

## 注意事项

1. ❌ 不要修改 `server.js`、`lib/`、`electron/`、`scripts/`、`public/`
2. ❌ 不要修改 `index.css`（xterm 样式通过 `@xterm/xterm/css/xterm.css` 导入）
3. ⚠️ `useWebSocket` 中 `location.host` 指向的端口取决于访问方式：
   - Vite dev (5173)：占位，WS 代理到 3000（vite.config.ts 已配好）
   - 生产模式 (3000)：直接连接 server.js 的 WS
4. ⚠️ `xterm.css` 需要单独 import，放在 `XTermWrapper` 组件中 import
5. ⚠️ `FitAddon` 延迟 50ms 调用 `fit()` 确保容器已渲染
6. ⚠️ 关闭最后一个 tab 时显示空状态文字，不崩溃

## 验证标准

```bash
# 1. Vite dev server + server.js 同时运行
cd frontend && npm run dev  # 5173
cd /Users/mac/LLM/sterm && node server.js  # 3000

# 2. 访问 localhost:5173 看到：
#    - 状态栏「已连接」绿色圆点
#    - 终端区域出现 zsh tab，tab 上有绿色圆点
#    - 终端显示 zsh 提示符（如 (base) mac@iMac ~ %）

# 3. 在终端输入命令，看到输出

# 4. 点 + 按钮 → 新建第二个终端 tab
# 5. 点 tab 切换 → 切换到另一个会话
# 6. 点 × 按钮 → 关闭当前 tab
# 7. 调整浏览器窗口大小 → 终端自动适配

# 8. NODE_ENV=production 验证
cd frontend && npm run build
cd /Users/mac/LLM/sterm && NODE_ENV=production node server.js
# 访问 localhost:3000 看到同样效果（但 Vite dev 的热更新不可用）
```
