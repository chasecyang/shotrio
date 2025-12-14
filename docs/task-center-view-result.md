# 任务中心"查看结果"功能实现

## 功能概述

在任务中心为已完成的任务添加"查看结果"按钮，用户可以直接从任务中心查看任务结果，无需在编辑器页面等待横幅显示。

## 修改的文件

### 1. TaskCenter 组件 (`src/components/tasks/task-center.tsx`)

**新增 `handleView` 方法**：

```typescript
const handleView = (jobId: string) => {
  const job = [...activeJobs, ...historicalJobs].find((j) => j.id === jobId);
  if (!job) {
    toast.error("任务不存在");
    return;
  }

  if (!job.projectId) {
    toast.error("无法获取项目信息");
    return;
  }

  const currentLang = window.location.pathname.split('/')[1] || 'zh';

  // 根据任务类型处理
  try {
    switch (job.type) {
      case "storyboard_generation": {
        // 分镜提取任务：跳转到编辑器并打开预览对话框
        const inputData = JSON.parse(job.inputData);
        const episodeId = inputData.episodeId;
        
        if (episodeId) {
          window.location.href = `/${currentLang}/projects/${job.projectId}/editor?episode=${episodeId}&jobId=${jobId}`;
        }
        break;
      }
      
      case "character_extraction":
      case "scene_extraction": {
        // 角色/场景提取任务：跳转到编辑器
        window.location.href = `/${currentLang}/projects/${job.projectId}/editor?jobId=${jobId}`;
        break;
      }
      
      default:
        // 其他任务类型
        window.location.href = `/${currentLang}/projects/${job.projectId}/editor`;
        break;
    }
  } catch (error) {
    console.error("解析任务数据失败:", error);
    toast.error("无法解析任务数据");
  }
};
```

**将 `handleView` 传递给 TaskItem**：

```typescript
<TaskItem
  key={job.id}
  job={job}
  onView={handleView}
/>
```

### 2. TaskItem 组件 (`src/components/tasks/task-item.tsx`)

**优化 `canView` 逻辑**：

```typescript
// 只有已完成且支持查看的任务类型才显示"查看结果"按钮
const viewableTaskTypes = [
  "storyboard_generation",
  "character_extraction",
  "scene_extraction",
];
const canView = job.status === "completed" && 
                job.type && 
                viewableTaskTypes.includes(job.type) &&
                !job.isImported; // 已导入的任务不再显示查看按钮
```

这样可以：
- 只对特定任务类型显示"查看结果"按钮
- 已导入的任务不再显示查看按钮（避免重复导入）

### 3. EpisodeEditor 组件 (`src/components/projects/editor/preview-panel/episode-editor.tsx`)

**添加 URL 参数检测**：

```typescript
// 检测 URL 参数，自动打开分镜预览对话框
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get('jobId');
  
  if (jobId) {
    setExtractionJobId(jobId);
    setExtractionDialogOpen(true);
    
    // 清除 URL 参数
    const url = new URL(window.location.href);
    url.searchParams.delete('jobId');
    window.history.replaceState({}, '', url.toString());
  }
}, []);
```

这样当从任务中心跳转过来时，会自动打开分镜预览对话框。

## 使用流程

### 分镜提取任务

1. 用户在任务中心看到已完成的"分镜提取"任务
2. 点击"查看结果"按钮
3. 自动跳转到对应剧集的编辑器页面
4. 自动打开分镜预览对话框
5. 用户可以预览并选择导入分镜

### 角色/场景提取任务

1. 用户在任务中心看到已完成的"角色提取"或"场景提取"任务
2. 点击"查看结果"按钮
3. 自动跳转到项目编辑器页面
4. 在相应的角色/场景页面会显示横幅，提示导入

## 技术细节

### URL 参数设计

- `episode`: 剧集ID（用于切换到对应剧集）
- `jobId`: 任务ID（用于打开预览对话框或横幅）

示例：
```
/zh/projects/abc123/editor?episode=ep456&jobId=job789
```

### 任务状态判断

- `isImported`: 标记任务结果是否已导入
- 已导入的任务不显示"查看结果"按钮
- 避免用户重复导入相同的内容

### 支持的任务类型

目前支持"查看结果"的任务类型：
1. `storyboard_generation` - 分镜提取
2. `character_extraction` - 角色提取
3. `scene_extraction` - 场景提取

后续可以根据需要扩展其他任务类型。

## 用户体验改进

1. **直接访问**：无需等待横幅加载，直接从任务中心查看结果
2. **清晰提示**：已完成的任务显示"查看结果"按钮，用户知道可以操作
3. **自动导航**：自动跳转到正确的页面并打开对话框
4. **避免重复**：已导入的任务不显示查看按钮，避免重复操作

## 测试建议

1. 启动一个分镜提取任务
2. 等待任务完成
3. 打开任务中心，切换到"已完成"标签
4. 找到分镜提取任务，点击"查看结果"
5. 验证是否跳转到正确的剧集编辑页面
6. 验证分镜预览对话框是否自动打开
7. 导入分镜后，再次查看任务中心，验证该任务是否不再显示"查看结果"按钮

## 未来优化方向

1. 添加更多任务类型的支持（图像生成、视频生成等）
2. 在对话框中显示任务详情和时间信息
3. 支持批量查看多个任务结果
4. 添加结果预览缩略图

