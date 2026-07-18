# R01: ⌘K 命令面板键盘导航

## 改什么
只改 `public/js/app.js`

## 现状
⌘K 面板能打开/关闭，能渲染搜索结果，但无法用 `↓↑` 箭头导航。点击结果项能执行。

## 改动

### 1. 加 paletteIndex 变量
```javascript
let paletteIndex = -1;
```
放在文件顶部 let 声明区。

### 2. 搜索结果渲染后重置索引
在 `renderCommandResults()` 最后加：
```javascript
paletteIndex = -1;
```

### 3. 键盘导航
给 `commandPaletteSearch` 加 keydown 监听：

```javascript
commandPaletteSearch.addEventListener('keydown', (e) => {
  const items = commandPaletteResults.querySelectorAll('.palette-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    paletteIndex = Math.min(paletteIndex + 1, items.length - 1);
    updatePaletteHighlight(items);
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    paletteIndex = Math.max(paletteIndex - 1, 0);
    updatePaletteHighlight(items);
  }
  if (e.key === 'Enter' && paletteIndex >= 0) {
    e.preventDefault();
    items[paletteIndex]?.click();
  }
});
```

### 4. 高亮函数
```javascript
function updatePaletteHighlight(items) {
  items.forEach((item, i) => {
    item.style.background = i === paletteIndex ? 'var(--bg-surface-2, #28282c)' : '';
    if (i === paletteIndex) item.scrollIntoView?.({ block: 'nearest' });
  });
}
```

## 验证
- `⌘K` 打开面板
- 输入搜索文字后，`↓↑` 切换高亮
- `Enter` 执行高亮项
- `Escape` 关闭面板
