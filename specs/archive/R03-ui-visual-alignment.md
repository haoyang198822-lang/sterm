# R03: UI 视觉对齐（Phase 6）

## 改什么
- `public/index.html` — `<style>` 块微调 CSS
- `public/js/app.js` — 微调

## 参考
`specs/reference/design-mockup.html`

## 检查清单

### Header 标签栏
- [ ] tab dot 指示器（绿色圆点）尺寸和颜色是否与 mockup 一致
- [ ] active tab 下划线（2px, brand color）位置和高度
- [ ] close button hover 时可见（当前 opacity 0→1 过渡）
- [ ] 标签之间的间距

### 状态栏
- [ ] 连接 dot（green/red）尺寸
- [ ] shell 名称字体和颜色
- [ ] 分隔线样式
- [ ] 右侧快捷按钮对齐

### 侧边面板
- [ ] 背景色 `#0f1011`
- [ ] tab 文字是否带 icon（▸/□/◇）及对齐
- [ ] 分组标题大写 + letter-spacing

### 命令列表
- [ ] 标签色值：文字 `#7170ff`，背景 `rgba(113,112,255,0.1)`
- [ ] 快捷键右对齐
- [ ] 卡片 hover 效果

### 速查卡片
- [ ] 卡片 border hover 变化
- [ ] 代码块背景色 `#08090a`

### 设置面板
- [ ] 分隔线样式
- [ ] toggle switch 开启态颜色

### ⌘K 面板
- [ ] 阴影堆叠（多层 box-shadow）
- [ ] 圆角 12px

## 做法
1. 浏览器打开 `design-mockup.html` 和实际页面
2. 逐项肉眼对比，调整 CSS 变量值或样式
3. 不需要动结构，只微调视觉效果
