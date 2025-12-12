# 分镜提取功能改进

## 问题描述

在原来的实现中，AI生成分镜有以下问题：

1. **错误的成功提示**：在分镜提取过程中，会弹窗说生成失败，但实际上任务并没有失败
2. **缺少状态横幅**：没有像场景和角色提取那样的横幅展示任务状态和验收结果
3. **轮询逻辑错误**：只检查父任务状态，父任务立即完成导致误报成功

## 问题根源

分镜提取采用两步式架构：

1. **父任务** (`storyboard_generation`)：创建子任务后立即完成
2. **第一步子任务** (`storyboard_basic_extraction`)：提取基础分镜信息
3. **第二步子任务** (`storyboard_matching`)：进行场景和角色的智能匹配

原来的代码只轮询父任务状态，父任务立即完成会触发"成功"提示，但实际上子任务还在处理中。

## 解决方案

### 1. 创建分镜提取横幅组件 (`shot-extraction-banner.tsx`)

参考 `scene-extraction-banner.tsx` 的实现，创建了新的横幅组件用于展示分镜提取任务的状态：

**功能特性：**
- 自动检测当前剧集的分镜提取任务（支持父任务、基础提取任务、匹配任务）
- 实时显示任务进度和状态消息
- 完成后显示分镜数量统计
- 提供"查看并导入"按钮，打开预览对话框
- 支持手动关闭横幅

**状态处理：**
- 处理中：显示蓝色横幅，带进度条和实时消息
- 已完成：显示绿色横幅，带分镜数量统计
- 失败：显示红色横幅，带错误信息

### 2. 修复轮询逻辑 (`shot-grid.tsx`)

修改了 `pollJobStatus` 函数，正确处理两步式任务架构：

```typescript
// 主要改进：
1. 增加轮询次数上限至120次（10分钟）- 因为有两步任务
2. 检查父任务完成后，解析resultData获取matchingJobId
3. 如果找到matchingJobId，轮询匹配任务的状态
4. 只有匹配任务完成时才显示成功提示和打开对话框
5. 保存matchingJobId供对话框使用
```

**关键逻辑：**
```typescript
// 父任务完成 -> 获取matchingJobId -> 轮询匹配任务 -> 真正完成
if (job.type === "storyboard_generation" && job.status === "completed") {
  const resultData = JSON.parse(job.resultData);
  matchingJobId = resultData.matchingJobId;
  // 继续轮询matchingJobId指向的任务
}
```

### 3. 集成横幅到页面 (`storyboard-section.tsx`)

在分镜页面中添加横幅组件，并处理导入成功后的状态：

```typescript
// 添加状态管理
const [recentlyImportedJobId, setRecentlyImportedJobId] = useState<string | null>(null);
const [previewJobId, setPreviewJobId] = useState<string | null>(null);

// 导入成功后隐藏横幅
const handleImportSuccess = () => {
  if (previewJobId) {
    setRecentlyImportedJobId(previewJobId);
  }
};
```

### 4. 更新父任务结果 (`job-processor.ts`)

在匹配任务完成后，自动更新父任务的 `resultData` 以包含 `matchingJobId`：

```typescript
// 在 processStoryboardMatching 完成后
if (input.parentJobId) {
  const parentJob = await getJob(input.parentJobId);
  if (parentJob) {
    const parentResult = JSON.parse(parentJob.resultData);
    parentResult.matchingJobId = jobData.id;
    await updateJobResultData(input.parentJobId, parentResult);
  }
}
```

这样即使用户在基础提取完成前就关闭页面，重新打开时也能通过父任务找到匹配任务。

## 用户体验流程

### 启动分镜提取
1. 用户点击"AI提取分镜"按钮
2. 显示 toast："AI分镜提取任务已创建，正在处理..."
3. 横幅出现，显示"正在生成分镜"状态

### 处理过程
1. **基础提取阶段**：横幅显示"AI 正在分析剧本，生成基础分镜..."
2. **匹配阶段**：横幅显示"正在智能匹配场景和角色..."
3. 进度条实时更新

### 完成后
1. 横幅变为绿色，显示"分镜生成完成"和分镜数量
2. 显示"查看并导入"按钮
3. 点击按钮打开预览对话框
4. 用户选择要导入的分镜
5. 导入成功后横幅自动隐藏

## 技术细节

### 任务状态检测逻辑

```typescript
// Banner组件中的复杂状态检测
const extractionJob = useMemo(() => {
  // 1. 优先查找正在处理的匹配任务
  const activeMatchingJob = activeJobs.find(...);
  if (activeMatchingJob) return activeMatchingJob;
  
  // 2. 查找正在处理的基础提取任务
  const activeBasicJob = activeJobs.find(...);
  if (activeBasicJob) return activeBasicJob;
  
  // 3. 查找父任务
  const activeParentJob = activeJobs.find(...);
  if (activeParentJob) return activeParentJob;
  
  // 4. 使用已完成但未处理的任务
  if (completedJob && !isDismissed) {
    return completedJob;
  }
  
  return null;
}, [activeJobs, completedJob, episodeId, isDismissed]);
```

### 定期状态更新

横幅组件使用 `setInterval` 定期检查任务状态（每5秒），确保即使websocket更新延迟，也能及时展示最新状态。

## 文件变更清单

1. **新建文件**：
   - `src/components/projects/storyboard/shot-extraction-banner.tsx` - 分镜提取横幅组件

2. **修改文件**：
   - `src/components/projects/storyboard/shot-grid.tsx` - 修复轮询逻辑
   - `src/components/projects/storyboard/storyboard-section.tsx` - 集成横幅组件
   - `src/lib/workers/job-processor.ts` - 更新父任务结果数据

## 测试建议

### 正常流程测试
1. 创建新剧集，添加剧本内容
2. 点击"AI提取分镜"
3. 观察横幅显示是否正确
4. 等待任务完成
5. 点击"查看并导入"
6. 选择分镜导入
7. 确认横幅自动隐藏

### 异常流程测试
1. 在任务处理中途刷新页面 - 横幅应该重新出现
2. 在基础提取完成后刷新页面 - 应该显示匹配任务状态
3. 任务失败时 - 横幅应显示红色错误状态

## 向后兼容性

修改保持了向后兼容：
- `shot-extraction-dialog.tsx` 已经支持多种数据格式
- 轮询逻辑增加了父任务检测，但不影响直接使用子任务ID的情况
- 类型定义中 `matchingJobId` 是可选字段

## 未来改进建议

1. **任务取消功能**：允许用户在处理过程中取消任务
2. **任务重试功能**：失败后一键重试
3. **进度估算**：更准确的进度百分比计算
4. **websocket优化**：减少轮询，更多依赖实时推送

