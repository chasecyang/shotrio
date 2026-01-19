# Design System Skill — "The Darkroom"

当用户调用 `/design` 时，严格遵循以下设计系统来编写 UI 代码。

---

## Design Philosophy

**"The Darkroom"** draws from analog film photography, vintage cinema, and the tactile warmth of physical media. It balances professional craftsmanship with nostalgic warmth — like a high-end editing suite that still feels human.

**Core Principles:**

- **Warmth Over Sterility**: Colors carry subtle sepia undertones. Even "neutral" grays have warmth. We reject cold, clinical digital aesthetics.
- **Depth Through Layering**: Surfaces stack like physical prints. Cards lift off backgrounds with soft glows (dark mode) or subtle shadows (light mode).
- **Restrained Motion**: Animations are smooth and purposeful, like the satisfying click of a film reel. Never gratuitous.
- **Dual Personality**: Light mode = vintage paper & ink. Dark mode = professional darkroom with orange safelight accents.
- **Typography as Hierarchy**: Bold weights create clear visual hierarchy. Text is always readable, never decorative.

**Emotional Intent:** "We take your creative work seriously, but we're not cold or intimidating. This is a craftsman's tool, not a corporate spreadsheet."

---

## Design Token System

### Colors (OKLCH Color Space)

We use OKLCH for perceptually uniform colors. All colors maintain consistent visual weight across the spectrum.

#### Light Mode — "Vintage Paper"

| Token | OKLCH | Hex Approx | Usage |
|-------|-------|------------|-------|
| Background | `oklch(0.97 0.01 85)` | `#FAF9F7` | Page background, warm paper |
| Foreground | `oklch(0.20 0.03 60)` | `#2D2926` | Primary text, soft ink |
| Primary | `oklch(0.55 0.18 40)` | `#C45C26` | CTAs, links, accents (burnt sienna) |
| Primary Hover | `oklch(0.50 0.18 40)` | `#A84E20` | Primary hover state |
| Primary Foreground | `oklch(0.97 0.01 85)` | `#FAF9F7` | Text on primary |
| Secondary | `oklch(0.94 0.02 85)` | `#EBE8E4` | Secondary backgrounds |
| Secondary Foreground | `oklch(0.30 0.02 60)` | `#3D3835` | Text on secondary |
| Muted | `oklch(0.94 0.02 85)` | `#EBE8E4` | Disabled, placeholder |
| Muted Foreground | `oklch(0.55 0.02 60)` | `#8A8380` | Muted text |
| Card | `oklch(0.985 0.005 85)` | `#FDFCFB` | Card surfaces |
| Border | `oklch(0.88 0.02 85)` | `#DDD9D4` | All borders |
| Ring | `oklch(0.55 0.18 40)` | `#C45C26` | Focus rings |
| Destructive | `oklch(0.55 0.20 25)` | `#C43D3D` | Errors, danger |

#### Dark Mode — "The Darkroom"

| Token | OKLCH | Hex Approx | Usage |
|-------|-------|------------|-------|
| Background | `oklch(0.10 0.005 60)` | `#171615` | Deep charcoal |
| Foreground | `oklch(0.92 0.02 85)` | `#EDE9E4` | Cream text |
| Primary | `oklch(0.65 0.18 45)` | `#E8864A` | Vibrant film orange (Kodak Gold) |
| Primary Hover | `oklch(0.70 0.18 45)` | `#F0965C` | Brighter on hover |
| Primary Foreground | `oklch(0.12 0.01 60)` | `#1E1C1B` | Dark text on primary |
| Secondary | `oklch(0.18 0.01 60)` | `#2A2725` | Elevated surfaces |
| Secondary Foreground | `oklch(0.85 0.02 85)` | `#D9D4CE` | Text on secondary |
| Muted | `oklch(0.18 0.01 60)` | `#2A2725` | Disabled backgrounds |
| Muted Foreground | `oklch(0.55 0.02 60)` | `#8A8380` | Muted text |
| Card | `oklch(0.14 0.008 60)` | `#222120` | Card surfaces |
| Border | `oklch(0.28 0.015 60)` | `#3F3B38` | Subtle borders |
| Ring | `oklch(0.65 0.18 45)` | `#E8864A` | Focus rings |
| Destructive | `oklch(0.50 0.18 25)` | `#B33A3A` | Subdued red |

