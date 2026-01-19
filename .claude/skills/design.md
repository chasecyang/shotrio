# Design System — "The Darkroom"

当用户调用 `/design` 时，严格遵循以下设计系统来编写 UI 代码。

---

## Design Philosophy

**"The Darkroom"** draws from analog film photography, vintage cinema, and the tactile warmth of physical media. It balances professional craftsmanship with nostalgic warmth — like a high-end editing suite that still feels human.

**Core Principles:**

- **Warmth Over Sterility**: Colors carry subtle sepia undertones. Even "neutral" grays have warmth. We reject cold, clinical digital aesthetics.
- **Depth Through Layering**: Surfaces stack like physical prints. Cards lift off backgrounds with soft glows (dark mode) or subtle shadows (light mode). Use micro-gradients to simulate real-world lighting.
- **Restrained Motion**: Animations are smooth and purposeful, like the satisfying click of a film reel. Never gratuitous. Use film-themed effects (shutter, exposure) for brand reinforcement.
- **Dual Personality**: Light mode = vintage paper & ink. Dark mode = professional darkroom with orange safelight accents.
- **Typography as Hierarchy**: Bold weights create clear visual hierarchy. Text is always readable, never decorative.
- **Premium in the Details**: High-end design reveals itself in edges, textures, and micro-interactions. Subtle grain, edge highlights, and thoughtful empty states separate good from great.

**Emotional Intent:** "We take your creative work seriously, but we're not cold or intimidating. This is a craftsman's tool, not a corporate spreadsheet."

---

## Design Tokens

### Colors (OKLCH)

我们使用 OKLCH 颜色空间，它提供感知均匀的亮度控制。

#### Light Mode — "Vintage Paper & Ink"

```css
:root {
  --background: oklch(0.97 0.01 85);      /* 温暖的纸张白 */
  --foreground: oklch(0.20 0.03 60);      /* 复古墨水黑 */
  --surface: oklch(0.98 0.005 85);        /* 表面层 */
  --card: oklch(0.985 0.005 85);          /* 卡片层 */
  --primary: oklch(0.55 0.18 40);         /* Burnt Sienna 主色 */
  --primary-foreground: oklch(0.97 0.01 85);
  --secondary: oklch(0.94 0.02 85);
  --border: oklch(0.90 0.02 85);
  --muted-foreground: oklch(0.50 0.03 60);
}
```

#### Dark Mode — "The Darkroom"

深色模式采用**分层系统**，每个层级之间保持 5-6% Lab 亮度差异，确保视觉区分度：

```
Layer 0: sidebar (最深) ──────────────  lab(7%)   oklch(0.20)
Layer 1: background (主背景) ─────────  lab(13%)  oklch(0.25)
Layer 2: surface (内容面板) ──────────  lab(19%)  oklch(0.30)
Layer 3: card (卡片/悬浮元素) ────────  lab(26%)  oklch(0.36)
```

```css
.dark {
  /* 分层背景系统 */
  --sidebar: oklch(0.20 0.005 60);        /* Layer 0: Header/侧边栏 - 最深锚点 */
  --background: oklch(0.25 0.006 60);     /* Layer 1: 主背景 */
  --surface: oklch(0.30 0.008 60);        /* Layer 2: 内容面板 */
  --card: oklch(0.36 0.012 60);           /* Layer 3: 卡片/弹窗 */

  /* 文字 */
  --foreground: oklch(0.92 0.02 85);      /* 奶油白主文字 */
  --muted-foreground: oklch(0.65 0.03 85);/* 暖灰次要文字 */

  /* 主色：Kodak Gold 橙 */
  --primary: oklch(0.60 0.16 40);
  --primary-foreground: oklch(0.15 0.01 60);

  /* 交互状态 */
  --secondary: oklch(0.32 0.010 60);      /* hover 背景 */
  --muted: oklch(0.32 0.010 60);
  --accent: oklch(0.32 0.010 60);

  /* 边框 */
  --border: oklch(0.40 0.012 60);
  --input: oklch(0.35 0.010 60);

  /* Premium 效果 */
  --safelight-glow: 0 0 30px -5px oklch(0.60 0.16 40 / 0.25);
  --card-shadow: 0 8px 32px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.03);
}
```

#### 颜色分层使用指南

