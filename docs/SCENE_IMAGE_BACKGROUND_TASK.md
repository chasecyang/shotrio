# 场景图片生成后台任务重构

## 概述

将场景图片生成从同步阻塞改为后台任务处理，用户无需在 Dialog 中等待，提升用户体验。

## 更改内容

### 1. 重构场景图片生成 Actions (`src/lib/actions/scene/image.ts`)

**删除的函数：**
- `generateMasterLayout()` - 同步生成全景布局图（返回候选图片）
- `generateQuarterView()` - 同步生成叙事视角图（返回候选图片）
- `saveMasterLayout()` - 保存选中的全景布局图
- `saveQuarterView()` - 保存选中的叙事视角图
- `saveSceneImage()` - 通用保存函数

**新增的函数：**
- `startMasterLayoutGeneration()` - 创建全景布局图生成任务
- `startQuarterViewGeneration()` - 创建叙事视角图生成任务
- `regenerateSceneImage()` - 重新生成场景图片（统一入口）

**关键变化：**
- 在创建任务前先创建 `sceneImage` 记录（包含 `imagePrompt`）
- 使用 `createJob()` 创建后台任务
- Worker 处理完成后直接更新 `sceneImage.imageUrl`
- 用户通过任务中心监控进度

### 2. 更新 UI 组件

#### `scene-master-layout-tab.tsx`
- 移除候选图片选择流程
- 移除本地状态管理（`isGenerating`, `candidates`, `showDialog`）
- 调用 `startMasterLayoutGeneration()` 创建任务
- 显示 Toast 提示用户到任务中心查看进度

#### `scene-quarter-view-tab.tsx`
- 与 `scene-master-layout-tab.tsx` 相同的重构
- 保留 master_layout 前置检查逻辑

#### 删除 `scene-image-candidates-dialog.tsx`
- 不再需要候选图片选择对话框

### 3. 清理冗余代码

#### `image-generation-actions.ts`
删除场景相关函数：
- `generateSceneImage()`
- `queueSceneImageGeneration()`

这些函数与场景模块的职责重复，场景图片生成统一在 `scene/image.ts` 中处理。

### 4. 更新导出索引 (`scene/index.ts`)

```typescript
// 旧导出
export {
  generateMasterLayout,
  generateQuarterView,
  saveMasterLayout,
  saveQuarterView,
  // ...
}

// 新导出
export {
  startMasterLayoutGeneration,
  startQuarterViewGeneration,
  regenerateSceneImage,
  // ...
}
```

### 5. Worker 处理器优化 (`job-processor.ts`)

**简化 Prompt 处理：**
- 删除 `buildScenePrompt()` 辅助函数
- 直接使用 `sceneImage.imagePrompt`（在创建任务时已构建）
- 减少 Worker 中的业务逻辑复杂度

**处理流程：**
1. 验证权限和数据
2. 读取预先保存的 `imagePrompt`
3. 调用 fal.ai 生成图片
4. 上传到 R2 存储
5. 更新 `sceneImage.imageUrl`

### 6. 任务中心支持 (`background-tasks.tsx`)

添加场景相关任务类型：
```typescript
scene_extraction: {
  label: "场景提取",
  icon: <Film className="w-3.5 h-3.5" />,
},
scene_image_generation: {
  label: "场景图生成",
  icon: <Sparkles className="w-3.5 h-3.5" />,
},
```

## 用户体验改进

### 之前的流程：
1. 点击"生成全景布局图"
2. 等待 30 秒（卡在 Dialog 中）
3. 显示 4 张候选图
4. 选择一张
5. 保存并上传到 R2

**问题：**
- 用户必须等待完成
- 无法进行其他操作
- 生成失败需要重新开始

### 现在的流程：
1. 点击"生成全景布局图"
2. 立即创建任务并提示
3. 用户可以继续其他操作
4. 通过任务中心监控进度
5. 完成后自动刷新页面显示结果

**优势：**
- 非阻塞体验
- 可以批量创建多个任务
- 失败后可以重试
- 统一的任务监控界面

## 技术细节

### Prompt 构建时机

**旧方案：** Worker 中构建
```typescript
// Worker 需要知道如何构建 Prompt
const fullPrompt = buildScenePrompt({
  sceneName, sceneDescription, location, timeOfDay, viewLabel, viewDescription
});
```

**新方案：** 创建任务时构建
```typescript
// Action 中构建并保存
const imagePrompt = buildMasterLayoutPrompt(sceneData);
await db.insert(sceneImage).values({
  imagePrompt,  // 保存到数据库
  // ...
});

// Worker 直接使用
const fullPrompt = imageRecord.imagePrompt;
```

**好处：**
- Worker 职责单一（只负责执行）
- Prompt 逻辑集中管理
- 可追溯每次生成使用的 Prompt

### 数据流

```
用户操作
  ↓
startMasterLayoutGeneration()
  ├─ 创建 sceneImage 记录（含 imagePrompt）
  └─ 创建 Job 任务
      ↓
Worker 轮询
  ↓
processSceneImageGeneration()
  ├─ 读取 imagePrompt
  ├─ 调用 fal.ai
  ├─ 上传 R2
  └─ 更新 sceneImage.imageUrl
      ↓
前端 SSE 接收更新
  ↓
自动刷新页面
```

## 迁移指南

如果有现有代码使用旧 API，需要更新：

```typescript
// ❌ 旧代码
const result = await generateMasterLayout(projectId, sceneId);
if (result.success && result.images) {
  const selectedUrl = result.images[0];
  await saveMasterLayout(projectId, sceneId, selectedUrl);
}

// ✅ 新代码
const result = await startMasterLayoutGeneration(projectId, sceneId);
if (result.success) {
  toast.success("已开始生成，请在任务中心查看进度");
}
```

## 测试要点

1. ✅ 创建场景图生成任务
2. ✅ Worker 正确处理任务
3. ✅ 图片上传到 R2
4. ✅ 数据库正确更新
5. ✅ 前端 SSE 接收更新
6. ✅ 页面自动刷新显示结果
7. ✅ 任务失败处理
8. ✅ 任务重试功能

## 影响范围

- ✅ `src/lib/actions/scene/image.ts`
- ✅ `src/lib/actions/scene/index.ts`
- ✅ `src/components/projects/scenes/scene-master-layout-tab.tsx`
- ✅ `src/components/projects/scenes/scene-quarter-view-tab.tsx`
- ✅ `src/components/projects/layout/background-tasks.tsx`
- ✅ `src/lib/workers/job-processor.ts`
- ✅ `src/lib/actions/image-generation-actions.ts`
- ❌ `src/components/projects/scenes/scene-image-candidates-dialog.tsx` (已删除)

## 后续优化建议

1. **批量生成**：支持一次性为多个场景创建生成任务
2. **任务优先级**：重要场景优先生成
3. **任务分组**：在任务中心按项目分组显示
4. **通知系统**：任务完成后浏览器通知
5. **Webhook**：支持任务完成后的回调

## 相关文档

- [任务系统快速开始](./TASK_SYSTEM_QUICK_START.md)
- [场景提取实现](./SCENE_EXTRACTION_IMPLEMENTATION.md)
- [Worker 部署指南](./worker-deployment-guide.md)