#### Semantic Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Success | `oklch(0.55 0.15 145)` | `oklch(0.60 0.15 145)` | Success states |
| Warning | `oklch(0.70 0.15 85)` | `oklch(0.65 0.15 85)` | Warnings |
| Info | `oklch(0.55 0.12 240)` | `oklch(0.60 0.12 240)` | Information |

#### Special Effects

| Effect | Light | Dark | Usage |
|--------|-------|------|-------|
| Card Glow | — | `0 0 0 1px oklch(0.35 0.015 60 / 0.6)` | Subtle edge definition |
| Hover Glow | — | `0 0 20px oklch(0.65 0.18 45 / 0.15)` | Interactive feedback |
| Timeline Cool | `oklch(0.60 0.15 240 / 0.3)` | `oklch(0.65 0.18 240 / 0.4)` | Timeline borders |
| Narrative Warm | `oklch(0.65 0.18 50 / 0.3)` | `oklch(0.60 0.16 40 / 0.4)` | Narrative elements |

**CSS Variables Setup:**
```css
:root {
  --background: oklch(0.97 0.01 85);
  --foreground: oklch(0.20 0.03 60);
  --primary: oklch(0.55 0.18 40);
  --primary-foreground: oklch(0.97 0.01 85);
  --secondary: oklch(0.94 0.02 85);
  --card: oklch(0.985 0.005 85);
  --border: oklch(0.88 0.02 85);
  --ring: oklch(0.55 0.18 40);
  --radius: 0.5rem;
}

.dark {
  --background: oklch(0.10 0.005 60);
  --foreground: oklch(0.92 0.02 85);
  --primary: oklch(0.65 0.18 45);
  --primary-foreground: oklch(0.12 0.01 60);
  --secondary: oklch(0.18 0.01 60);
  --card: oklch(0.14 0.008 60);
  --border: oklch(0.28 0.015 60);
}
```

---

### Typography

**Font Stack:**
```ts
fontFamily: {
  sans: ['Manrope', 'Noto Sans SC', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Menlo', 'monospace'],
}
```

- **Manrope**: Geometric sans-serif with excellent readability. Modern but warm.
- **Noto Sans SC**: Chinese support that harmonizes with Manrope.
- **JetBrains Mono**: Code, timecodes, technical values.

**Type Scale:**

| Element | Classes | Weight | Tracking |
|---------|---------|--------|----------|
| Display | `text-5xl md:text-6xl lg:text-7xl` | 800 | `-0.04em` |
| H1 | `text-3xl md:text-4xl lg:text-5xl` | 700 | `-0.03em` |
| H2 | `text-2xl md:text-3xl` | 700 | `-0.02em` |
| H3 | `text-xl md:text-2xl` | 600 | `-0.01em` |
| H4 | `text-lg` | 600 | `0` |
| Body Large | `text-lg` | 400 | `0` |
| Body | `text-base` | 400 | `0` |
| Body Small | `text-sm` | 400 | `0` |
| Caption | `text-xs` | 500 | `0.02em` |
| Overline | `text-xs uppercase` | 600 | `0.08em` |

**Typography Rules:**
- Headings: Always use negative letter-spacing for tighter, more confident appearance
- Body: Standard spacing for readability
- Captions/Labels: Slightly wider spacing for small text legibility
- Line height: `leading-tight` (1.25) for headings, `leading-relaxed` (1.625) for body

---

### Spacing System

Based on 4px grid with semantic names:

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `space-0` | 0 | `0` | None |
| `space-1` | 4px | `1` | Minimal gaps |
| `space-2` | 8px | `2` | Tight spacing |
| `space-3` | 12px | `3` | Compact |
| `space-4` | 16px | `4` | Default gap |
| `space-5` | 20px | `5` | Medium |
| `space-6` | 24px | `6` | Comfortable |
| `space-8` | 32px | `8` | Sections |
| `space-10` | 40px | `10` | Large sections |
| `space-12` | 48px | `12` | Page sections |
| `space-16` | 64px | `16` | Major breaks |

