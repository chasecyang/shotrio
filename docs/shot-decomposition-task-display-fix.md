# 分镜拆解任务显示优化

## 问题描述

分镜拆解任务在后台任务列表中显示为"未知任务"，并且无法查看结果。

## 根本原因

1. 在 `task-item.tsx` 中的 `taskTypeLabels` 对象没有定义 `shot_decomposition` 类型
2. 在 `task-item.tsx` 中的 `viewableTaskTypes` 数组没有包含 `shot_decomposition`
3. 在 `background-tasks.tsx` 中的 `taskTypeLabels` 对象没有定义 `shot_decomposition` 类型
4. 在 `background-tasks.tsx` 中的 `handleView` 函数没有处理 `shot_decomposition` 任务类型
5. `editor-context.tsx` 中的 context value 没有包含 `openShotDecompositionDialog` 和 `closeShotDecompositionDialog` 方法
6. `BackgroundTasks` 组件在非编辑器页面也被使用，导致使用了 `useEditorOptional()`

## 解决方案

### 1. 更新 `src/components/tasks/task-item.tsx`

添加分镜拆解任务类型的标签定义：

```typescript
shot_decomposition: {
  label: "分镜拆解",
  icon: <Film className="w-4 h-4" />,
},
```

将 `shot_decomposition` 添加到可查看结果的任务类型列表：

```typescript
const viewableTaskTypes = [
  "storyboard_generation",
  "character_extraction",
  "scene_extraction",
  "shot_decomposition", // 新增
];
```

### 2. 更新 `src/components/projects/layout/background-tasks.tsx`

**添加分镜拆解任务类型标签：**

```typescript
shot_decomposition: {
  label: "分镜拆解",
  icon: <Film className="w-3.5 h-3.5" />,
},
```

**获取编辑器上下文中的对话框打开方法：**

```typescript
const openShotDecompositionDialog = editorContext?.openShotDecompositionDialog;
```

**在 `TaskNodeItem` 组件中将 `shot_decomposition` 添加到可查看任务列表：**

```typescript
const viewableTaskTypes = [
  "storyboard_generation",
  "character_extraction",
  "scene_extraction",
  "shot_decomposition", // 新增
];
```

**在 `handleView` 函数中添加处理逻辑：**

```typescript
case "shot_decomposition": {
  // 分镜拆解任务：直接打开预览对话框
  if (!openShotDecompositionDialog) {
    toast.info("请在编辑器页面查看分镜拆解结果");
    return;
  }
  if (!job.inputData) {
    toast.error("无法获取任务数据");
    return;
  }
  const decompositionInputData = JSON.parse(job.inputData);
  const shotId = decompositionInputData.shotId;
  
  if (shotId) {
    openShotDecompositionDialog(shotId, jobId);
  } else {
    toast.error("无法获取分镜信息");
  }
  break;
}
```

## 功能说明

### 任务列表显示

- 分镜拆解任务现在会显示为"分镜拆解"而不是"未知任务"
- 使用 Film 图标来标识
- 显示任务状态（等待中、处理中、已完成、失败）
- 完成后显示副标题："已拆解为 X 个子分镜"

### 查看结果按钮

**显示位置：**
- **仅在编辑器页面**右上角的后台任务下拉菜单中显示
- 点击 Activity 图标打开任务列表
- 每个已完成的分镜拆解任务下方都会显示"查看结果"按钮
- 在角色、场景等非编辑器页面**不显示后台任务按钮**

**按钮显示条件：**
- 任务状态为"已完成"（completed）
- 任务类型为 `shot_decomposition`
- 任务尚未被导入（!isImported）

### 查看结果功能流程

当在编辑器页面点击"查看结果"按钮后：

1. 自动切换到相应的剧集
2. 打开分镜拆解预览对话框
3. 显示 AI 分析的拆解理由
4. 预览所有子分镜的详细信息（景别、运镜、对话等）
5. 用户可以确认导入或关闭对话框

### 对话框功能

分镜拆解对话框（`ShotDecompositionDialog`）提供以下功能：

- 查看 AI 分析的拆解理由
- 预览拆解后的所有子分镜
- 查看每个子分镜的详细信息：
  - 景别和运镜方式
  - 时长
  - 视觉描述
  - 角色和对话
- 确认导入拆解结果

### 3. 更新 `src/components/projects/editor/editor-context.tsx`

**在 context value 中添加分镜拆解对话框方法：**

```typescript
const value = useMemo(
  () => ({
    // ... 其他属性
    openStoryboardExtractionDialog,
    closeStoryboardExtractionDialog,
    openShotDecompositionDialog,    // 新增
    closeShotDecompositionDialog,   // 新增
    // ...
  }),
  [
    // ... 其他依赖
    openStoryboardExtractionDialog,
    closeStoryboardExtractionDialog,
    openShotDecompositionDialog,    // 新增
    closeShotDecompositionDialog,   // 新增
    // ...
  ]
);
```

### 4. 移除非编辑器页面的后台任务

**修改 `src/components/projects/layout/project-header.tsx`：**

