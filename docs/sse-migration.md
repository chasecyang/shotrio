# 分镜页面轮询改造为 SSE 方案

## 改造日期
2025-12-12

## 改造背景

分镜页面原本使用客户端轮询（`setTimeout` + `getJobStatus`）来检查任务状态，存在以下问题：
- 每个组件独立轮询，造成重复请求
- 轮询间隔固定为 5 秒，实时性差
- 服务器负载高，每个轮询都要查询数据库
- 代码复杂，需要处理清理、重试等逻辑

## 改造方案

**完全切换到 SSE（Server-Sent Events）方案**，统一通过 SSE 推送任务状态更新。

## 改造内容

### 1. 修改 `shot-grid.tsx`

#### 添加 SSE 订阅
```typescript
// 使用 SSE 订阅任务更新
const { jobs: activeJobs } = useTaskSubscription();

// 用于防止重复 toast 的标记
const toastShownRef = useRef<Record<string, boolean>>({});
```

#### 移除轮询函数
删除了 `pollJobStatus` 函数（约 107 行代码），包括：
- `setTimeout` 轮询逻辑
- `maxAttempts` 重试逻辑
- 手动调用 `getJobStatus` 的代码
- 复杂的嵌套任务状态检查

#### 使用 useEffect 监听 SSE 推送
**监听主提取任务：**
```typescript
useEffect(() => {
  if (!extractionJobId) return;

  const mainJob = activeJobs.find(j => j.id === extractionJobId);
  if (!mainJob) return;

  // 处理主任务完成 - 获取匹配任务ID
  if (mainJob.status === "completed" && mainJob.resultData && !matchingJobId) {
    try {
      const resultData = JSON.parse(mainJob.resultData);
      const newMatchingJobId = resultData.matchingJobId;
      
      if (newMatchingJobId) {
        setMatchingJobId(newMatchingJobId);
        console.log("基础提取完成，开始角色场景匹配:", newMatchingJobId);
      }
    } catch (error) {
      console.error("解析任务结果失败:", error);
    }
  }

  // 处理主任务失败或取消
  if (mainJob.status === "failed") {
    // 使用 ref 防止重复 toast
    const toastKey = `failed-${extractionJobId}`;
    if (!toastShownRef.current[toastKey]) {
      toast.error(mainJob.errorMessage || "分镜提取失败");
      toastShownRef.current[toastKey] = true;
      setIsExtracting(false);
    }
  } else if (mainJob.status === "cancelled") {
    const toastKey = `cancelled-${extractionJobId}`;
    if (!toastShownRef.current[toastKey]) {
      toast.error("任务已被取消");
      toastShownRef.current[toastKey] = true;
      setIsExtracting(false);
    }
  }
}, [activeJobs, extractionJobId, matchingJobId]);
```

**监听匹配任务：**
```typescript
useEffect(() => {
  if (!matchingJobId) return;

  const matchingJob = activeJobs.find(j => j.id === matchingJobId);
  if (!matchingJob) return;

  if (matchingJob.status === "completed") {
    const toastKey = `completed-${matchingJobId}`;
    if (!toastShownRef.current[toastKey]) {
      toast.success("AI分镜生成完成！");
      toastShownRef.current[toastKey] = true;
      setIsExtracting(false);
      setShowExtractionDialog(true);
    }
  } else if (matchingJob.status === "failed") {
    // ... 类似处理
  } else if (matchingJob.status === "cancelled") {
    // ... 类似处理
  }
}, [activeJobs, matchingJobId]);
```

### 2. 优化 SSE 推送逻辑（`/api/tasks/stream/route.ts`）

#### 推送最近完成的任务
原本 SSE 只推送活跃任务（pending/processing），现在也推送最近 5 分钟内完成的任务：

```typescript
// 查询活跃任务（pending 或 processing）
const activeJobs = await db.query.job.findMany({
  where: and(
    eq(job.userId, userId),
    or(eq(job.status, "pending"), eq(job.status, "processing"))
  ),
  orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
  limit: 20,
});

// 同时查询最近完成的任务（最近5分钟内完成的）
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
const recentCompletedJobs = await db.query.job.findMany({
  where: and(
    eq(job.userId, userId),
    or(
      eq(job.status, "completed"),
      eq(job.status, "failed"),
      eq(job.status, "cancelled")
    ),
  ),
  orderBy: (jobs, { desc }) => [desc(jobs.updatedAt)],
  limit: 10,
}).then(jobs => 
  jobs.filter(j => j.updatedAt && new Date(j.updatedAt) > fiveMinutesAgo)
);

// 合并活跃任务和最近完成的任务
const allJobs = [...activeJobs, ...recentCompletedJobs];
```