**Spacing Guidelines:**
- Card padding: `p-4` (compact) / `p-6` (standard) / `p-8` (spacious)
- Stack spacing: `space-y-4` (tight) / `space-y-6` (standard)
- Grid gaps: `gap-4` (tight) / `gap-6` (standard) / `gap-8` (loose)

---

### Border Radius

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `radius-sm` | 4px | `rounded-sm` | Checkboxes, small tags |
| `radius-md` | 6px | `rounded-md` | Inputs, small buttons |
| `radius-lg` | 8px | `rounded-lg` | Standard buttons, badges |
| `radius-xl` | 12px | `rounded-xl` | Cards, panels |
| `radius-2xl` | 16px | `rounded-2xl` | Modals, large cards |
| `radius-full` | 9999px | `rounded-full` | Pills, avatars |

**Border Rules:**
- Default border: `border border-border` (1px)
- Emphasized border: `border-2 border-border`
- Dividers: `border-b border-border`
- Focus ring: `ring-2 ring-ring ring-offset-2` (never outline)

---

### Shadows & Effects

**Shadow Scale:**
```css
/* Light mode shadows */
--shadow-sm: 0 1px 2px oklch(0 0 0 / 0.05);
--shadow-md: 0 2px 4px oklch(0 0 0 / 0.06), 0 1px 2px oklch(0 0 0 / 0.04);
--shadow-lg: 0 4px 12px oklch(0 0 0 / 0.08), 0 2px 4px oklch(0 0 0 / 0.04);
--shadow-xl: 0 8px 24px oklch(0 0 0 / 0.12), 0 4px 8px oklch(0 0 0 / 0.06);

/* Dark mode - use glows instead */
--glow-sm: 0 0 0 1px oklch(1 0 0 / 0.05);
--glow-md: 0 0 0 1px oklch(1 0 0 / 0.05), 0 2px 8px oklch(0 0 0 / 0.4);
--glow-lg: 0 0 0 1px oklch(1 0 0 / 0.06), 0 4px 16px oklch(0 0 0 / 0.5);
```

**Elevation Layers:**
| Layer | Light Shadow | Dark Glow | Usage |
|-------|--------------|-----------|-------|
| Base | None | None | Page background |
| Raised | `shadow-sm` | `glow-sm` | Cards, panels |
| Floating | `shadow-md` | `glow-md` | Dropdowns, popovers |
| Overlay | `shadow-lg` | `glow-lg` | Modals, dialogs |
| Top | `shadow-xl` | Custom | Toasts, notifications |

---

## Component Patterns

### Buttons

**Primary Button:**
```tsx
<button className="
  inline-flex items-center justify-center gap-2
  h-10 px-5
  bg-primary text-primary-foreground
  rounded-lg
  text-sm font-semibold
  shadow-sm
  transition-all duration-150
  hover:bg-primary/90 hover:shadow-md
  active:scale-[0.98]
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
  disabled:pointer-events-none disabled:opacity-50
">
  <span>Button Text</span>
</button>
```

**Secondary Button:**
```tsx
<button className="
  inline-flex items-center justify-center gap-2
  h-10 px-5
  bg-secondary text-secondary-foreground
  border border-border
  rounded-lg
  text-sm font-semibold
  transition-all duration-150
  hover:bg-secondary/80 hover:border-border/80
  active:scale-[0.98]
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
">
  <span>Secondary</span>
</button>
```

**Ghost Button:**
```tsx
<button className="
  inline-flex items-center justify-center gap-2
  h-10 px-5
  text-foreground
  rounded-lg
  text-sm font-semibold
  transition-colors duration-150
  hover:bg-secondary
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
">
  <span>Ghost</span>
</button>
```

**Destructive Button:**
```tsx
<button className="
  inline-flex items-center justify-center gap-2
  h-10 px-5
  bg-destructive text-white
  rounded-lg
  text-sm font-semibold
  shadow-sm
  transition-all duration-150
  hover:bg-destructive/90
  active:scale-[0.98]
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2
">
  <span>Delete</span>
</button>
```

