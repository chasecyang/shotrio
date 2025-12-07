# 场景模块实现总结

本文档记录了场景管理模块的完整实现过程。

## 实现概览

场景模块已成功实现，支持场景的创建、管理和多角度图片生成功能。该模块参考了角色模块的设计模式，提供了一致的用户体验。

## 完成的功能

### 1. 数据库设计 ✅

#### 新增表结构：

**scene 表**
- id (主键)
- projectId (外键 -> project.id)
- name (场景名称)
- description (场景描述)
- location (位置标注，如"内景"、"exterior")
- timeOfDay (时间段，如"白天"、"night")
- createdAt, updatedAt

**sceneImage 表**
- id (主键)
- sceneId (外键 -> scene.id)
- label (视角名称，如"全景"、"正面视角")
- imagePrompt (图像生成prompt)
- imageUrl (生成的图片URL)
- seed (图片seed)
- isPrimary (是否为主图)
- createdAt, updatedAt

**shot 表扩展**
- 新增 sceneId 字段，用于关联场景

### 2. 类型定义 ✅

在 `src/types/project.ts` 中添加：
- Scene, NewScene 基础类型
- SceneImage, NewSceneImage 基础类型
- SceneWithImages, SceneDetail 业务类型
- SceneViewPreset 预设接口

在 `src/types/job.ts` 中添加：
- scene_image_generation 任务类型
- SceneImageGenerationInput, SceneImageGenerationResult

### 3. Server Actions ✅

创建了完整的场景管理 actions：

**crud.ts**
- `upsertScene()` - 创建/更新场景
- `deleteScene()` - 删除场景

**image.ts**
- `generateSceneImages()` - 同步生成场景图片
- `saveSceneImage()` - 保存场景视角图
- `deleteSceneImage()` - 删除场景视角图
- `setScenePrimaryImage()` - 设置主图
- `generateImageForSceneView()` - 提交异步生成任务
- `regenerateSceneViewImage()` - 重新生成图片

### 4. UI 组件 ✅

创建了完整的组件库：

- **scenes-section.tsx** - 场景列表主容器
  - 空状态提示
  - 场景卡片网格
  - 创建入口

- **scene-card.tsx** - 场景卡片组件
  - 3:4 竖版比例
  - 主图展示
  - 状态徽章
  - 操作菜单

- **scene-dialog.tsx** - 创建场景对话框
  - 场景名称、描述
  - 位置标注、时间段

- **scene-detail-sheet.tsx** - 场景详情抽屉
  - 双Tab设计（设定 + 视角管理）
  - 视角图片生成
  - 图片管理功能

- **scene-settings-tab.tsx** - 场景设定Tab
  - 场景基本信息编辑
  - 实时保存

### 5. 页面路由 ✅

- 创建 `/projects/[id]/scenes/page.tsx`
- 集成 Breadcrumb 导航
- Suspense + Skeleton 加载优化

### 6. Job 处理器 ✅

扩展了 `job-processor.ts`：
- 添加 `processSceneImageGeneration()` 函数
- 实现专业的场景Prompt构建策略
- 支持16:9横版场景图生成
- 图片上传到R2存储

### 7. 侧边栏导航 ✅

- 在 `project-sidebar.tsx` 中添加场景导航
- 使用 Map 图标
- 显示场景数量徽章
- 支持中英文翻译

### 8. 国际化 ✅

- zh.json: "scenes": "场景管理"
- en.json: "scenes": "Scenes"

## 核心设计特点

### 1. 一致性设计
- 完全参考角色模块的交互模式
- 相同的双Tab结构（设定 + 图片管理）
- 统一的操作流程和状态管理

### 2. 专业的Prompt构建
```typescript
function buildScenePrompt(params) {
  return `Create a cinematic location concept art for ${sceneName}.
  
  Scene Description: ${sceneDescription}.
  View: ${viewLabel}. ${viewDescription}.
  Setting: ${location}, ${timeOfDay} lighting.
  
  [详细的专业要求...]`;
}
```

### 3. 灵活的视角管理
- 支持多个视角图片
- 快速预设（全景、正面、侧面、鸟瞰等）
- 主图标记功能

### 4. 优化的用户体验
- 同步生成（快速预览）
- 异步任务（批量处理）
- 图片永久化存储（R2）

## 技术栈

- **Frontend**: React, TypeScript, shadcn/ui
- **Backend**: Next.js Server Actions
- **Database**: PostgreSQL + Drizzle ORM
- **AI服务**: fal.ai (Nano Banana Pro)
- **存储**: Cloudflare R2

## 文件清单

### 数据库
- `src/lib/db/schemas/project.ts` - scene 和 sceneImage 表定义

### 类型
- `src/types/project.ts` - Scene 相关类型
- `src/types/job.ts` - 场景图片生成任务类型

### Actions
- `src/lib/actions/scene/crud.ts`
- `src/lib/actions/scene/image.ts`
- `src/lib/actions/scene/index.ts`
- `src/lib/actions/scene/README.md`

### 组件
- `src/components/projects/scenes/scenes-section.tsx`
- `src/components/projects/scenes/scene-dialog.tsx`
- `src/components/projects/scenes/scene-detail-sheet.tsx`
- `src/components/projects/scenes/scene-settings-tab.tsx`

### 页面
- `src/app/[lang]/projects/[id]/scenes/page.tsx`

### Worker
- `src/lib/workers/job-processor.ts` - 场景图片生成处理

### 其他
- `src/components/projects/layout/project-sidebar.tsx` - 导航入口
- `messages/zh.json`, `messages/en.json` - 国际化

## 下一步建议

### Phase 2 - 增强功能
1. **AI提取场景** - 从剧本中自动识别和提取场景
2. **场景与分镜关联** - 在分镜编辑器中使用场景作为参考
3. **批量生成** - 支持一次性为场景生成多个视角
4. **场景库** - 支持场景模板和跨项目复用

### 性能优化
1. 图片懒加载和渐进式加载
2. 场景列表虚拟滚动
3. 缓存优化

### 用户体验增强
1. 拖拽排序场景
2. 场景分组和标签
3. 场景搜索和筛选
4. 导出场景设定文档

## 注意事项

1. **数据库迁移** - 需要运行数据库迁移以创建新表
2. **R2配置** - 确保 R2_PUBLIC_DOMAIN 环境变量已正确配置
3. **Job处理** - 确保 worker 服务正在运行以处理图片生成任务
4. **API限制** - 注意 fal.ai 的调用频率限制

## 测试清单

- [ ] 创建场景
- [ ] 编辑场景信息
- [ ] 删除场景
- [ ] 生成场景视角图（同步）
- [ ] 生成场景视角图（异步任务）
- [ ] 设置主图
- [ ] 删除视角图
- [ ] 重新生成图片
- [ ] 侧边栏导航
- [ ] 面包屑导航
- [ ] 移动端适配

---

**实施日期**: 2025-12-07
**状态**: ✅ 已完成
**版本**: v1.0.0 (MVP)
