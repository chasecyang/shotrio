# 编辑器页面轮询问题修复

## 问题描述

在编辑器页面中，发现大量 POST 请求持续轮询 `/zh/projects/{id}/editor`，每 300ms 左右就会发送一次请求，导致：
- 服务器负载增加
- 网络流量浪费
- 浏览器性能下降
- 用户体验受影响

## 问题原因

### 1. `useTaskSubscription` Hook 的依赖循环

**位置**: `src/hooks/use-task-subscription.ts`

**问题**:
```typescript
// 之前的代码
useEffect(() => {
  connect();
  return () => {
    disconnect();
  };
}, [connect, disconnect]); // ❌ 这里的依赖导致无限循环
```

**原因分析**:
- `connect` 和 `disconnect` 被 `useCallback` 包裹
- 但是它们内部使用了 `setIsConnected`, `setError`, `setJobs` 等状态更新函数
- 即使使用了空依赖数组 `[]`，每次状态更新时，React 可能会重新创建这些函数引用
- `useEffect` 依赖这两个函数，导致每次函数引用变化时都会重新执行
- 这导致了断开连接 → 重新连接 → 触发状态更新 → 函数引用变化 → 再次执行 effect 的循环

### 2. `scene-extraction-banner.tsx` 的重复检查

**位置**: `src/components/projects/editor/resource-panel/scene-extraction-banner.tsx`

**问题**:
```typescript
// 之前的代码
useEffect(() => {
  const currentCheck = `${hasActiveJob}-${hasLoadedCompletedJob.current}`;
  if (currentCheck === lastActiveJobCheck.current) {
    return; // 试图避免重复执行，但不够有效
  }
  // ...
}, [activeJobs, projectId, completedJob, isDismissed]);
```

**原因分析**:
- `activeJobs` 是一个数组，每次从 SSE 更新时都是新的数组引用
- 即使数组内容相同，引用变化也会触发 useEffect
- 这导致频繁调用 `getUserJobs()` 检查已完成的任务

## 修复方案

### 1. 修复 `useTaskSubscription`

**修改内容**:
```typescript
// 修复后的代码
useEffect(() => {
  connect();
  return () => {
    disconnect();
  };
  // 只在组件挂载时执行一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // ✅ 空依赖数组，只执行一次
```

**关键点**:
- 移除 `connect` 和 `disconnect` 的依赖
- 使用空依赖数组 `[]`，确保 effect 只在组件挂载时执行一次
- `connect` 和 `disconnect` 使用 ref 存储，即使函数引用变化也不影响
- 添加 eslint-disable 注释说明这是有意为之

### 2. 优化 `scene-extraction-banner.tsx`

**修改内容**:
```typescript
// 修复后的代码
useEffect(() => {
  if (isDismissed || completedJob) {
    return;
  }

  // 如果项目ID改变了，重置加载状态
  if (lastProjectIdCheck.current !== projectId) {
    hasLoadedCompletedJob.current = false;
    lastProjectIdCheck.current = projectId;
  }

  // 如果已经加载过，不再重复加载
  if (hasLoadedCompletedJob.current) {
    return;
  }

  const hasActiveJob = activeJobs.some(...);
  
  // 只有在没有活动任务时才加载
  if (hasActiveJob) {
    return;
  }

  loadCompletedJob();
}, [activeJobs, projectId, completedJob, isDismissed]);
```

**关键点**:
- 使用 ref 记录项目ID，当项目切换时才重置加载状态
- 移除不必要的字符串比较逻辑
- 添加更清晰的早期返回条件
- 确保只在真正需要时才调用 API

## 验证修复

修复后，应该观察到：
1. ✅ POST 请求到编辑器页面的频率大幅降低（应该只在页面初始加载时发生）
2. ✅ SSE 连接稳定，每 2 秒一次的任务状态更新正常工作
3. ✅ 没有不必要的 `getUserJobs` API 调用
4. ✅ 浏览器控制台没有重复连接的日志

## 相关文件

- `src/hooks/use-task-subscription.ts` - SSE 任务订阅 Hook
- `src/components/projects/editor/resource-panel/scene-extraction-banner.tsx` - 场景提取横幅组件
- `src/app/api/tasks/stream/route.ts` - SSE API 端点（每 2 秒推送任务更新）

## 后续优化建议

1. **考虑使用 WebSocket**: 如果需要更实时的双向通信，可以考虑从 SSE 升级到 WebSocket
2. **添加监控**: 添加性能监控，追踪 API 调用频率和 SSE 连接状态
3. **优化状态管理**: 考虑使用 Zustand 或 Redux 管理全局任务状态，减少组件间的状态传递
4. **添加防抖**: 对于频繁变化的状态，考虑添加 debounce 或 throttle

## 日期

2024-12-13