**Button Sizes:**
| Size | Height | Padding | Text | Icon Size |
|------|--------|---------|------|-----------|
| `sm` | `h-8` | `px-3` | `text-xs` | `size-3.5` |
| `md` | `h-10` | `px-5` | `text-sm` | `size-4` |
| `lg` | `h-12` | `px-6` | `text-base` | `size-5` |
| `icon-sm` | `size-8` | — | — | `size-4` |
| `icon-md` | `size-10` | — | — | `size-5` |

---

### Cards

**Base Card:**
```tsx
<div className="
  bg-card text-card-foreground
  border border-border
  rounded-xl
  p-6
  shadow-sm
  dark:shadow-none dark:ring-1 dark:ring-white/5
">
  {/* Content */}
</div>
```

**Interactive Card:**
```tsx
<div className="
  bg-card text-card-foreground
  border border-border
  rounded-xl
  p-6
  shadow-sm
  transition-all duration-200
  hover:shadow-md hover:border-border/70
  hover:-translate-y-0.5
  cursor-pointer
  dark:hover:ring-1 dark:hover:ring-white/10
">
  {/* Content */}
</div>
```

**Card with Header:**
```tsx
<div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
  {/* Header */}
  <div className="px-6 py-4 border-b border-border bg-secondary/30">
    <h3 className="font-semibold">Card Title</h3>
    <p className="text-sm text-muted-foreground">Card description</p>
  </div>
  {/* Body */}
  <div className="p-6">
    {/* Content */}
  </div>
  {/* Footer (optional) */}
  <div className="px-6 py-4 border-t border-border bg-secondary/20">
    <div className="flex justify-end gap-3">
      <button>Cancel</button>
      <button>Save</button>
    </div>
  </div>
</div>
```

**Feature Card (Marketing):**
```tsx
<div className="
  group
  bg-card
  border border-border
  rounded-2xl
  p-8
  shadow-sm
  transition-all duration-300
  hover:shadow-lg hover:border-primary/30
  hover:-translate-y-1
">
  {/* Icon container */}
  <div className="
    w-12 h-12 mb-6
    bg-primary/10
    border border-primary/20
    rounded-xl
    flex items-center justify-center
    transition-colors duration-300
    group-hover:bg-primary/20
  ">
    <Icon className="size-6 text-primary" />
  </div>

  <h3 className="text-xl font-semibold mb-2">Feature Title</h3>
  <p className="text-muted-foreground leading-relaxed">
    Feature description that explains the value proposition clearly.
  </p>
</div>
```

---

### Badges & Tags

**Default Badge:**
```tsx
<span className="
  inline-flex items-center gap-1
  h-6 px-2.5
  bg-secondary text-secondary-foreground
  border border-border
  rounded-full
  text-xs font-medium
">
  Badge
</span>
```

**Primary Badge:**
```tsx
<span className="
  inline-flex items-center gap-1
  h-6 px-2.5
  bg-primary text-primary-foreground
  rounded-full
  text-xs font-medium
">
  New
</span>
```

**Outline Badge:**
```tsx
<span className="
  inline-flex items-center gap-1
  h-6 px-2.5
  bg-transparent text-foreground
  border border-border
  rounded-full
  text-xs font-medium
">
  Draft
</span>
```

**Status Badges:**
```tsx
{/* Success */}
<span className="inline-flex items-center gap-1.5 h-6 px-2.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-medium">
  <span className="size-1.5 rounded-full bg-current" />
  Active
</span>

{/* Warning */}
<span className="inline-flex items-center gap-1.5 h-6 px-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-xs font-medium">
  <span className="size-1.5 rounded-full bg-current" />
  Pending
</span>

{/* Error */}
<span className="inline-flex items-center gap-1.5 h-6 px-2.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full text-xs font-medium">
  <span className="size-1.5 rounded-full bg-current" />
  Failed
</span>
```

---

### Form Inputs

**Text Input:**
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium">Label</label>
  <input
    type="text"
    className="
      flex w-full
      h-10 px-3
      bg-background
      border border-border
      rounded-lg
      text-sm
      placeholder:text-muted-foreground
      transition-colors duration-150
      hover:border-border/70
      focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
      disabled:pointer-events-none disabled:opacity-50
      aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20
    "
    placeholder="Enter text..."
  />
  <p className="text-xs text-muted-foreground">Helper text goes here.</p>
