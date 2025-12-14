# 后台任务统计优化

## 问题描述

之前的后台任务统计存在以下问题：

1. **统计不准确**：当一个批量任务（父任务）包含100个子任务时，系统会显示"101个进行中"，这不够直观
2. **缺乏层级区分**：没有区分根任务和子任务，导致统计数字膨胀
3. **信息不清晰**：无法快速了解任务的整体进度（多少完成、多少失败等）

## 解决方案

### 1. 优化前端统计逻辑

#### 位置：`src/components/projects/layout/background-tasks.tsx`

**之前的逻辑**：
```typescript
const activeCount = activeJobs.length; // 直接统计所有活动任务
```

**优化后的逻辑**：
```typescript
// 统计根任务中有活动任务的数量
const { rootTaskCount, totalActiveCount } = taskTree.reduce(
  (acc, node) => {
    const overallStatus = getNodeOverallStatus(node);
    if (overallStatus.activeCount > 0) {
      acc.rootTaskCount += 1;
      acc.totalActiveCount += overallStatus.activeCount;
    }
    return acc;
  },
  { rootTaskCount: 0, totalActiveCount: 0 }
);

const activeCount = rootTaskCount; // 只显示根任务数量
```

**改进**：
- 只统计有活动子任务的根任务数量
- 同时统计所有活动子任务的总数
- 在 UI 上同时显示两个数字："3个任务，15个子任务"

### 2. 增强任务状态统计

#### 位置：`src/lib/utils/task-tree.ts`

**增加的统计字段**：
```typescript
export function getNodeOverallStatus(node: TaskNode): {
  status: string;
  allCompleted: boolean;
  hasFailures: boolean;
  activeCount: number;      // 活动任务数
  totalCount: number;        // 总任务数
  completedCount: number;    // 完成任务数（新增）
  failedCount: number;       // 失败任务数（新增）
}
```

**改进**：
- 添加 `completedCount` 和 `failedCount` 统计
- 提供更全面的任务进度信息
- 支持更细粒度的状态展示

### 3. 优化子任务显示

#### 位置：`src/components/projects/layout/background-tasks.tsx` 和 `src/components/tasks/task-item.tsx`

**之前的显示**：
```tsx
<Badge>{childStats.active}/{childStats.total}</Badge>
```

**优化后的显示**：
```tsx
{childStats.active > 0 && (
  <Badge variant="secondary">{childStats.active} 进行中</Badge>
)}
{childStats.completed > 0 && (
  <Badge variant="outline" className="text-green-600">
    {childStats.completed} 完成
  </Badge>
)}
{childStats.failed > 0 && (
  <Badge variant="outline" className="text-red-600">
    {childStats.failed} 失败
  </Badge>
)}
```

**改进**：
- 分别显示不同状态的子任务数量
- 使用不同颜色区分状态
- 只显示有值的统计（避免显示"0 完成"）

### 4. 优化 SSE API 查询逻辑

#### 位置：`src/app/api/tasks/stream/route.ts`

**优化的查询策略**：

1. **查询所有活动任务**（包括子任务）：
   ```typescript
   const activeRootJobs = await db.query.job.findMany({
     where: and(
       eq(job.userId, userId),
       or(eq(job.status, "pending"), eq(job.status, "processing"))
     ),
     limit: 50, // 增加限制以包含更多子任务
   });
   ```

2. **补充缺失的父任务**：
   - 如果查询到子任务，但父任务不在结果中
   - 额外查询这些父任务，确保任务树完整

3. **查询最近完成的任务**：
   - 查询最近5分钟内完成的任务
   - 包括 completed、failed、cancelled 状态

4. **去重合并**：
   - 使用 Map 去重
   - 确保每个任务只出现一次

**改进**：
- 确保任务树的完整性
- 合理控制返回的数据量
- 避免遗漏父任务导致的显示问题

## 效果对比

### 之前
- 图标显示："101个进行中"
- 无法区分是1个大任务还是101个独立任务
- 子任务显示："50/100"（不清楚是什么状态）

### 优化后
- 图标显示："3个任务（101个子任务）"
- 清楚知道有3个根任务在运行
- 子任务显示："45 进行中 50 完成 5 失败"
- Tooltip 显示详细信息

## 技术细节

### 任务树构建
1. 使用 `buildTaskTree()` 将扁平任务列表转换为树形结构
2. 父任务包含 `children` 数组存储子任务
3. 支持递归遍历和统计

### 统计方法
1. **根任务统计**：只统计顶层任务
2. **递归统计**：遍历整个任务树统计所有状态
3. **状态聚合**：父任务状态根据子任务自动计算

### 性能优化
1. 使用 `Map` 进行任务去重
2. SSE 限制查询数量（50个）
3. 前端只显示前10个根任务
4. 子任务默认折叠，按需展开

## 测试场景

1. **单个独立任务**
   - 显示：1个任务
   - 无子任务统计

2. **批量任务（100个子任务）**
   - 显示：1个任务（100个子任务）
   - 子任务：50 进行中 45 完成 5 失败

3. **多个混合任务**
   - 显示：5个任务（150个子任务）
   - 清楚展示每个任务组的进度

## 总结

通过这次优化，后台任务的统计变得更加准确和直观：
- ✅ 区分根任务和子任务
- ✅ 提供详细的状态统计
- ✅ 优化显示层级和布局
- ✅ 改进 SSE API 查询效率
- ✅ 提升用户体验和信息透明度

