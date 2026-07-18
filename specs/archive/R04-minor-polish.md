# R04: 小修小补

## 改什么
只改 `public/js/app.js`

## 1. 命令列表空状态

`loadSnippets()` 加载完数据后，如果 `snippets` 为空数组，显示空状态提示：

在 `renderCommands(list)` 开头加：
```javascript
if (!list || list.length === 0) {
  commandsList.innerHTML = '<div class="panel-empty">暂无收藏命令<br/>在终端输入命令后按 ⌘⇧S 收藏</div>';
  return;
}
```

CSS 在 `index.html` `<style>` 块追加：
```css
.panel-empty {
  padding: 32px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary, #8a8f98);
  line-height: 1.8;
}
```

## 验证
- 删除 `sterm-data/snippets.json`（临时）→ 面板显示空状态文字
- 恢复文件 → 命令列表正常显示