</div>
```

**Textarea:**
```tsx
<textarea
  className="
    flex w-full min-h-[120px]
    px-3 py-2
    bg-background
    border border-border
    rounded-lg
    text-sm
    placeholder:text-muted-foreground
    resize-y
    transition-colors duration-150
    hover:border-border/70
    focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
  "
  placeholder="Enter description..."
/>
```

**Select:**
```tsx
<select className="
  flex w-full
  h-10 px-3
  bg-background
  border border-border
  rounded-lg
  text-sm font-medium
  transition-colors duration-150
  hover:border-border/70
  focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
  cursor-pointer
  appearance-none
  bg-[url('data:image/svg+xml,...')] bg-no-repeat bg-[right_0.75rem_center]
">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

**Checkbox:**
```tsx
<label className="flex items-center gap-3 cursor-pointer">
  <button
    role="checkbox"
    aria-checked="false"
    className="
      size-5
      border border-border
      rounded-md
      transition-all duration-150
      hover:border-primary/50
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
      data-[state=checked]:bg-primary data-[state=checked]:border-primary
      data-[state=checked]:text-primary-foreground
    "
  >
    <CheckIcon className="size-3.5 opacity-0 data-[state=checked]:opacity-100" />
  </button>
  <span className="text-sm">Checkbox label</span>
</label>
```

**Switch:**
```tsx
<button
  role="switch"
  aria-checked="false"
  className="
    relative inline-flex
    h-6 w-11
    shrink-0
    cursor-pointer
    rounded-full
    border-2 border-transparent
    bg-secondary
    transition-colors duration-200
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
    data-[state=checked]:bg-primary
    disabled:pointer-events-none disabled:opacity-50
  "
>
  <span className="
    pointer-events-none
    block size-5
    rounded-full
    bg-background
    shadow-sm
    ring-0
    transition-transform duration-200
    data-[state=checked]:translate-x-5
    data-[state=unchecked]:translate-x-0
  " />
</button>
```

---

### Dialogs & Modals

**Dialog Structure:**
```tsx
{/* Backdrop */}
<div className="
  fixed inset-0 z-50
  bg-black/60 backdrop-blur-sm
  animate-in fade-in-0 duration-200
" />

{/* Dialog */}
<div className="
  fixed left-1/2 top-1/2 z-50
  -translate-x-1/2 -translate-y-1/2
  w-full max-w-lg
  bg-background
  border border-border
  rounded-2xl
  shadow-xl
  animate-in fade-in-0 zoom-in-95 duration-200
">
  {/* Header */}
  <div className="px-6 py-5 border-b border-border">
    <h2 className="text-lg font-semibold">Dialog Title</h2>
    <p className="text-sm text-muted-foreground mt-1">
      Dialog description text.
    </p>
  </div>

  {/* Body */}
  <div className="px-6 py-5">
    {/* Content */}
  </div>

  {/* Footer */}
  <div className="px-6 py-4 border-t border-border bg-secondary/30 rounded-b-2xl">
    <div className="flex justify-end gap-3">
      <Button variant="ghost">Cancel</Button>
      <Button variant="primary">Confirm</Button>
    </div>
  </div>
</div>
```

**Close Button:**
```tsx
<button className="
  absolute right-4 top-4
  size-8
  rounded-md
  text-muted-foreground
  transition-colors duration-150
  hover:bg-secondary hover:text-foreground
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
">
  <XIcon className="size-4" />
</button>
```

---

### Tabs

**Tab Container:**
```tsx
{/* Tab List */}
<div className="
  inline-flex items-center
  h-10 p-1
  bg-secondary
  rounded-lg
">
  {/* Tab Trigger */}
  <button className="
    inline-flex items-center justify-center
    h-8 px-4
    rounded-md
    text-sm font-medium
    text-muted-foreground
    transition-all duration-150
    hover:text-foreground
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
    data-[state=active]:bg-background
    data-[state=active]:text-foreground
    data-[state=active]:shadow-sm
  ">
    Tab 1
  </button>
</div>

{/* Tab Content */}
<div className="mt-4">
  {/* Content for active tab */}
</div>
```

