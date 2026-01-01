# 素材库刷新问题修复

## 问题描述

1. **生成中显示为失败**：任务明明是成功的，但素材库显示生成失败
2. **生成完毕后不刷新**：任务完成后，需要手动刷新才能看到正确的状态

## 根本原因

### 问题1：生成中显示为失败

**原因**：在 `asset-status.ts` 中，当资产刚创建时（还没有 videoUrl/imageUrl），如果查询不到关联的 job，就会被判定为 `'failed'`。

这可能发生在：
- Asset 和 Job 创建有时序差（虽然在同一个事务中，但查询可能在 Job 创建之前）
- 前端查询过快，Job 还未被 worker 拾取

**原始代码**：
```typescript
// 生成类资产但没有job
if (!latestJob) {
  // 如果有生成的文件，视为已完成
  if (asset.imageUrl || asset.videoUrl) {
    return 'completed';
  }
  // 否则视为失败（孤立资产）
  return 'failed';  // ❌ 问题：刚创建的资产也会被判定为失败
}
```

### 问题2：生成完毕后不刷新

**原因**：在 `use-task-refresh.ts` 中，任务第一次出现时就被标记为"已处理"，之后即使状态变化也不会再触发刷新。

任务状态流转：`pending` → `processing` → `completed`

**原始代码**：
```typescript
for (const job of jobs) {
  // 跳过已处理的任务
  if (!job.id || processedJobsRef.current.has(job.id)) {
    continue;  // ❌ 问题：一旦标记就永远跳过
  }
  
  // ... 检查策略和状态 ...
  
  // 标记为已处理
  processedJobsRef.current.add(job.id);  // ❌ 问题：在 pending 状态就标记了
  
  // ... 执行刷新 ...
}
```

当任务第一次出现（状态可能是 `pending`）时，就被加入 `processedJobsRef`，之后状态变为 `completed` 时，会在第一个 `if` 就跳过，不会触发刷新。

## 解决方案

### 修复1：优化资产状态计算

在 `src/lib/utils/asset-status.ts` 中，给刚创建的资产一个宽限期：

```typescript
// 生成类资产但没有job
if (!latestJob) {
  // 如果有生成的文件，视为已完成
  if (asset.imageUrl || asset.videoUrl) {
    return 'completed';
  }
  
  // 检查资产创建时间
  const assetAge = Date.now() - new Date(asset.createdAt).getTime();
  const fiveMinutes = 5 * 60 * 1000;
  
  // 如果是刚创建的（5分钟内），可能job还在创建中，视为pending
  if (assetAge < fiveMinutes) {
    return 'pending';  // ✅ 给新资产宽限期
  }
  
  // 创建时间较久但没有job和文件，视为失败（孤立资产）
  return 'failed';
}
```

**效果**：
- 刚创建的资产会显示为 `pending`（等待中），而不是 `failed`
- 5分钟后如果还没有 job 和文件，才判定为失败
- 避免了时序问题导致的误判

### 修复2：改用状态追踪而非处理标记

在 `src/hooks/use-task-refresh.ts` 中，追踪每个任务的状态变化：

```typescript
export function useTaskRefresh(callbacks: RefreshCallbacks) {
  const { jobs } = callbacks;
  // 追踪每个任务的最后状态（jobId -> status）
  const jobStatusMapRef = useRef<Map<string, string>>(new Map());  // ✅ 改用状态映射
  const refreshTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // ... 其他代码 ...

  useEffect(() => {
    const processJobs = async () => {
      for (const job of jobs) {
        if (!job.id) {
          continue;
        }

        // 获取任务的刷新策略
        const strategy = TASK_REFRESH_MAP[job.type || ""];
        if (!strategy) {
          continue;
        }

        // 检查任务状态是否匹配刷新条件
        if (!strategy.refreshOn.includes(job.status)) {
          continue;
        }

        // 获取上次记录的状态
        const lastStatus = jobStatusMapRef.current.get(job.id);
        
        // 如果状态没有变化，跳过（避免重复刷新）
        if (lastStatus === job.status) {
          continue;  // ✅ 只在状态变化时才处理
        }

        // 更新状态记录
        jobStatusMapRef.current.set(job.id, job.status);  // ✅ 记录新状态

        console.log(`[useTaskRefresh] 任务 ${job.id} 状态变化: ${lastStatus || '新任务'} -> ${job.status}`);

        // ... 执行刷新逻辑 ...
      }
    };

    processJobs();
    // ... 清理逻辑 ...
  }, [jobs]);
}
```

