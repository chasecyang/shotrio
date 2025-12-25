# Beta 标识实现文档

## 概述

为了更好地管理用户期望，ShotRio 已在多个关键页面和组件中添加了 Beta 标识，提醒用户产品处于测试阶段。

## 已实现的组件

### 1. BetaBadge 组件

**路径**: `src/components/ui/beta-badge.tsx`

**功能**: 可复用的 Beta 徽章组件

**变体**:
- `default`: 明显的主题色徽章（主色调边框和背景）
- `subtle`: 柔和的灰色徽章
- `minimal`: 最小化的透明徽章

**使用示例**:
```tsx
import { BetaBadge } from "@/components/ui/beta-badge";

// Client component
<BetaBadge variant="default" />

// Server component
import { BetaBadgeServer } from "@/components/ui/beta-badge";
<BetaBadgeServer variant="subtle" />
```

### 2. BetaBanner 组件

**路径**: `src/components/ui/beta-banner.tsx`

**功能**: 可关闭的顶部横幅提示

**特性**:
- 支持用户关闭
- 使用 localStorage 记住关闭状态
- 可配置存储 key 以在不同页面独立控制
- 带动画效果

**使用示例**:
```tsx
import { BetaBanner } from "@/components/ui/beta-banner";

<BetaBanner 
  dismissible={true}
  storageKey="home-beta-banner-dismissed"
/>
```

## 已添加 Beta 标识的位置

### 1. 全站 Header（导航栏）

**文件**: `src/components/layout/header.tsx`

**位置**: Logo 旁边

**样式**: `subtle` 变体，半透明显示

```tsx
<BetaBadgeServer variant="subtle" className="translate-y-[-2px]" />
```

### 2. 全站 Footer（页脚）

**文件**: `src/components/layout/footer.tsx`

**位置**: 版权信息上方

**样式**: 带图标的文字说明

```tsx
<AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-primary/60" />
<p className="text-center leading-relaxed">
  {t('beta.description')}
</p>
```

### 3. 首页

**文件**: `src/app/[lang]/page.tsx`

**位置**: Header 下方顶部

**样式**: 可关闭的横幅

```tsx
<BetaBanner dismissible storageKey="home-beta-banner-dismissed" />
```

### 4. 项目编辑器

**文件**: 
- `src/components/projects/editor/editor-header.tsx` - Logo 旁边的徽章
- `src/components/projects/editor/editor-layout.tsx` - 顶部横幅

**位置**:
- Header Logo 旁 - `minimal` 变体
- Editor Header 下方 - 可关闭横幅

```tsx
// Header 中
<BetaBadge variant="minimal" />

// Layout 中
<BetaBanner dismissible storageKey="editor-beta-banner-dismissed" />
```

### 5. 登录页面

**文件**: `src/app/[lang]/login/page.tsx`

**位置**: Logo 旁边

**样式**: `default` 变体，显眼提示

```tsx
<BetaBadge variant="default" className="translate-y-[-4px]" />
```

## 国际化配置

### 中文（messages/zh.json）

```json
"beta": {
  "label": "BETA",
  "title": "测试版本",
  "description": "ShotRio 目前处于测试阶段，部分功能可能不稳定或发生变化。感谢您的理解与支持！"
}
```

### 英文（messages/en.json）

```json
"beta": {
  "label": "BETA",
  "title": "Beta Version",
  "description": "ShotRio is currently in beta. Some features may be unstable or subject to change. Thank you for your understanding and support!"
}
```

## 设计考虑

### 视觉层级
1. **高优先级**: 登录页、首页横幅 - 使用 `default` 变体或横幅
2. **中优先级**: Header Logo 旁 - 使用 `subtle` 变体
3. **低优先级**: 编辑器内 - 使用 `minimal` 变体

### 用户体验
- **可关闭设计**: 横幅可以关闭，避免重复打扰
- **独立存储**: 不同页面的横幅使用不同的 localStorage key
- **动画效果**: 使用 `animate-in` 增加流畅度
- **不干扰操作**: 最小化视觉侵入，不遮挡主要功能

### 颜色方案
- 使用项目主色调（burnt sienna / vintage orange）
- 保持与整体设计风格一致
- 支持亮色和暗色模式

## 未来扩展

如果需要在其他页面添加 Beta 标识：

### 添加徽章
```tsx
import { BetaBadge } from "@/components/ui/beta-badge";

// 在 client component 中
<BetaBadge variant="subtle" />

// 在 server component 中
import { BetaBadgeServer } from "@/components/ui/beta-badge";
<BetaBadgeServer variant="subtle" />
```

### 添加横幅
```tsx
import { BetaBanner } from "@/components/ui/beta-banner";

<BetaBanner 
  dismissible={true}
  storageKey="unique-page-key-dismissed"
/>
```

## 移除 Beta 标识的步骤

当产品正式发布时，按以下步骤移除：

1. 搜索所有 `BetaBadge` 和 `BetaBanner` 引用
2. 删除相关导入和使用
3. 可选：保留国际化配置（用于未来功能的 beta 标记）
4. 可选：保留组件文件（用于未来新功能的 beta 标记）

## 技术细节

### 依赖
- `lucide-react`: 图标库
- `next-intl`: 国际化
- `tailwindcss`: 样式系统
- `shadcn/ui`: Badge 基础组件

### 浏览器兼容性
- localStorage: 所有现代浏览器
- CSS animations: 所有现代浏览器
- 降级方案: 如果 localStorage 不可用，横幅始终显示

## 维护建议

1. **定期评估**: 每个版本评估 Beta 标识的展示位置和频率
2. **用户反馈**: 收集用户对 Beta 提示的反馈
3. **A/B 测试**: 可以测试不同的提示方式对用户行为的影响
4. **数据追踪**: 考虑添加分析追踪关闭率和用户反应