**Underline Tabs (Alternative):**
```tsx
<div className="border-b border-border">
  <div className="flex gap-6">
    <button className="
      relative
      pb-3
      text-sm font-medium
      text-muted-foreground
      transition-colors duration-150
      hover:text-foreground
      data-[state=active]:text-foreground
      data-[state=active]:after:absolute
      data-[state=active]:after:bottom-0
      data-[state=active]:after:left-0
      data-[state=active]:after:right-0
      data-[state=active]:after:h-0.5
      data-[state=active]:after:bg-primary
      data-[state=active]:after:rounded-full
    ">
      Tab Label
    </button>
  </div>
</div>
```

---

### Dropdown Menu

```tsx
{/* Trigger */}
<button className="...">
  Options
  <ChevronDownIcon className="size-4 ml-2" />
</button>

{/* Menu */}
<div className="
  min-w-[180px]
  bg-background
  border border-border
  rounded-xl
  shadow-lg
  p-1
  animate-in fade-in-0 zoom-in-95 duration-150
">
  {/* Menu Item */}
  <button className="
    flex w-full items-center gap-2
    px-3 py-2
    rounded-lg
    text-sm
    text-foreground
    transition-colors duration-100
    hover:bg-secondary
    focus:bg-secondary focus:outline-none
  ">
    <Icon className="size-4 text-muted-foreground" />
    Menu Item
  </button>

  {/* Separator */}
  <div className="my-1 h-px bg-border" />

  {/* Destructive Item */}
  <button className="
    flex w-full items-center gap-2
    px-3 py-2
    rounded-lg
    text-sm
    text-destructive
    transition-colors duration-100
    hover:bg-destructive/10
    focus:bg-destructive/10 focus:outline-none
  ">
    <TrashIcon className="size-4" />
    Delete
  </button>
</div>
```

---

### Toast / Notification

```tsx
<div className="
  pointer-events-auto
  w-full max-w-sm
  bg-background
  border border-border
  rounded-xl
  shadow-lg
  overflow-hidden
  animate-in slide-in-from-right-full duration-300
">
  <div className="flex gap-3 p-4">
    {/* Icon */}
    <div className="
      shrink-0
      size-8
      rounded-full
      bg-primary/10
      flex items-center justify-center
    ">
      <CheckIcon className="size-4 text-primary" />
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm">Success!</p>
      <p className="text-sm text-muted-foreground mt-0.5">
        Your changes have been saved.
      </p>
    </div>

    {/* Close */}
    <button className="shrink-0 text-muted-foreground hover:text-foreground">
      <XIcon className="size-4" />
    </button>
  </div>

  {/* Progress bar (optional) */}
  <div className="h-1 bg-secondary">
    <div className="h-full bg-primary animate-[shrink_5s_linear]" />
  </div>
</div>
```

---

## Layout Patterns

### Page Container

```tsx
<main className="min-h-screen bg-background">
  {/* Max width container with responsive padding */}
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    {/* Page content */}
  </div>
</main>
```

### Sidebar Layout

```tsx
<div className="flex min-h-screen">
  {/* Sidebar */}
  <aside className="
    hidden lg:flex
    w-64 shrink-0
    flex-col
    border-r border-border
    bg-card
  ">
    {/* Sidebar header */}
    <div className="h-16 px-6 flex items-center border-b border-border">
      <Logo />
    </div>

    {/* Navigation */}
    <nav className="flex-1 overflow-y-auto p-4">
      {/* Nav items */}
    </nav>

    {/* Sidebar footer */}
    <div className="p-4 border-t border-border">
      {/* User menu, etc. */}
    </div>
  </aside>

  {/* Main content */}
  <main className="flex-1 flex flex-col">
    {/* Top bar */}
    <header className="h-16 px-6 flex items-center border-b border-border">
      {/* Header content */}
    </header>

    {/* Page content */}
    <div className="flex-1 overflow-y-auto p-6">
      {/* Content */}
    </div>
  </main>
</div>
```

### Grid Systems

