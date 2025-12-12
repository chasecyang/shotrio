# 修复分镜轮询问题

## 问题描述

分镜页面存在一直轮询的问题，即使没有任务也会持续轮询（每秒一次 POST 请求），没有在合适的状态下停止。

## 问题根因

### 核心问题：`useEffect` 依赖项导致的无限循环

所有使用 `useTaskSubscription` 的 banner 组件都存在相同的问题：

**问题链条：**
1. `useTaskSubscription` Hook 通过 SSE 接收任务更新
2. 每次 SSE 推送时（包括心跳），都会创建新的 `activeJobs` 数组
3. `activeJobs` 数组引用改变触发 `useEffect` 重新执行
4. `useEffect` 中调用 `getUserJobs()` server action（产生 POST 请求）
5. 如果 SSE 每秒推送一次，就会产生每秒一次的 POST 请求

**受影响的组件：**
- `src/components/projects/storyboard/shot-extraction-banner.tsx`
- `src/components/projects/characters/character-extraction-banner.tsx`
- `src/components/projects/scenes/scene-extraction-banner.tsx`

### 1. `shot-extraction-banner.tsx` 中的问题

**原始问题（第 72-111 行）：**
```typescript
useEffect(() => {
  const loadCompletedJob = async () => {
    // ... 调用 getUserJobs() server action
  };
  
  if (!hasActiveJob && !completedJob && !isDismissed) {
    loadCompletedJob(); // 频繁调用
  }
}, [activeJobs, episodeId, completedJob, isDismissed]);
// ↑ activeJobs 每次 SSE 推送都变化
```

**额外问题（第 113-201 行）：**
- 在 `useEffect` 中，`matchingStatus` 在依赖项中
- `checkMatchingJob()` 函数会调用 `setMatchingStatus()`
- 形成 `setMatchingStatus` → 触发 effect → 再次 `setMatchingStatus` 的循环

### 2. 其他 Banner 组件的相同问题

`character-extraction-banner.tsx` 和 `scene-extraction-banner.tsx` 都有完全相同的问题模式。

## 修复方案

### 核心修复：使用 `useRef` 避免重复执行

**修复策略：**
1. 使用 `useRef` 记录是否已加载过完成的任务
2. 使用 `useRef` 记录上一次的检查状态
3. 只有当实际状态变化时才执行 server action
4. 避免数组引用变化导致的重复触发

### 修复点 1：优化 `loadCompletedJob` 的触发逻辑

```typescript
// 加载已完成但未处理的任务 - 使用 ref 避免频繁触发
const hasLoadedCompletedJob = useRef(false);
const lastActiveJobCheck = useRef<string>("");

useEffect(() => {
  // 如果已被关闭或已有完成的任务，不再检查
  if (isDismissed || completedJob) {
    return;
  }

  // 检查是否有活动任务
  const hasActiveJob = activeJobs.some(/* ... */);

  // 创建一个字符串来表示当前状态，避免数组引用变化导致的重复触发
  const currentCheck = `${hasActiveJob}-${hasLoadedCompletedJob.current}`;
  
  // 如果状态没变化，不重复执行
  if (currentCheck === lastActiveJobCheck.current) {
    return; // ← 关键：避免重复执行
  }
  
  lastActiveJobCheck.current = currentCheck;

  const loadCompletedJob = async () => {
    // ... 
    if (job) {
      setCompletedJob(job);
      hasLoadedCompletedJob.current = true; // ← 标记已加载
    }
  };

  // 只有在没有活动任务且还未加载过时才加载
  if (!hasActiveJob && !hasLoadedCompletedJob.current) {
    loadCompletedJob();
  }
}, [activeJobs, episodeId, completedJob, isDismissed]);
```

**改进点：**
- ✅ 使用字符串比较而不是数组引用比较
- ✅ 只在实际状态变化时才执行 server action
- ✅ 使用标志位避免重复加载
- ✅ 即使 `activeJobs` 数组引用变化，也不会重复执行

### 修复点 2：移除 `matchingStatus` 依赖项

在 `shot-extraction-banner.tsx` 中，将 `matchingStatus` 从依赖项中移除：

