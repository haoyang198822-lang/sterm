# S07: 终端文件拖拽输入路径

## 背景

v1 (vanilla JS) 支持将文件从 Finder 拖入终端，自动输入文件路径。v2 (React) 未实现此功能。

preload.js 已暴露 `electronAPI.getFilePath(file)`（底层使用 `electron` 的 `webUtils.getPathForFile()`），前端只需要加 drop 事件处理。

## 目标

从 Finder 拖拽一个或多个文件到终端区域时：
1. 阻止浏览器默认行为（打开文件）
2. 获取每个文件的绝对路径
3. 路径中含空格时自动用引号包裹
4. 多文件时用空格连接
5. 将处理后的路径字符串发送到当前终端的 WebSocket

## 改动文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/xterm-wrapper.tsx` | +35 行：drop/dragover/dragenter/dragleave 事件处理 |

不改其他文件。

## 实现细节

### 在 xterm-wrapper.tsx 的 cleanup 函数之前

在原有的 `container.addEventListener('keydown', handleKeyDown)` 之后，添加拖拽事件处理：

```typescript
// --- 拖拽文件支持 ---
// 阻止浏览器默认拖拽行为
const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  // 可选：给容器加视觉反馈（灰色边框/背景变化）
  container.classList.add('drag-over');
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  container.classList.remove('drag-over');
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  container.classList.remove('drag-over');

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const api = (window as any).electronAPI;
  const paths: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let filePath: string;

    if (api?.getFilePath) {
      // Electron 环境：用 webUtils.getPathForFile
      filePath = api.getFilePath(file);
    } else {
      // 浏览器回退：用 File.path（仅限非 contextIsolation 模式）
      filePath = (file as any).path || file.name;
    }

    // 路径含空格时用引号包裹
    if (filePath.includes(' ')) {
      filePath = `"${filePath}"`;
    }
    paths.push(filePath);
  }

  // 多文件用空格连接
  const input = paths.join(' ');

  // 通过 WebSocket 发送到终端
  const ws = useTerminalStore.getState().ws;
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'input',
      sessionId,
      text: input,
    }));
  }

  // 确保终端获得焦点
  term.focus();
};
```

### 添加事件监听

```typescript
// 在 handleKeyDown 之后
container.addEventListener('dragover', handleDragOver);
container.addEventListener('dragenter', handleDragEnter);
container.addEventListener('dragleave', handleDragLeave);
container.addEventListener('drop', handleDrop);
```

### 清理事件监听

在 cleanup 函数中移除：

```typescript
// 添加在现有的 cleanup 列表末尾
container.removeEventListener('dragover', handleDragOver);
container.removeEventListener('dragenter', handleDragEnter);
container.removeEventListener('dragleave', handleDragLeave);
container.removeEventListener('drop', handleDrop);
```

### 可选：拖入视觉反馈

在组件所在文件中添加一个 CSS 过渡样式（或在 index.css 中）：

```css
.xterm-container.drag-over {
  outline: 2px solid var(--color-accent, #7170ff);
  outline-offset: -2px;
}
```

但 `xterm-wrapper.tsx` 目前没有单独的 CSS 文件。较简洁的方式是把容器的 `className` 改为：

```tsx
// 从 className="h-full w-full min-h-0 overflow-hidden" 
// 改为使用一个可拖拽容器包裹，或直接用 state 控制 className

// 最简方案：用 ref 的 classList 控制（如上所示），
// 在 handleDragEnter 加 class，handleDragLeave/handleDrop 移除
```

注意：容器的 ref 就是 `containerRef.current`，它本身是 div。用 `container.classList.add/remove('drag-over')` 即可。

### 额外提一嘴 tailwind 写法（如果要用 state 控制 className）

```tsx
const [isDragOver, setIsDragOver] = useState(false);

// 在事件中 setIsDragOver(true/false)

// JSX:
<div 
  ref={containerRef}
  className={`h-full w-full min-h-0 overflow-hidden ${isDragOver ? 'ring-2 ring-[#7170ff] ring-inset' : ''}`}
  tabIndex={0}
/>
```

但这需要引入 `useState`，改动稍大。推荐直接用 `classList` 方案。

## 禁止改动

1. 不改 electron/main.js、electron/preload.js（已有 getFilePath）
2. 不改 stores、lib、server.js、package.json
3. 不改其他组件文件

## 验证标准

1. 从 Finder 拖拽一个文件到终端区域 → 终端输入该文件的完整路径（空格自动加引号）
2. 从 Finder 拖拽多个文件 → 终端输入多个路径（空格分隔，含空格路径各自加引号）
3. 拖入时不触发浏览器默认行为（不打开文件、不导航）
4. 拖入时有视觉反馈（边框高亮）
5. 拖入后终端自动获得焦点