**Standard Grid:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Grid items */}
</div>
```

**Bento Grid:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <div className="md:col-span-2 lg:col-span-2 lg:row-span-2">
    {/* Large featured card */}
  </div>
  <div>{/* Small card */}</div>
  <div>{/* Small card */}</div>
  <div className="md:col-span-2">{/* Wide card */}</div>
</div>
```

**Dashboard Grid:**
```tsx
<div className="grid grid-cols-12 gap-6">
  <div className="col-span-12 lg:col-span-8">{/* Main content */}</div>
  <div className="col-span-12 lg:col-span-4">{/* Sidebar */}</div>
</div>
```

---

## Unique Visual Signatures

### Film Strip Decoration

```tsx
{/* Decorative film strip border */}
<div className="
  relative
  before:absolute before:inset-y-0 before:left-0 before:w-4
  before:bg-[repeating-linear-gradient(0deg,transparent,transparent_8px,var(--border)_8px,var(--border)_16px)]
  after:absolute after:inset-y-0 after:right-0 after:w-4
  after:bg-[repeating-linear-gradient(0deg,transparent,transparent_8px,var(--border)_8px,var(--border)_16px)]
  pl-8 pr-8
">
  {/* Content */}
</div>
```

### Timecode Display

```tsx
<span className="
  font-mono text-sm
  tabular-nums
  text-muted-foreground
">
  01:23:45:12
</span>
```

### Progress/Playhead

```tsx
<div className="relative h-2 bg-secondary rounded-full overflow-hidden">
  {/* Progress fill */}
  <div
    className="absolute inset-y-0 left-0 bg-primary rounded-full"
    style={{ width: '45%' }}
  />
  {/* Playhead */}
  <div
    className="absolute top-1/2 -translate-y-1/2 size-3 bg-primary rounded-full shadow-md ring-2 ring-background"
    style={{ left: '45%' }}
  />
</div>
```

### Thumbnail with Film Frame

```tsx
<div className="
  relative
  aspect-video
  bg-secondary
  rounded-lg
  overflow-hidden
  ring-1 ring-border
  before:absolute before:inset-0 before:border-4 before:border-black/20 before:rounded-lg
">
  <img src="..." className="w-full h-full object-cover" />
  {/* Duration badge */}
  <span className="
    absolute bottom-2 right-2
    px-1.5 py-0.5
    bg-black/70 text-white
    rounded
    text-xs font-mono
  ">
    02:34
  </span>
</div>
```

### Orange Safelight Glow (Dark Mode)

```tsx
{/* Use for active/selected states in dark mode */}
<div className="
  dark:shadow-[0_0_30px_oklch(0.65_0.18_45_/_0.15)]
  dark:ring-1 dark:ring-primary/30
">
  {/* Content */}
</div>
```

---

## Animation Guidelines

### Timing Functions

| Name | Value | Usage |
|------|-------|-------|
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entrances |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exits |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | State changes |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful interactions |

### Duration Scale

| Token | Value | Usage |
|-------|-------|-------|
| `duration-75` | 75ms | Micro-interactions (checkboxes) |
| `duration-100` | 100ms | Quick feedback |
| `duration-150` | 150ms | Standard interactions |
| `duration-200` | 200ms | State transitions |
| `duration-300` | 300ms | Complex transitions |
| `duration-500` | 500ms | Page transitions |

### Common Animations

**Fade In:**
```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fade-in { animation: fade-in 0.2s ease-out; }
```

**Slide Up:**
```css
@keyframes slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-slide-up { animation: slide-up 0.3s ease-out; }
```

**Scale In:**
```css
@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-scale-in { animation: scale-in 0.2s ease-out; }
```

**Pulse Glow (Active State):**
```css
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 oklch(0.65 0.18 45 / 0.4); }
  50% { box-shadow: 0 0 20px 5px oklch(0.65 0.18 45 / 0); }
}
.animate-pulse-glow { animation: pulse-glow 2s infinite; }
```

### Framer Motion Patterns

**Entrance Animation:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
>
  {children}
</motion.div>
```

**Staggered List:**
```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(i => (
    <motion.li key={i} variants={item}>
      {i}
    </motion.li>
  ))}
</motion.ul>
```

**Press Effect:**
```tsx
<motion.button
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.1 }}
>
  Click me