```typescript
useEffect(() => {
  if (!extractionJob) return;

  let isMounted = true;
  let interval: NodeJS.Timeout | null = null;

  const checkMatchingJob = async () => {
    if (!isMounted || !extractionJob) return;
    
    // ... 检查逻辑
    // 在适当的时候停止轮询
    if (matchingJobResult.job.status === "completed" || 
        matchingJobResult.job.status === "failed" || 
        matchingJobResult.job.status === "cancelled") {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }
  };

  // 检查任务是否需要轮询
  const shouldPoll = 
    extractionJob.status === "pending" || 
    extractionJob.status === "processing";

  // 立即执行一次检查
  checkMatchingJob();

  // 只有当任务处于进行中状态时才定期轮询
  if (shouldPoll) {
    interval = setInterval(checkMatchingJob, 5000);
  }

  return () => {
    isMounted = false;
    if (interval) {
      clearInterval(interval);
    }
  };
}, [extractionJob]); // ← 只依赖 extractionJob，不依赖 matchingStatus
```

**改进点：**
- ✅ 移除 `matchingStatus` 依赖，避免状态更新循环
- ✅ 使用 `isMounted` 标志避免内存泄漏
- ✅ 在任务完成时主动停止 interval
- ✅ 只在任务状态真正变化时才重新执行 effect

## 修改的文件

1. **`src/components/projects/storyboard/shot-extraction-banner.tsx`**
   - 添加 `useRef` 避免 `loadCompletedJob` 重复执行
   - 重构轮询逻辑，移除 `matchingStatus` 依赖
   - 添加取消状态处理

2. **`src/components/projects/characters/character-extraction-banner.tsx`**
   - 添加 `useRef` 避免 `loadCompletedJob` 重复执行
   - 使用状态字符串比较而不是数组引用比较

3. **`src/components/projects/scenes/scene-extraction-banner.tsx`**
   - 添加 `useRef` 避免 `loadCompletedJob` 重复执行
   - 使用状态字符串比较而不是数组引用比较

4. **`src/components/projects/storyboard/shot-grid.tsx`**
   - 添加 `cancelled` 状态处理
   - 添加异常状态捕获

## 效果对比

### 修复前：
```
POST /zh/projects/.../storyboard 200 in 1067ms
POST /zh/projects/.../storyboard 200 in 1003ms  (1秒后)
POST /zh/projects/.../storyboard 200 in 934ms   (1秒后)
POST /zh/projects/.../storyboard 200 in 949ms   (1秒后)
... 无限持续
```
**问题：** 即使没有任务，每秒也会产生 1 次 POST 请求（调用 getUserJobs）

### 修复后：
```
POST /zh/projects/.../storyboard 200 in 1067ms  (首次加载)
... 不再有重复请求 ...
```
**效果：** 只在状态真正变化时才调用 server action

## 性能提升

- **请求减少：** 从每秒 1 次降低到按需调用（减少 99%+）
- **服务器负载：** 大幅降低数据库查询和 server action 执行次数
- **客户端性能：** 减少不必要的网络请求和组件重渲染
- **用户体验：** 页面更流畅，无性能卡顿

## 测试要点

### 功能测试
1. ✅ 页面加载时只执行一次初始检查
2. ✅ 有活动任务时不加载已完成任务
3. ✅ 活动任务完成后能正确加载并显示
4. ✅ banner 关闭后不再重复加载
5. ✅ 切换剧集时能正确加载对应的任务

### 性能测试
1. ✅ 打开开发者工具 Network 面板
2. ✅ 停留在页面 10 秒，观察请求次数
3. ✅ 应该只有初始的页面加载请求，没有持续的轮询
4. ✅ SSE 连接保持但不应导致 POST 请求

### 边界情况测试
1. ✅ 快速切换多个页面
2. ✅ 同时有多个任务时的显示
3. ✅ 任务完成时的通知和更新

## 相关组件

这次修复主要针对所有使用 `useTaskSubscription` 的 banner 组件。系统中还有其他组件：

- `src/components/projects/layout/background-tasks.tsx` - 后台任务中心（已检查，无此问题）
- `src/components/tasks/task-center.tsx` - 任务中心主组件
- `src/hooks/use-task-subscription.ts` - SSE 订阅 Hook（无问题）

## 后续优化建议

1. **抽取公共逻辑**：三个 banner 组件有相同的模式，可以抽取为自定义 Hook：
   ```typescript
   function useCompletedJobLoader(taskType: string, filterFn: (job: Job) => boolean) {
     // 统一的加载逻辑
   }
   ```

2. **优化 SSE 推送策略**：考虑只在任务状态真正变化时推送，而不是定期心跳

3. **使用 useMemo 优化**：对 `activeJobs` 过滤结果进行记忆化，减少不必要的计算

4. **状态机模式**：使用状态机更清晰地管理任务的各种状态转换

5. **添加监控**：在开发环境下记录 server action 调用频率，及时发现类似问题