**效果**：
- 每次任务状态变化都会触发刷新
- `pending` → `processing`：触发一次刷新
- `processing` → `completed`：再触发一次刷新 ✅
- 避免重复刷新（状态未变化时跳过）

### 修复3：优化内存清理

```typescript
// 清理已完成任务的状态记录（避免内存泄漏）
useEffect(() => {
  // 每隔 5 分钟清理一次已完成任务的记录
  const cleanupInterval = setInterval(() => {
    const currentJobIds = new Set(jobs.map((job) => job.id).filter(Boolean));
    
    // 移除不在当前任务列表中的记录
    for (const [jobId] of jobStatusMapRef.current) {
      if (!currentJobIds.has(jobId)) {
        jobStatusMapRef.current.delete(jobId);
      }
    }

    console.log(`[useTaskRefresh] 清理状态记录，当前追踪 ${jobStatusMapRef.current.size} 个任务`);
  }, 5 * 60 * 1000);

  return () => clearInterval(cleanupInterval);
}, [jobs]);
```

## 测试验证

### 测试场景1：新建视频生成任务

**预期行为**：
1. Agent 调用 `generate_video_asset`
2. 创建 Asset 和 Job
3. 素材库立即显示该资产，状态为 `pending`（等待中）✅
4. Worker 开始处理，状态变为 `processing`（生成中）
5. 素材库自动刷新，显示进度 ✅
6. Worker 完成，状态变为 `completed`
7. 素材库自动刷新，显示完成状态和视频内容 ✅

**之前的问题**：
- 步骤3：可能显示为 `failed` ❌
- 步骤7：不会自动刷新，需要手动刷新 ❌

### 测试场景2：批量生成图片

**预期行为**：
1. Agent 批量创建多个图片资产
2. 每个资产创建后立即显示为 `pending`
3. Worker 逐个处理，每个完成时都会触发刷新
4. 素材库实时更新每个资产的状态

### 测试场景3：生成失败

**预期行为**：
1. 任务开始：`pending`
2. 处理中：`processing`
3. 失败：`failed`，显示错误信息
4. 每个状态变化都会触发素材库刷新

## 日志输出

修复后，控制台会输出状态变化日志：

```
[useTaskRefresh] 任务 job_abc123 状态变化: 新任务 -> pending
[useTaskRefresh] 任务 job_abc123 状态变化: pending -> processing
[useTaskRefresh] 任务 job_abc123 状态变化: processing -> completed
[useTaskRefresh] 清理状态记录，当前追踪 5 个任务
```

这有助于调试和验证修复效果。

## 相关文件

- `src/hooks/use-task-refresh.ts` - 任务刷新逻辑
- `src/lib/utils/asset-status.ts` - 资产状态计算
- `src/lib/db/queries/asset-with-status.ts` - 资产查询（已优化）
- `src/components/projects/editor/editing-mode/compact-asset-library.tsx` - 素材库UI

## 性能影响

- ✅ 减少不必要的刷新（状态未变化时跳过）
- ✅ 保持防抖机制（300ms/500ms）
- ✅ 定期清理内存（5分钟）
- ✅ 批量查询 job（已有优化）

## 总结

通过这两个修复：
1. **状态追踪代替处理标记**：确保每次状态变化都能触发刷新
2. **新资产宽限期**：避免时序问题导致的误判

彻底解决了"任务成功但显示失败"和"完成后不刷新"的问题。

