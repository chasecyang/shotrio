# 任务重复执行问题修复

## 问题描述

在生成分镜图片时，发现角色图片生成任务（`character_image_generation`）被重复执行。Worker 日志显示同样的任务 ID 在多次轮询中被反复获取和处理。

**问题症状：**
```
[Worker] 发现 2 个待处理任务，当前并发: 2/5
[Worker] ▶️  开始处理任务 033eb576-9d79-4b34-82da-e21a8f68989f (character_image_generation)
[Worker] ▶️  开始处理任务 5ec5168a-d9fd-493b-97ec-5d7b422d4ddc (character_image_generation)

[Worker] 发现 2 个待处理任务，当前并发: 2/5
[Worker] ▶️  开始处理任务 033eb576-9d79-4b34-82da-e21a8f68989f (character_image_generation)
[Worker] ▶️  开始处理任务 5ec5168a-d9fd-493b-97ec-5d7b422d4ddc (character_image_generation)
```

## 根本原因

任务处理流程中**缺少状态标记**：

1. `getPendingJobs()` 从数据库查询 `status = 'pending'` 的任务
2. Worker 开始处理任务
3. **但任务状态仍然是 `pending`（没有更新为 `processing`）**
4. 下次轮询（2秒后）时，同样的任务又被获取
5. 导致任务被重复执行

虽然 `getPendingJobs()` 使用了 `FOR UPDATE SKIP LOCKED` 来避免并发冲突，但这只在事务内有效。查询完成后锁被释放，下次轮询又能获取到相同的任务。

## 解决方案

**统一在 `processor-registry` 中标记任务状态：**

在 `ProcessorRegistry.process()` 方法中，在调用处理器之前先调用 `startJob()` 将任务状态更新为 `processing`。

## 修改内容

### 1. `src/lib/workers/processor-registry.ts`

**添加：**
- 导入 `startJob` 函数
- 在 `process()` 方法中，调用处理器前先标记任务为 `processing`

```typescript
async process(job: Job, workerToken: string): Promise<void> {
  const processor = this.processors.get(job.type);
  
  if (!processor) {
    throw new Error(`未知的任务类型: ${job.type}`);
  }

  // 在开始处理前，先将任务状态标记为 processing
  // 这样可以防止任务被重复获取和执行
  await startJob(job.id, workerToken);

  return processor(job, workerToken);
}
```

### 2. `src/lib/workers/base-processor.ts`

**移除：**
- 从 `execute()` 方法中移除 `startJob()` 调用（避免重复调用）
- 移除 `startJob` 的导入

**原因：** 统一由 `processor-registry` 处理状态标记，避免重复调用。

### 3. `src/lib/workers/processors/video-processors.ts`

**移除：**
- 从以下三个函数中移除 `startJob()` 调用：
  - `processShotVideoGeneration()`
  - `processBatchVideoGeneration()`
  - `processFinalVideoExport()`
- 移除 `startJob` 的导入

**原因：** 这些处理器之前手动调用了 `startJob`，现在统一由 `processor-registry` 处理。

## 执行流程（修复后）

```
1. Worker 轮询 → getPendingJobs() → 获取 pending 任务
2. Worker 调用 → ProcessorRegistry.process()
3. ProcessorRegistry.process() → startJob() → 标记任务为 processing ✅
4. ProcessorRegistry.process() → processor() → 执行具体业务逻辑
5. Processor → completeJob() 或 failJob() → 标记任务完成/失败
```

**关键改进：** 任务在步骤 3 就被标记为 `processing`，下次轮询不会再获取到该任务。

## 预期效果

修复后，每个任务只会被处理一次：
- 任务被获取后立即标记为 `processing`
- 下次轮询不会再获取到已处理的任务
- 避免资源浪费和重复操作

## 测试建议

1. 重启 Worker：`npm run worker:dev`
2. 触发分镜图片生成任务
3. 观察日志，确认每个任务只被处理一次
4. 检查数据库中任务状态变化：`pending` → `processing` → `completed`

## 相关文件

- `src/lib/workers/processor-registry.ts` - 处理器注册表（统一状态管理）
- `src/lib/workers/base-processor.ts` - 基础处理器
- `src/lib/workers/processors/video-processors.ts` - 视频处理器
- `src/lib/actions/job/worker-operations.ts` - Worker 操作（`startJob`, `getPendingJobs`）
- `src/workers/standalone-worker.ts` - Worker 主进程

## 架构改进

通过这次修复，建立了更清晰的职责分工：

- **`processor-registry`**：负责任务生命周期管理（状态标记）
- **Processor**：只负责具体业务逻辑
- **Worker**：负责任务调度和并发控制

这样的设计更加统一、清晰、易维护。