#### 添加 resultData 字段
在 SSE 推送的数据中添加 `resultData` 字段，用于获取任务结果（如匹配任务ID）：

```typescript
jobs: allJobs.map((j) => ({
  id: j.id,
  projectId: j.projectId,
  type: j.type,
  status: j.status,
  progress: j.progress,
  currentStep: j.currentStep,
  totalSteps: j.totalSteps,
  progressMessage: j.progressMessage,
  errorMessage: j.errorMessage,
  resultData: j.resultData,  // ← 新增
  createdAt: j.createdAt,
  startedAt: j.startedAt,
  updatedAt: j.updatedAt,
}))
```

## 改造效果

### 优点对比

| 方面 | 原轮询方案 | SSE 方案 |
|------|-----------|----------|
| **实时性** | 5秒延迟 | 2秒实时推送 |
| **服务器负载** | 每个组件独立轮询 | 统一 SSE 推送 |
| **代码复杂度** | 每个组件写轮询逻辑（107行） | 简单的 useEffect（40行） |
| **连接数** | N 个轮询请求 | 1 个 SSE 连接 |
| **可维护性** | 分散在各组件 | 集中在 SSE 端点 |

### 性能提升

- **请求减少**：从多个独立 5 秒轮询 → 单一 2 秒 SSE 推送
- **代码减少**：删除 107 行轮询代码，新增 40 行 SSE 监听
- **实时性提升**：5秒延迟 → 2秒推送（提升 60%）
- **服务器负载降低**：多个轮询请求 → 单一推送

## 测试要点

### 功能测试
1. ✅ 点击 "AI提取分镜" 按钮
2. ✅ 任务创建成功，显示 "正在处理" 状态
3. ✅ 等待任务完成（基础提取 → 匹配）
4. ✅ 收到 "AI分镜生成完成！" 提示
5. ✅ 自动打开预览对话框

### 异常测试
1. ✅ 任务失败时显示错误信息
2. ✅ 任务取消时显示取消提示
3. ✅ 不会重复显示 toast
4. ✅ 切换页面后返回，状态正确

### 性能测试
1. ✅ 打开开发者工具 Network 面板
2. ✅ 观察请求：应该只有 1 个 SSE 连接，没有轮询请求
3. ✅ 任务完成时，2秒内收到推送

## 修改的文件

1. **`src/components/projects/storyboard/shot-grid.tsx`**
   - 添加 `useTaskSubscription` Hook
   - 删除 `pollJobStatus` 函数（107行）
   - 添加 2 个 `useEffect` 监听 SSE 推送（40行）
   - 添加 `toastShownRef` 防止重复提示
   - 新增 `matchingJobId` 状态管理

2. **`src/app/api/tasks/stream/route.ts`**
   - 添加最近完成任务的查询逻辑
   - 添加 `resultData` 字段到推送数据
   - 过滤最近 5 分钟内完成的任务

## 架构优势

### 统一的任务状态管理
所有任务状态通过 SSE 统一推送，无需每个组件自己轮询：
- `BackgroundTasks` 组件使用 SSE
- `ShotGrid` 组件使用 SSE
- 其他 Banner 组件可以使用 SSE（待优化）

### 可扩展性
未来新增任务类型时，只需：
1. 在组件中使用 `useTaskSubscription`
2. 用 `useEffect` 监听任务状态
3. 无需写任何轮询逻辑

## 后续优化建议

1. **其他 Banner 组件迁移**：
   - `character-extraction-banner.tsx`
   - `scene-extraction-banner.tsx`
   - `shot-extraction-banner.tsx`
   都可以使用类似方案移除轮询逻辑

2. **优化 SSE 推送频率**：
   考虑在任务状态真正变化时立即推送，而不是固定 2 秒间隔

3. **添加任务完成通知**：
   可以在任务完成时显示浏览器通知

4. **SSE 断线重连优化**：
   当前已有自动重连，可以添加更好的用户提示

## 注意事项

1. **SSE 连接限制**：同一域名下浏览器有 SSE 连接数限制（通常 6 个），但我们只用 1 个连接，不会有问题

2. **Vercel 部署**：Vercel 支持 SSE，但有 55 秒超时限制。我们设置了 10 分钟自动断开，Vercel 会先断开，客户端会自动重连

3. **防火墙/代理**：某些企业防火墙可能阻止 SSE，需要做好降级方案（回退到轮询）

4. **内存泄漏**：`useTaskSubscription` 已正确处理清理逻辑，组件卸载时会断开 SSE 连接
