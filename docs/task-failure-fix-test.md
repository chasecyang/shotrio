# 任务失败处理修复 - 测试验证指南

## 修复内容

修复了后台任务执行出错时未立即标记为失败的问题。现在任务失败时会立即更新状态，而不是等待超时（60秒）。

## 修改的文件

1. **`src/workers/standalone-worker.ts`**
   - 在 `processJobAsync` 函数的 catch 块中添加了 `failJob` 调用
   - 任务执行失败时立即标记为 failed 状态

2. **`src/lib/workers/job-processor.ts`**
   - 优化错误处理逻辑，避免重复调用 `failJob`
   - 只在"未知任务类型"错误时调用 `failJob` 并不重新抛出
   - 其他错误重新抛出，由 worker 层统一处理

## 错误处理流程

```
standalone-worker (processJobAsync)
  └─> job-processor (processJob)
      └─> processor-registry (process)
          └─> 具体的 processor 函数

错误向上抛出：
  processor 失败 -> 抛出异常
  -> registry 不捕获，向上抛出
  -> job-processor 捕获
     ├─> 如果是"未知任务类型"：调用 failJob，不重新抛出
     └─> 其他错误：重新抛出
  -> standalone-worker 捕获并调用 failJob
```

## 测试场景

### 场景 1：视频生成失败（积分不足）

**测试步骤：**

1. 确保用户积分不足（少于生成视频所需的积分）
2. 创建一个视频生成任务
3. 观察任务状态变化

**预期结果：**
- 任务立即被标记为 `failed`
- 错误信息显示 "积分不足"
- 不需要等待 60 秒超时

**验证方法：**
```sql
-- 查看任务状态
SELECT id, status, error_message, created_at, completed_at 
FROM job 
WHERE type = 'shot_video_generation' 
ORDER BY created_at DESC 
LIMIT 5;
```

### 场景 2：图片生成失败（API 错误）

**测试步骤：**

1. 模拟 API 调用失败（可以暂时修改 API key 为无效值）
2. 创建一个图片生成任务
3. 观察任务状态和 Worker 日志

**预期结果：**
- 任务立即被标记为 `failed`
- Worker 日志显示：
  ```
  [Worker] ❌ 任务 xxx 处理失败 (耗时 X.XXs): [错误信息]
  [Worker] 📝 已将任务 xxx 标记为失败
  ```
- 积分被退还（如果已扣除）

**验证方法：**
```bash
# 查看 Worker 日志
npm run worker:dev

# 或查看 PM2 日志
pm2 logs worker
```

### 场景 3：未知任务类型

**测试步骤：**

1. 在数据库中手动创建一个不存在的任务类型
```sql
INSERT INTO job (id, user_id, project_id, type, status, input_data)
VALUES (gen_random_uuid(), '[user_id]', '[project_id]', 'unknown_task_type', 'pending', '{}');
```
2. 等待 Worker 拾取任务

**预期结果：**
- 任务立即被标记为 `failed`
- 错误信息显示 "未知的任务类型: unknown_task_type"
- Worker 日志只显示一次 failJob 调用（不会重复）

### 场景 4：配置数据不存在

**测试步骤：**

1. 创建一个视频生成任务，但 `videoConfigId` 指向不存在的记录
2. 观察任务状态变化

**预期结果：**
- 任务立即被标记为 `failed`
- 错误信息显示 "视频配置不存在"

## 性能对比

### 修复前
- 任务失败后保持 `processing` 状态
- 等待 60 秒后被超时检查标记为 `failed`
- 用户体验差，无法及时获知任务失败

### 修复后
- 任务失败后立即标记为 `failed`
- 失败响应时间从 60 秒减少到 < 1 秒
- 用户可以立即看到错误信息并采取行动

## 注意事项

1. **不会重复调用 failJob**
   - 只有"未知任务类型"错误在 `job-processor.ts` 中处理
   - 其他所有错误在 `standalone-worker.ts` 中统一处理

2. **积分退还机制不受影响**
   - processor 内部的积分退还逻辑仍然正常工作
   - 失败任务会在抛出异常前退还积分

3. **父子任务状态同步**
   - `failJob` 会自动更新父任务状态
   - 多个子任务失败时，父任务也会标记为失败

## 后续优化建议

1. **统一使用 BaseProcessor**
   - 将 `video-processors.ts` 和 `asset-image-generation.ts` 重构为继承 `BaseProcessor`
   - 可以获得更统一的错误处理、进度管理等功能

2. **添加重试机制**
   - 对于可恢复的错误（如网络超时），可以考虑自动重试
   - 需要在 processor 中区分可重试和不可重试的错误

3. **详细的错误分类**
   - 区分用户错误（如积分不足）和系统错误（如 API 失败）
   - 提供更友好的错误提示

## 快速测试命令

```bash
# 1. 启动 Worker（开发模式）
npm run worker:dev

# 2. 在另一个终端，启动应用
npm run dev

# 3. 触发一个会失败的任务（如积分不足时生成视频）
# 4. 观察 Worker 日志和数据库中的任务状态

# 5. 查看最近的任务状态
# 在数据库客户端执行：
SELECT 
  id, 
  type, 
  status, 
  progress,
  error_message,
  EXTRACT(EPOCH FROM (completed_at - created_at)) as duration_seconds,
  created_at,
  completed_at
FROM job 
WHERE status = 'failed'
ORDER BY created_at DESC 
LIMIT 10;
```

## 预期的 Worker 日志示例

### 成功的任务
```
[Worker] ▶️  开始处理任务 abc-123 (shot_video_generation)
[Worker] ✅ 任务 abc-123 处理完成 (耗时 45.32s)
```

### 失败的任务（修复后）
```
[Worker] ▶️  开始处理任务 def-456 (shot_video_generation)
[Worker] ❌ 任务 def-456 处理失败 (耗时 2.15s): Error: 积分不足
[Worker] 📝 已将任务 def-456 标记为失败
```

### 未知任务类型
```
[Worker] ▶️  开始处理任务 ghi-789 (unknown_type)
处理任务 ghi-789 失败: Error: 未知的任务类型: unknown_type
[Worker] ✅ 任务 ghi-789 处理完成 (耗时 0.05s)
```
注意：未知任务类型在 job-processor 层就被处理了，所以 worker 层不会看到异常。

