# 场景模块重构完成总结

## 🎯 重构目标

简化场景管理，聚焦两张核心图片，提升用户体验。

## ✅ 已完成的工作

### 1. 数据库 Schema 更新 ✓

**文件**: `src/lib/db/schemas/project.ts`

- 新增 `sceneImageTypeEnum` 枚举：`master_layout` | `quarter_view`
- 简化 `scene` 表：移除 `location` 和 `timeOfDay` 字段
- 重构 `sceneImage` 表：
  - `label` (text) → `imageType` (enum)
  - 移除 `isPrimary` 字段

### 2. TypeScript 类型定义 ✓

**文件**: `src/types/project.ts`

- 新增 `SceneImageType` 类型
- 更新 `SceneDetail` 接口，添加 `masterLayout` 和 `quarterView` 属性

### 3. Prompt 模板系统 ✓

**文件**: `src/lib/prompts/scene.ts` (新建)

专业的电影级 prompt 模板：
- `buildMasterLayoutPrompt()` - 全景布局图 prompt
- `buildQuarterViewPrompt()` - 45° 视角 prompt
- `getSceneImageTypeName()` - 获取类型中文名称
- `getSceneImageTypeDescription()` - 获取类型描述

### 4. Server Actions 重构 ✓

**文件**: `src/lib/actions/scene/image.ts`

**新增函数**：
- `generateMasterLayout()` - 生成 Master Layout（4张候选）
- `generateQuarterView()` - 生成 Quarter View（4张候选）
- `saveMasterLayout()` - 保存 Master Layout
- `saveQuarterView()` - 保存 Quarter View
- `regenerateSceneImage()` - 重新生成指定类型图片
- `getSceneImages()` - 获取场景的两张核心图片

**移除函数**：
- `generateSceneImages()` (通用生成)
- `saveSceneImage()` (通用保存)
- `setScenePrimaryImage()` (设置主图)
- `generateImageForSceneView()` (异步生成)
- `regenerateSceneViewImage()` (异步重新生成)

**文件**: `src/lib/actions/scene/crud.ts`

- 简化 `upsertScene()` 参数，移除 `location` 和 `timeOfDay`

### 5. 前端组件重构 ✓

#### 5.1 图片候选弹窗组件（新建）

**文件**: `src/components/projects/scenes/scene-image-candidates-dialog.tsx`

功能：
- 显示 4 张候选图片（2x2 网格）
- 点击选择，高亮边框
- Loading 状态（骨架屏）
- Stagger 淡入动画

#### 5.2 场景详情 Sheet

**文件**: `src/components/projects/scenes/scene-detail-sheet.tsx`

更新：
- 添加完成度进度条（0% / 50% / 100%）
- 优化 Tab 切换体验
- 首次添加描述后自动跳转到图片 Tab

#### 5.3 场景图片 Tab（新建）

**文件**: `src/components/projects/scenes/scene-images-tab.tsx`

核心功能：
- 引导式生成流程
- Master Layout 卡片（蓝色调）
- 45° View 卡片（橙色调，需先完成 Master Layout）
- 锁定/解锁状态
- 图片预览和重新生成

#### 5.4 场景创建对话框

**文件**: `src/components/projects/scenes/scene-dialog.tsx`

简化：
- 移除"位置标注"和"时间段"字段
- 优化场景描述提示文案

#### 5.5 场景卡片

**文件**: `src/components/projects/scenes/scenes-section.tsx`

更新：
- 优先显示 `quarter_view` 作为封面
- 新的状态徽章系统
- 显示完成度百分比
- 简化元数据显示

#### 5.6 场景设置 Tab

**文件**: `src/components/projects/scenes/scene-settings-tab.tsx`

简化：
- 移除"位置标注"和"时间段"字段
- 增强场景描述输入区域（6行）
- 添加描述建议提示框

### 6. 视觉优化 ✓

**文件**: `src/app/globals.css`

新增样式：
- `.scene-card-gradient` - 场景卡片渐变背景
- `.master-layout-border` - Master Layout 蓝色边框
- `.quarter-view-border` - Quarter View 橙色边框
- `@keyframes shimmer` - 闪烁加载动画
- `@keyframes pulse-glow` - 脉冲发光动画
- `.scale-hover` - 平滑缩放交互

## 📊 数据结构对比

### 之前（复杂，灵活但混乱）

```typescript
Scene {
  name: string;
  description?: string;
  location?: string;      // ❌ 移除
  timeOfDay?: string;     // ❌ 移除
}

SceneImage {
  label: string;          // ❌ 自由文本，不可控
  isPrimary: boolean;     // ❌ 需要手动管理
  imageUrl?: string;
  imagePrompt?: string;
  seed?: number;
}
```

### 现在（简洁，专注核心）

