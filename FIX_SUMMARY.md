# 视频生成失败状态显示问题修复总结

## 问题描述
用户反馈：视频生成失败时，素材仍然显示为"生成中"状态，没有显示失败信息，也看不到进度条。

## 根本原因分析

### 1. 素材状态更新问题
- **Worker 错误处理不完善**：在某些失败场景下（如上传失败），素材状态没有正确更新为 `"failed"`
- **缺少统一的错误处理**：图片生成处理器缺少顶层错误捕获

### 2. 前端素材列表刷新问题（主要问题）
- **`use-task-refresh.ts` 配置不当**：
  ```typescript
  // 修改前
  video_generation: {
    type: "video",  // ❌ 错误：应该是 "asset"
    refreshOn: ["completed"],  // ❌ 错误：只在完成时刷新，processing 和 failed 时不刷新
  }
  ```
  
  **影响**：
  - Job 状态变为 `processing` 时，前端素材列表不刷新
  - Job 失败时，前端素材列表不刷新
  - 导致前端看到的 `asset.status` 一直是旧的 `"pending"`
  - 即使 `useTaskPolling` 获取到了 job 数据，由于 asset 状态未更新，用户体验不佳

## 修复方案

### 1. 增强 Worker 错误处理

#### video-processors.ts
```typescript
// 1. 上传失败时的处理
if (!uploadResult.success || !uploadResult.url) {
  // 退还积分
  if (transactionId) {
    await refundCredits({ ... });
  }
  
  // 更新 asset 状态为失败
  await db.update(asset).set({
    status: "failed",
    errorMessage: `上传视频失败: ${uploadResult.error || '未知错误'}`,
  }).where(eq(asset.id, assetId));
  
  throw new Error(...);
}

// 2. 统一的错误处理（catch 块）
catch (error) {
  // 添加详细日志
  console.log(`[Worker] 正在更新 Asset ${assetId} 状态为 failed...`);
  
  // 使用 returning() 确认更新结果
  const updateResult = await db.update(asset).set({
    status: "failed",
    errorMessage: errorMessage,
  }).where(eq(asset.id, assetId)).returning();
  
  console.log(`[Worker] Asset ${assetId} 状态已更新为 failed`, updateResult);
}
```

#### asset-image-generation.ts
```typescript
// 添加顶层错误处理包装
export async function processAssetImageGeneration(...) {
  try {
    await processAssetImageGenerationInternal(...);
  } catch (error) {
    // 确保所有错误都会更新素材状态
    await db.update(asset).set({
      status: "failed",
      errorMessage: ...,
    }).where(eq(asset.id, assetId));
    
    throw error;
  }
}
```

### 2. 修复前端刷新逻辑

#### use-task-refresh.ts
```typescript
const TASK_REFRESH_MAP: Record<string, RefreshStrategy> = {
  asset_image_generation: {
    type: "asset",  // ✅ 正确
    refreshOn: ["processing", "completed", "failed"],  // ✅ 覆盖所有关键状态
    debounce: 500,  // ✅ 防抖，避免过于频繁
  },

  video_generation: {
    type: "asset",  // ✅ 修改：从 "video" 改为 "asset"
    refreshOn: ["processing", "completed", "failed"],  // ✅ 修改：添加 processing 和 failed
    debounce: 500,  // ✅ 新增：防抖
  },
};
```

**效果**：
- Job 状态变为 `processing` 时 → 刷新素材列表 → 前端获取到最新的 `asset.status = "processing"`
- Job 失败时 → 刷新素材列表 → 前端获取到 `asset.status = "failed"`
- 500ms 防抖避免过于频繁的刷新

## 数据流程（修复后）

### 正常流程
1. 用户创建视频 → `asset.status = "pending"`, `job.status = "pending"`
2. Worker 获取任务 → `job.status = "processing"`
3. **🆕 useTaskRefresh 检测到 job 进入 processing → 触发素材列表刷新**
4. Worker 更新素材 → `asset.status = "processing"`
5. **🆕 前端获取到最新的 asset 数据 → 显示进度条**
6. Worker 完成 → `asset.status = "completed"`, `job.status = "completed"`
7. **🆕 useTaskRefresh 检测到 job 完成 → 再次刷新素材列表**
8. 前端显示完成状态

### 失败流程
1. 用户创建视频 → `asset.status = "pending"`, `job.status = "pending"`
2. Worker 获取任务 → `job.status = "processing"`
3. **🆕 useTaskRefresh 触发刷新 → 前端获取到 processing 状态**
4. Worker 遇到错误 → 更新 `asset.status = "failed"` → `job.status = "failed"`
5. **🆕 useTaskRefresh 检测到 job 失败 → 触发刷新**
6. **🆕 前端获取到 `asset.status = "failed"` → 显示失败状态**