移除了 `BackgroundTasks` 组件，因为在角色、场景等页面不需要显示后台任务。

**修改 `src/components/projects/layout/background-tasks.tsx`：**

将 `useEditorOptional()` 改为 `useEditor()`，确保只在编辑器页面使用：

```typescript
// 修改前
const editorContext = useEditorOptional();
const openStoryboardExtractionDialog = editorContext?.openStoryboardExtractionDialog;
const openShotDecompositionDialog = editorContext?.openShotDecompositionDialog;

// 修改后
const { openStoryboardExtractionDialog, openShotDecompositionDialog } = useEditor();
```

简化了 `handleView` 函数，移除了不必要的检查：

```typescript
case "shot_decomposition": {
  // 分镜拆解任务：直接打开预览对话框
  if (!job.inputData) {
    toast.error("无法获取任务数据");
    return;
  }
  const decompositionInputData = JSON.parse(job.inputData);
  const shotId = decompositionInputData.shotId;
  
  if (!shotId) {
    toast.error("无法获取分镜信息");
    return;
  }

  openShotDecompositionDialog(shotId, jobId);
  break;
}
```

### 5. 更新 `src/lib/actions/job/details.ts`

**添加类型导入：**

```typescript
import type { 
  // ... 其他类型
  ShotDecompositionInput,
  ShotDecompositionResult,
} from "@/types/job";
```

**在 `getTaskTypeLabel` 函数中添加标签：**

```typescript
function getTaskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    // ... 其他标签
    shot_decomposition: "分镜拆解",
    shot_image_generation: "分镜图生成",
    batch_shot_image_generation: "批量分镜图生成",
    shot_video_generation: "单镜视频生成",
    batch_video_generation: "批量视频生成",
    shot_tts_generation: "语音合成",
    final_video_export: "最终成片导出",
  };
  return labels[type] || "未知任务";
}
```

**在 `getJobDetails` 函数中添加详细信息处理：**

```typescript
case "shot_decomposition": {
  // 如果任务已完成，显示拆解结果
  if (job.status === "completed" && job.resultData) {
    try {
      const resultData = JSON.parse(job.resultData) as ShotDecompositionResult;
      const decomposedCount = resultData.decomposedCount || resultData.decomposedShots?.length || 0;
      baseDetails.displayTitle = "分镜拆解";
      baseDetails.displaySubtitle = `已拆解为 ${decomposedCount} 个子分镜`;
    } catch {
      baseDetails.displaySubtitle = "分镜拆解完成";
    }
  } else {
    baseDetails.displaySubtitle = "AI 分析中...";
  }
  break;
}
```

## 相关组件

### 修改的文件
- `src/components/tasks/task-item.tsx` - 任务卡片组件（添加任务类型标签）
- `src/components/projects/layout/background-tasks.tsx` - 后台任务下拉菜单（添加查看逻辑，改用 `useEditor`）
- `src/components/projects/layout/project-header.tsx` - 项目头部（移除后台任务按钮）
- `src/components/projects/editor/editor-context.tsx` - 编辑器状态管理（添加方法到 context value）
- `src/lib/actions/job/details.ts` - 任务详细信息获取（添加所有任务类型标签）

### 相关的现有组件
- `src/components/projects/editor/editor-header.tsx` - 编辑器头部（使用 BackgroundTasks）
- `src/components/projects/editor/preview-panel/shot-decomposition-dialog.tsx` - 分镜拆解预览对话框
- `src/lib/actions/storyboard/decompose-shot.ts` - 创建拆解任务
- `src/lib/actions/storyboard/import-decomposed-shots.ts` - 导入拆解结果
- `src/lib/workers/processors/shot-decomposition.ts` - 后台任务处理器

## 测试建议

1. 创建一个包含多句对话的分镜
2. 点击"拆解分镜"按钮创建拆解任务
3. 在后台任务列表中查看任务，应该显示为"分镜拆解"
4. 等待任务完成后，点击"查看结果"按钮
5. 预览拆解方案并确认导入
6. 检查分镜列表是否正确更新

## 注意事项

- **后台任务按钮仅在编辑器页面显示**，在角色、场景、设置等页面不显示
- 已导入的任务不再显示"查看结果"按钮（通过 `job.isImported` 标志判断）
- 任务输入数据必须包含 `shotId` 字段才能正确打开对话框
- `BackgroundTasks` 组件现在使用 `useEditor()` 而不是 `useEditorOptional()`，确保只在编辑器页面使用

## 架构改进

### 为什么移除非编辑器页面的后台任务？

1. **上下文依赖**：分镜拆解对话框需要编辑器上下文（EditorContext）才能正常工作
2. **用户体验**：在角色、场景等页面显示后台任务按钮，但点击后无法直接查看结果，用户体验不佳
3. **代码简化**：移除后可以使用 `useEditor()` 而不是 `useEditorOptional()`，简化逻辑
4. **功能聚焦**：编辑器页面是主要的工作区域，后台任务主要与编辑器相关的操作（分镜、视频生成等）关联