| 层级 | 变量 | 用途 | Tailwind 类 |
|------|------|------|-------------|
| Layer 0 | `--sidebar` | Header、侧边栏 | `bg-sidebar`, `dark:bg-sidebar` |
| Layer 1 | `--background` | 页面整体背景 | `bg-background` |
| Layer 2 | `--surface` | 内容面板、主要容器 | `bg-surface`, `dark:bg-surface` |
| Layer 3 | `--card` | 卡片、弹窗、悬浮组件 | `bg-card` |

**示例：编辑器布局**

```tsx
// 整体背景
<div className="bg-background">
  {/* Header - 使用最深层 */}
  <header className="bg-background dark:bg-sidebar">

  {/* 内容面板 - 使用 surface 层 */}
  <div className="bg-background dark:bg-surface rounded-2xl border">

    {/* 卡片元素 - 使用 card 层 */}
    <div className="bg-card rounded-lg">
```

### Typography

```ts
fontFamily: {
  display: ['DM Serif Display', 'Georgia', 'serif'],  // Hero titles
  sans: ['Manrope', 'Noto Sans SC', 'system-ui'],     // UI text
  mono: ['JetBrains Mono', 'Menlo', 'monospace'],     // Timecodes
}
```

| Element | Classes | Weight |
|---------|---------|--------|
| H1 | `text-3xl md:text-4xl` | 700 |
| H2 | `text-2xl md:text-3xl` | 700 |
| H3 | `text-xl` | 600 |
| Body | `text-base` | 400 |
| Caption | `text-xs` | 500 |

### Spacing & Radius

- **Spacing**: 基于 4px 网格 (`p-4` = 16px, `p-6` = 24px)
- **Radius**: `rounded-md` (6px) → `rounded-lg` (8px) → `rounded-xl` (12px) → `rounded-2xl` (16px)

---

## Component Patterns

### Button

```tsx
// Primary
<button className="h-10 px-5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold
  transition-all hover:bg-primary/90 active:scale-[0.98]
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
  disabled:opacity-50 disabled:pointer-events-none">
  Button
</button>

// Secondary: bg-secondary text-secondary-foreground border border-border
// Ghost: bg-transparent hover:bg-secondary
// Destructive: bg-destructive text-white
```

### Card

```tsx
// Base
<div className="bg-card border border-border rounded-xl p-6 shadow-sm
  dark:shadow-none dark:ring-1 dark:ring-white/5">
  {children}
</div>

// Interactive (hover 效果)
<div className="group bg-[image:var(--card-gradient)] border border-border rounded-xl p-6
  transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer
  dark:hover:shadow-[var(--safelight-glow)]">
  {children}
</div>
```

### Input

```tsx
<input className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm
  placeholder:text-muted-foreground transition-colors
  hover:border-border/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
  disabled:opacity-50" />
```

### Badge

```tsx
<span className="inline-flex items-center h-6 px-2.5 bg-secondary text-secondary-foreground
  border border-border rounded-full text-xs font-medium">
  Badge
</span>
```

---

## Premium Effects

### Safelight Glow (Dark Mode 选中/激活状态)

```tsx
className="dark:shadow-[0_0_30px_-5px_oklch(0.65_0.18_45_/_0.25)]"
```

### Selected Indicator

```tsx
className="border-l-2 border-primary bg-gradient-to-r from-primary/10 to-transparent"
```

### Film Grain (可选，用于背景)

```css
.grain::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
}
```

---

## Animations

### 常用动画

```css
/* 入场 */
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Film-themed */
@keyframes exposure { from { filter: brightness(0.3); } to { filter: brightness(1); } }
@keyframes shutter { 0%, 100% { clip-path: inset(0 50% 0 50%); } 50% { clip-path: inset(0); } }
```

### Framer Motion

```tsx
// 入场
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.2 }}

// 列表 stagger
staggerChildren: 0.05
```

---

## Checklist

编写组件时检查：

- [ ] 使用语义化 token (`bg-card`, `text-foreground`)
- [ ] 正确的圆角 (`rounded-lg`, `rounded-xl`)
- [ ] 有 hover/focus/disabled 状态
- [ ] Focus 使用 `focus-visible:ring-2`
- [ ] Touch target ≥ 44px
- [ ] 响应式 (`md:`, `lg:`)

---

## 执行步骤

1. **理解需求**：明确要创建什么
2. **查找现有组件**：检查 `src/components/ui/`
3. **按规范编写**：遵循上述 token 和模式
4. **自检**：对照 Checklist
5. **删除冗余代码**