## 相关组件说明

### AssetProgressOverlay 显示逻辑
```typescript
// 1. 失败状态：优先显示
if (asset?.status === "failed") {
  return <失败覆盖层>;
}

// 2. 无 job 或已完成：不显示
if (!job || job.status === "completed" || job.status === "cancelled") {
  return null;
}

// 3. 其他情况：显示进度条
return <进度条>;
```

### AssetCard 使用逻辑
```typescript
const isGenerating = asset.status === "processing" || asset.status === "pending";

{isGenerating ? (
  <>
    <AssetThumbnailSkeleton />
    <AssetProgressOverlay job={job} asset={asset} />
  </>
) : ...}
```

## 测试验证

### 测试场景 1：正常生成
1. 创建视频素材
2. ✅ 应该立即看到骨架屏
3. ✅ 5秒内（useTaskPolling 轮询间隔）应该看到进度条（0%）
4. ✅ 进度条应该逐渐增长
5. ✅ 完成后显示视频缩略图

### 测试场景 2：生成失败
1. 创建视频素材（使用会导致失败的配置）
2. ✅ 应该看到骨架屏
3. ✅ 5秒内应该看到进度条
4. ✅ 失败后应该显示失败状态（红色警告图标 + 错误信息）
5. ✅ 不应该一直显示"生成中"

### 测试场景 3：快速失败
1. 创建视频素材（参数错误导致立即失败）
2. ✅ 应该快速显示失败状态
3. ✅ 不应该卡在"生成中"状态

## 技术要点

### 1. 为什么需要刷新素材列表？
- `useTaskPolling` 只获取 **job** 数据（状态、进度等）
- `AssetPanel` 的素材列表是独立获取的（通过 `queryAssets`）
- 如果不刷新素材列表，前端的 `asset.status` 会一直是旧值
- 虽然有 job 数据，但 UI 依赖 `asset.status` 来决定显示逻辑

### 2. 为什么不能只依赖 job 状态？
- `asset.status` 是素材的持久化状态，存储在数据库中
- `job.status` 是临时的任务状态，任务完成后可能被清理
- 失败的素材需要永久标记为 "failed"，而不是依赖临时的 job 数据

### 3. processedJobsRef 的作用
- `useTaskRefresh` 使用 `processedJobsRef` 记录已处理的 job
- 每个 job 在每个状态下只会触发一次刷新
- 避免同一个 job 重复触发刷新

## 潜在问题和改进

### 问题 1：首次创建时的延迟
- 素材创建后，需要等待 useTaskPolling 轮询（5秒）才能获取到 job
- **改进建议**：创建素材后立即触发一次 `refreshJobs()`

### 问题 2：刷新频率
- 当前配置下，每个 job 在 processing、completed、failed 状态各刷新一次
- 如果有多个任务同时进行，可能导致频繁刷新
- **当前缓解措施**：500ms 防抖

### 问题 3：状态同步
- Asset 状态和 Job 状态的更新不是原子性的
- 可能存在短暂的不一致
- **当前方案**：通过定期轮询最终达到一致性

## 文件修改清单

1. ✅ `src/lib/workers/processors/video-processors.ts`
   - 增强上传失败处理
   - 增强错误处理日志
   - 确保所有失败路径都更新素材状态

2. ✅ `src/lib/workers/processors/asset-image-generation.ts`
   - 添加顶层错误处理包装
   - 增强失败状态更新
   - 添加上传失败时的状态更新

3. ✅ `src/hooks/use-task-refresh.ts`
   - 修改 `video_generation` 的 type 为 "asset"
   - 修改 refreshOn 为 ["processing", "completed", "failed"]
   - 添加 500ms 防抖
   - 同步修改 `asset_image_generation` 配置

## 验证要点

### 开发者验证
```bash
# 1. 查看 Worker 日志
npm run worker:dev

# 2. 观察关键日志
- "[Worker] 正在更新 Asset xxx 状态为 failed..."
- "[Worker] Asset xxx 状态已更新为 failed"
- "[Worker] 视频生成完成: Asset xxx"

# 3. 检查数据库
# 素材状态应该正确更新为 failed/completed
SELECT id, name, status, error_message FROM asset WHERE asset_type = 'video' ORDER BY created_at DESC LIMIT 10;
```

### 用户验证
1. ✅ 创建视频后能看到进度条
2. ✅ 生成失败能看到失败提示
3. ✅ 不会卡在"生成中"状态
4. ✅ 失败后显示错误信息

