# Timeline 配色主题更新

## 概述

将编辑器页面底部 Timeline 区域的配色从硬编码的暗黑配色改为使用 CSS 变量的主题系统，使其与应用其他部分保持一致。

## 更改的文件

### 1. production-timeline.tsx
- **改动**: 主容器背景从 `bg-[#0a0a0b] text-white` 改为 `bg-background text-foreground`
- **效果**: 使用全局主题变量

### 2. timeline-header.tsx
- **改动**:
  - 容器: `border-[#1f1f23] bg-[#0a0a0b]` → `border-border bg-card`
  - 文本: `text-gray-400` → `text-muted-foreground`
  - Select 组件: 移除硬编码的暗色样式，使用默认主题样式
  - Button: 移除自定义的渐变背景和暗色边框，使用默认主题样式
- **效果**: 所有组件使用主题变量，自动适配亮/暗模式

### 3. shot-list-panel.tsx
- **改动**:
  - 容器: `border-[#1f1f23] bg-[#0a0a0b]` → `border-border bg-background`
  - 文本: `text-gray-400/500/600` → `text-muted-foreground`
  - 卡片: `border-[#2a2a2e] bg-[#151518]` → `border-border bg-card`
  - 选中态: `border-[#3b82f6] bg-[#1a1d2e]` → `border-primary bg-primary/10`
  - 缩略图背景: `bg-[#0a0a0b]` → `bg-muted`
  - Checkbox: 使用默认样式而不是自定义颜色
- **效果**: 分镜列表面板完全适配主题

### 4. timeline-tracks.tsx
- **改动**:
  - 容器: `border-[#1f1f23] bg-[#0a0a0b]` → `border-border bg-background`
  - 文本: `text-gray-400/500` → `text-muted-foreground`
  - 时间刻度: `bg-[#0d0d0f]` → `bg-muted/30`
  - 刻度线: `bg-gray-600` → `bg-border`
  - 播放头: `bg-gradient-to-b from-[#3b82f6] to-[#8b5cf6]` → `bg-primary`
  - 播放头点: `bg-[#3b82f6] border-white` → `bg-primary border-background`
  - Button: 移除自定义样式，使用默认主题
- **效果**: 时间轴轨道完全适配主题

### 5. video-track.tsx
- **改动**:
  - 容器: `border-[#1f1f23] bg-[#0a0a0b]` → `border-border bg-background`
  - 轨道标签: `border-[#1f1f23] bg-[#0d0d0f]` → `border-border bg-muted/30`
  - 文本: `text-gray-400` → `text-muted-foreground`
  - 片段边框: `border-[#2a2a2e]` → `border-border`
  - 选中态: `border-[#3b82f6]` → `border-primary`
  - 无素材背景: `bg-[#1f1f23]` → `bg-muted`
  - 文本: `text-white` → `text-foreground`
  - Hover效果: `bg-gradient-to-t from-black/20` → `bg-primary/5`
- **效果**: 视频轨道适配主题，保留状态颜色（绿色/橙色）

### 6. audio-track.tsx
- **改动**:
  - 容器: `border-[#1f1f23] bg-[#0a0a0b]` → `border-border bg-background`
  - 轨道标签: `border-[#1f1f23] bg-[#0d0d0f]` → `border-border bg-muted/30`
  - 文本: `text-gray-400` → `text-muted-foreground`
  - 片段边框: `border-[#2a2a2e]` → `border-border`
- **效果**: 音频轨道适配主题，保留紫色音频波形效果

### 7. subtitle-track.tsx
- **改动**:
  - 容器: `border-[#1f1f23] bg-[#0a0a0b]` → `border-border bg-background`
  - 轨道标签: `border-[#1f1f23] bg-[#0d0d0f]` → `border-border bg-muted/30`
  - 文本: `text-gray-400` → `text-muted-foreground`
  - 片段边框: `border-[#2a2a2e]` → `border-border`
  - 字幕文本: `text-white/70` → `text-foreground/70`
- **效果**: 字幕轨道适配主题，保留粉色字幕背景效果

### 8. video-preview-panel.tsx
- **改动**:
  - 容器: `bg-[#0a0a0b]` → `bg-background`
  - 无图片占位: `border-[#2a2a2e]` → `border-border`
  - 文本: `text-gray-400/600` → `text-muted-foreground`
  - 信息叠加: `bg-black/70` → `bg-background/80 border border-border`
  - 文本: `text-white/gray-300` → `text-foreground/foreground/80`
  - 控制栏: `border-[#1f1f23] bg-[#0a0a0b]` → `border-border bg-card`
  - Button: 移除自定义样式，使用默认主题
- **效果**: 视频预览面板完全适配主题

## 配色系统

### 亮色模式（Light Mode）
当前使用的是"Vintage Paper & Ink"主题：
- 背景: 温暖的纸白色 (Warm Paper White)
- 前景: 柔和的墨黑色 (Soft Ink Black)
- 主色: 复古橙红色 (Burnt Sienna)
- 边框/输入: 温暖的灰色

### 暗色模式（Dark Mode）
预留给未来的暗夜模式，配色为"The Darkroom"主题：
- 背景: 深浓缩咖啡色 (Deep Espresso)
- 前景: 奶油白色 (Cream/Off-White)
- 主色: 日落橙色 (Sunset Orange)
- 边框/输入: 温暖的深灰色

## 保留的特殊颜色

为了保持功能性和视觉识别度，以下颜色**保留硬编码**：

1. **状态颜色**:
   - 绿色 `text-[#10b981]`: 视频已生成
   - 橙色 `text-[#f59e0b]`: 图片待生成视频
   - 这些颜色跨越主题保持一致，便于用户快速识别状态

2. **功能性渐变**:
   - 视频轨道: 绿色渐变表示已完成，橙色渐变表示待处理
   - 音频轨道: 紫色系渐变
   - 字幕轨道: 粉色系渐变
   - 这些渐变帮助用户在时间轴上区分不同类型的素材

## 实现效果

1. **统一性**: Timeline 现在与应用其他部分使用相同的配色系统
2. **可维护性**: 不再有硬编码的颜色值，易于维护和更新
3. **扩展性**: 为未来的暗夜模式支持做好准备
4. **一致性**: 按钮、输入框、卡片等组件都使用统一的主题样式

## 测试建议

1. 检查 Timeline 各个组件在亮色模式下的显示效果
2. 验证颜色对比度是否足够，文本是否清晰可读
3. 确认选中状态、hover 状态的视觉反馈是否明显
4. 测试不同状态的分镜在时间轴上的显示（无图片、有图片、有视频）
5. 验证所有交互元素（按钮、选择器、滑块等）的视觉效果

## 后续工作

1. 未来添加暗夜模式切换功能
2. 考虑是否需要为 Timeline 添加专门的配色变量
3. 优化移动端的显示效果