```typescript
Scene {
  name: string;
  description?: string;   // ✅ 包含所有描述信息
}

SceneImage {
  imageType: "master_layout" | "quarter_view";  // ✅ 强类型约束
  imageUrl?: string;
  imagePrompt?: string;
  seed?: number;
}
```

## 🎨 用户体验改进

### 1. 引导式流程
- **阶段 1**: 填写场景名称和描述
- **阶段 2**: 生成 Master Layout（建立空间认知）
- **阶段 3**: 生成 45° View（叙事主力视角）
- **阶段 4**: 完成，可随时重新生成

### 2. 视觉层次
- Master Layout：**冷色调边框**（蓝色系）+ Film 图标
- 45° View：**暖色调边框**（橙色系）+ Camera 图标
- 清晰的锁定/解锁状态

### 3. 即时反馈
- 实时完成度显示（0% / 50% / 100%）
- 候选图片 stagger 动画
- 选择时的缩放和高亮反馈
- 生成过程中的骨架屏

### 4. 智能提示
- 每个阶段都有清晰的下一步指引
- 描述建议提示框
- 图片类型说明和适用镜头

## 🔄 迁移路径

用户需要执行的步骤：

1. **生成迁移文件**
   ```bash
   npx drizzle-kit generate
   ```

2. **执行迁移**
   ```bash
   npx drizzle-kit push
   ```

3. **验证数据**
   - 检查现有场景数据是否正确迁移
   - 确认图片类型映射正确

详细步骤见：`SCENE_REFACTOR_MIGRATION.md`

## 📁 文件清单

### 新建文件
- ✅ `src/lib/prompts/scene.ts` - Prompt 模板
- ✅ `src/components/projects/scenes/scene-image-candidates-dialog.tsx` - 候选图片弹窗
- ✅ `src/components/projects/scenes/scene-images-tab.tsx` - 场景图片 Tab
- ✅ `SCENE_REFACTOR_MIGRATION.md` - 迁移指南
- ✅ `SCENE_REFACTOR_SUMMARY.md` - 本文档

### 修改文件
- ✅ `src/lib/db/schemas/project.ts` - Schema 定义
- ✅ `src/types/project.ts` - 类型定义
- ✅ `src/lib/actions/scene/image.ts` - 图片生成 Actions
- ✅ `src/lib/actions/scene/crud.ts` - CRUD Actions
- ✅ `src/lib/actions/scene/index.ts` - Actions 导出
- ✅ `src/components/projects/scenes/scene-detail-sheet.tsx` - 详情页
- ✅ `src/components/projects/scenes/scene-dialog.tsx` - 创建对话框
- ✅ `src/components/projects/scenes/scenes-section.tsx` - 场景列表
- ✅ `src/components/projects/scenes/scene-settings-tab.tsx` - 设置 Tab
- ✅ `src/app/globals.css` - 全局样式

## 🎯 核心概念

### Master Layout（全景布局图）

**用途**：建立空间认知，提供"这是哪里"的答案

**规格**：
- 比例：16:9 横版
- 视角：略高于眼平线（Eye Level +10°）
- 范围：展示整个场景的完整空间
- 内容：前景/中景/背景层次分明，无角色

**适用镜头**：
- Extreme Long Shot（大远景）
- Long Shot（远景）
- Full Shot（全景）
- 片头/片尾的环境建立镜头

### 45° Three-Quarter View（叙事主力视角）

**用途**：叙事主力，90%的对话和动作镜头都用这个角度

**规格**：
- 比例：16:9 横版
- 视角：45度侧面，眼平线高度
- 范围：聚焦场景中心区域（角色活动的核心空间）
- 内容：展示墙面、家具、道具等细节，预留角色站位空间

**适用镜头**：
- Medium Shot（中景）- 最常用
- Medium Close-Up（中近景）
- Close-Up（特写）- 可裁切使用
- 对话镜头（Over-the-shoulder）

## 🚀 下一步

1. **执行数据库迁移** - 参考 `SCENE_REFACTOR_MIGRATION.md`
2. **测试完整流程** - 创建、生成、重新生成、删除
3. **收集用户反馈** - 观察实际使用情况
4. **性能优化** - 如有需要

## 📝 注意事项

1. **数据丢失警告**：`location` 和 `time_of_day` 字段将被删除
2. **向后兼容**：旧的 API 已移除，请确保没有其他模块依赖
3. **图片类型映射**：迁移时会自动推断，但建议人工验证

---

**重构完成时间**: 2025-12-10  
**总代码变更**: ~15 个文件  
**新增功能**: 引导式生成流程、候选图片选择、进度可视化  
**移除功能**: 自由视角管理、位置/时间标注  

✨ **重构成功！所有待办事项已完成。**

