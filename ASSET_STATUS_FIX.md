# Asset 状态字段移除后的代码修复总结

## 问题描述

用户反馈：**图片正常生成过程中，会被判断为生成失败**

## 根本原因

数据库 Schema 已经移除了 `asset.status` 和 `asset.errorMessage` 字段（见 `src/lib/db/schemas/project.ts` 第163-166行），状态现在完全从关联的 job 动态计算。但是 Worker 处理器代码中仍然在尝试更新这些不存在的字段，导致：

1. **数据库更新可能静默失败或抛出异常**
2. **正常的生成过程可能被错误地标记为失败**
3. **状态不一致问题**

## 修复内容

### 1. `src/lib/workers/processors/asset-image-generation.ts`

**第 212-239 行**：移除了图片生成失败时对 `asset.status` 和 `asset.errorMessage` 的更新

```typescript
// ❌ 修复前：试图更新不存在的字段
await db
  .update(asset)
  .set({
    status: "failed",
    errorMessage: error instanceof Error ? error.message : "生成失败",
  })
  .where(eq(asset.id, assetId));

// ✅ 修复后：只抛出异常，让外层job处理器标记job为failed
// 注意：不再手动更新asset状态，状态从job自动计算
// job会在外层被标记为failed，asset状态会自动反映失败
throw error;
```

### 2. `src/lib/workers/processors/video-processors.ts`

**第 129-164 行**：移除了 Kling O1 API 调用失败时对 `asset.status` 的更新

```typescript
// ❌ 修复前
await db
  .update(asset)
  .set({
    status: "failed",
    errorMessage: error instanceof Error ? error.message : "生成失败",
  })
  .where(eq(asset.id, assetId));

// ✅ 修复后：只退还积分和抛出异常
// 注意：不再手动更新asset状态，状态从job自动计算
```

**第 78-81 行**：移除了开始处理时对 `asset.status = "processing"` 的更新

```typescript
// ❌ 修复前
await db.update(asset)
  .set({ status: "processing" })
  .where(eq(asset.id, assetId));

// ✅ 修复后：完全移除
// 注意：不需要手动更新asset状态为processing
// 状态从关联的job动态计算，job已经在startJob时被设置为processing
```

**第 188-214 行**：移除了视频上传失败时对 `asset.status` 的更新

```typescript
// ❌ 修复前
await db
  .update(asset)
  .set({
    status: "failed",
    errorMessage: `上传视频失败: ${uploadResult.error || '未知错误'}`,
  })
  .where(eq(asset.id, assetId));

// ✅ 修复后：只退还积分和抛出异常
// 注意：不再手动更新asset状态，状态从job自动计算
```

## 正确的状态管理流程

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Asset 状态架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Asset 表（数据库）                                          │
│  ├─ imageUrl / videoUrl  ← 实际内容                         │
│  ├─ prompt, meta, etc    ← 元数据                           │
│  └─ ❌ status (已移除)                                       │
│                                                              │
│  Job 表（数据库）                                            │
│  ├─ status: pending/processing/completed/failed             │
│  ├─ errorMessage                                            │
│  └─ inputData: { assetId }  ← 关联到 Asset                  │
│                                                              │
│  运行时计算（查询时）                                        │
│  └─ AssetWithRuntimeStatus                                  │
│      ├─ runtimeStatus ← 从 job.status 计算得出              │
│      └─ errorMessage  ← 从 job.errorMessage 获取            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 状态计算规则

见 `src/lib/utils/asset-status.ts` 中的 `calculateAssetStatus` 函数：

1. **上传的资产**（`sourceType='uploaded'`）→ 直接返回 `'completed'`
2. **生成的资产**（`sourceType='generated'`）：
   - 有关联 job → 从 `job.status` 映射得到
   - 无 job 但有文件 URL → 视为 `'completed'`
   - 无 job 且无文件 URL → 视为 `'failed'`（孤立资产）

### Worker 处理器的职责

**✅ 应该做的：**
- 更新 asset 的实际内容（imageUrl, videoUrl, duration 等）
- 更新 job 的状态和进度
- 处理积分扣除和退还
- 抛出异常让外层处理

**❌ 不应该做的：**
- ~~直接更新 asset.status~~（字段已不存在）
- ~~直接更新 asset.errorMessage~~（字段已不存在）
- ~~手动同步 asset 和 job 的状态~~（自动计算）

### 错误处理流程

```typescript
// Worker 处理器内部
try {
  // 1. 调用 API 生成内容
  const result = await generateXXX(...);
  
  // 2. 上传到存储
  const uploadResult = await uploadXXX(...);
  
  // 3. 更新 asset 的实际内容（不更新状态）
  await db.update(asset).set({
    imageUrl: uploadResult.url,
    // 注意：不设置 status
  }).where(eq(asset.id, assetId));
  
  // 4. 完成 job
  await completeJob({ jobId, resultData }, workerToken);
  // → job.status = "completed"
  // → asset.runtimeStatus 自动计算为 "completed"
  
} catch (error) {
  // 5. 退还积分（如果已扣除）
  await refundCredits(...);
  
  // 6. 抛出异常
  throw error;
  // → 外层捕获并调用 failJob()
  // → job.status = "failed"
  // → asset.runtimeStatus 自动计算为 "failed"
}
```

## 验证要点

### 1. 数据库检查

```sql
-- 确认 asset 表没有 status 和 error_message 字段
\d asset

-- 查看最近的资产和关联的 job
SELECT 
  a.id as asset_id,
  a.name,
  a.image_url IS NOT NULL as has_image,
  j.status as job_status,
  j.error_message as job_error
FROM asset a
LEFT JOIN job j ON (j.input_data::jsonb->>'assetId') = a.id
WHERE a.created_at > NOW() - INTERVAL '1 hour'
ORDER BY a.created_at DESC;
```

### 2. 前端验证

- ✅ 创建资产后能看到 "pending" 状态
- ✅ 生成开始后能看到 "processing" 状态和进度条
- ✅ 生成成功后能看到 "completed" 状态和内容
- ✅ 生成失败后能看到 "failed" 状态和错误信息
- ✅ 不会出现"正常生成被判断为失败"的问题

### 3. Worker 日志检查

```bash
# 启动 Worker
npm run worker:dev

# 观察日志，应该不再看到：
# ❌ "[Worker] 正在更新 Asset xxx 状态为 failed..."
# ❌ "[Worker] Asset xxx 状态已更新为 failed"

# 应该看到正常的流程：
# ✅ "[Worker] 开始生成图片/视频: Asset xxx"
# ✅ "[Worker] 图片/视频生成完成: Asset xxx"
# ✅ "[Worker] ✅ 任务 xxx 处理完成"
```

## 相关文件

- ✅ `src/lib/db/schemas/project.ts` - Schema 定义（已移除 status 字段）
- ✅ `src/lib/utils/asset-status.ts` - 状态计算逻辑
- ✅ `src/lib/db/queries/asset-with-status.ts` - 查询时附加运行时状态
- ✅ `src/lib/workers/processors/asset-image-generation.ts` - 图片生成处理器（已修复）
- ✅ `src/lib/workers/processors/video-processors.ts` - 视频生成处理器（已修复）
- ✅ `src/hooks/use-task-refresh.ts` - 前端刷新逻辑（已正确配置）

## 修复时间

2025-12-31

## 修复人员

AI Assistant (Claude Sonnet 4.5)

