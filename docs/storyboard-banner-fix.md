# 分镜提取横幅显示修复

## 问题描述

用户反馈提取完分镜后，看不到分镜的预览和完成状态横幅。

## 问题原因

分析代码后发现问题出在 `storyboard-extraction-banner.tsx` 组件的 `matchingResult` 获取逻辑：

1. **横幅显示完成状态的条件**：
   - `extractionJob.status === "completed"`
   - `matchingResult` 存在（必须两个条件都满足）

2. **问题所在**：
   - `matchingResult` 只在 `activeJobs`（SSE 推送的活动任务列表）中查找匹配任务
   - 当匹配任务完成后，它可能已经不在 `activeJobs` 中了
   - 导致即使父任务完成，横幅也无法显示完成状态

## 解决方案

### 1. 添加本地状态存储匹配任务

```typescript
const [matchingJob, setMatchingJob] = useState<Job | null>(null);
```

### 2. 修改 `matchingResult` 查找逻辑

```typescript
const matchingResult = useMemo(() => {
  if (!extractionJob || extractionJob.type !== "storyboard_generation") return null;

  try {
    const parentResult = JSON.parse(extractionJob.resultData || "{}");
    const matchingJobId = parentResult.matchingJobId;

    if (matchingJobId) {
      // 先在活动任务中查找
      const activeMatchingJob = activeJobs.find((j) => j.id === matchingJobId);
      if (activeMatchingJob?.status === "completed" && activeMatchingJob.resultData) {
        return JSON.parse(activeMatchingJob.resultData) as StoryboardMatchingResult;
      }
      
      // 如果活动任务中没有，使用已加载的匹配任务
      if (matchingJob?.status === "completed" && matchingJob.resultData) {
        return JSON.parse(matchingJob.resultData) as StoryboardMatchingResult;
      }
    }
  } catch (error) {
    console.error("解析匹配结果失败:", error);
  }

  return null;
}, [extractionJob, activeJobs, matchingJob]);
```

### 3. 在加载完成任务时同时加载匹配任务

```typescript
const loadCompletedJob = async () => {
  try {
    const result = await getUserJobs({
      status: "completed",
      limit: 50, // 增加查询数量以包含匹配任务
    });

    if (result.success && result.jobs) {
      const allJobs = result.jobs as Job[];
      
      // 查找父任务
      const job = allJobs.find(
        (job) =>
          job.type === "storyboard_generation" &&
          job.inputData &&
          JSON.parse(job.inputData).episodeId === episodeId &&
          job.status === "completed" &&
          !job.isImported
      );

      if (job) {
        setCompletedJob(job);
        hasLoadedCompletedJob.current = true;
        
        // 尝试加载对应的匹配任务
        try {
          const parentResult = JSON.parse(job.resultData || "{}");
          const matchingJobId = parentResult.matchingJobId;
          
          if (matchingJobId) {
            const matching = allJobs.find((j) => j.id === matchingJobId);
            if (matching) {
              setMatchingJob(matching);
            }
          }
        } catch (error) {
          console.error("解析父任务结果失败:", error);
        }
      }
    }
  } catch (error) {
    console.error("加载已完成任务失败:", error);
  }
};
```

### 4. 更新关闭按钮逻辑

```typescript
const handleDismiss = () => {
  setIsDismissed(true);
  setCompletedJob(null);
  setMatchingJob(null); // 同时清除匹配任务
};
```

## 修改的文件

- `/src/components/projects/editor/preview-panel/storyboard-extraction-banner.tsx`

## 测试建议

1. 启动一个新的分镜提取任务
2. 等待任务完成（包括基础提取和匹配两个子任务）
3. 检查是否能看到绿色的完成横幅
4. 点击"查看并导入"按钮验证功能
5. 刷新页面后横幅应该还能正常显示

## 相关任务流程

```
storyboard_generation (父任务)
  └─> storyboard_basic_extraction (子任务1: AI 提取分镜)
       └─> storyboard_matching (子任务2: 匹配角色和场景)
```

只有当父任务和匹配任务都完成后，横幅才会显示完成状态。