</motion.button>
```

---

## Responsive Strategy

### Breakpoints

| Name | Min Width | Typical Usage |
|------|-----------|---------------|
| `sm` | 640px | Large phones, landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

### Mobile First Patterns

**Typography:**
```tsx
className="text-2xl md:text-3xl lg:text-4xl"
```

**Spacing:**
```tsx
className="p-4 md:p-6 lg:p-8"
```

**Layout:**
```tsx
className="flex flex-col md:flex-row"
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

**Visibility:**
```tsx
className="hidden md:block"  // Hide on mobile
className="md:hidden"        // Show only on mobile
```

### Touch Considerations

- Minimum touch target: `44px × 44px` (use `min-h-11 min-w-11`)
- Increase padding on mobile: `px-4 py-3` instead of `px-3 py-2`
- Avoid hover-only interactions on touch devices
- Use `@media (hover: hover)` for hover effects

---

## Accessibility Guidelines

### Focus Management

- Always use `focus-visible` instead of `focus` for keyboard navigation
- Focus ring must be visible: `ring-2 ring-ring ring-offset-2`
- Never remove focus outlines without replacement
- Maintain logical tab order

### Color Contrast

- Text on background: minimum 4.5:1 ratio
- Large text (18px+): minimum 3:1 ratio
- Interactive elements: minimum 3:1 ratio against adjacent colors
- Always test in both light and dark modes

### Motion

- Respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Screen Readers

- Use semantic HTML (`<button>`, `<nav>`, `<main>`, etc.)
- Add `aria-label` for icon-only buttons
- Use `aria-describedby` for form field hints
- Hide decorative elements: `aria-hidden="true"`

---

## Checklist for New Components

### Visual
- [ ] Uses semantic color tokens (`bg-card`, `text-foreground`, etc.)
- [ ] Uses correct border radius from scale (`rounded-md`, `rounded-lg`, `rounded-xl`)
- [ ] Has appropriate shadows (light) or glows (dark)
- [ ] Respects spacing scale (4px increments)
- [ ] Typography follows hierarchy (weights, sizes)

### Interactive
- [ ] Has visible focus state (`focus-visible:ring-2`)
- [ ] Has hover state with smooth transition
- [ ] Has disabled state (`disabled:opacity-50 disabled:pointer-events-none`)
- [ ] Has active/pressed state where appropriate
- [ ] Touch targets are at least 44px

### Responsive
- [ ] Works on mobile (320px minimum)
- [ ] Uses responsive classes (`md:`, `lg:`)
- [ ] Text remains readable at all sizes
- [ ] Layout doesn't break at any viewport

### Accessibility
- [ ] Uses semantic HTML elements
- [ ] Has appropriate ARIA attributes
- [ ] Color contrast meets WCAG AA
- [ ] Works with keyboard navigation

### Code Quality
- [ ] Uses CVA for variants when applicable
- [ ] Uses `data-slot` for component identification
- [ ] Transitions use `duration-150` or `duration-200`
- [ ] No magic numbers (use design tokens)

---

## File Structure

```
src/
├── app/
│   └── globals.css          # CSS variables, keyframes, base styles
├── components/
│   ├── ui/                   # Primitive components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── layout/               # Layout components
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   └── [feature]/            # Feature-specific components
└── lib/
    └── utils.ts              # cn() helper, utilities
```

**Component Template:**
```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const componentVariants = cva(
  "base-classes-here",
  {
    variants: {
      variant: {
        default: "...",
        secondary: "...",
      },
      size: {
        sm: "...",
        md: "...",
        lg: "...",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {}

export function Component({ className, variant, size, ...props }: ComponentProps) {
  return (
    <div
      data-slot="component"
      className={cn(componentVariants({ variant, size }), className)}
      {...props}
    />
  )
}
```

---

## 执行步骤

当用户调用 `/design` 时：

1. **理解需求**：明确用户要创建什么组件或 UI
2. **查找现有组件**：检查 `src/components/ui/` 是否有可复用的基础组件
3. **按规范编写**：严格遵循上述设计系统编写代码
4. **自检清单**：完成后对照 Checklist 检查是否符合规范
5. **删除冗余**：检查并删除任何冗余代码
