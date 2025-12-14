# 父子任务关系展示 - 实现总结

## 概述

为后台任务模块实现了完整的父子任务关系展示功能，用户可以清晰地看到任务之间的层级关系和依赖关系。

## 实现内容

### 1. 核心工具库 (`src/lib/utils/task-tree.ts`)

创建了任务树形结构处理的工具函数：

#### `buildTaskTree(jobs: Partial<Job>[]): TaskNode[]`
- 将扁平的任务列表转换为树形结构
- 自动识别父子关系（通过 `parentJobId`）
- 按创建时间排序（新任务在前）
- 处理孤立节点（父任务不存在的子任务）

#### `getNodeOverallStatus(node: TaskNode)`
- 计算节点的整体状态（考虑所有子任务）
- 统计活跃任务数量和总数
- 判断是否有失败任务
- 返回聚合后的状态信息

#### `hasActiveTask(node: TaskNode): boolean`
- 递归检查节点及其子节点是否有活跃任务
- 用于快速判断任务组状态

#### `getChildJobIds(node: TaskNode): string[]`
- 递归获取所有子任务 ID
- 用于批量操作

#### `flattenTaskTree(nodes: TaskNode[]): Partial<Job>[]`
- 将树形结构扁平化
- 用于导出或批量处理

### 2. 组件更新

#### BackgroundTasks 组件 (`src/components/projects/layout/background-tasks.tsx`)

**新增功能：**
- ✅ 使用 `buildTaskTree` 构建任务树
- ✅ 展开/折叠状态管理（`expandedNodes: Set<string>`）
- ✅ 递归渲染任务节点（`TaskNodeItem` 组件）
- ✅ 子任务统计显示（活跃数/总数）
- ✅ 视觉层级区分（缩进 + 左边框）
- ✅ 智能状态显示（根据子任务状态）

**关键改进：**
```typescript
// 构建任务树
const taskTree = buildTaskTree(allJobs);

// 只显示前10个根任务
const displayedTree = taskTree.slice(0, 10);

// 展开/折叠控制
const toggleNode = (nodeId: string) => {
  setExpandedNodes((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId);
    } else {
      newSet.add(nodeId);
    }
    return newSet;
  });
};
```

#### TaskNodeItem 组件（新增）

**核心特性：**
- 递归渲染支持多层嵌套
- 展开/折叠图标（`ChevronRight`/`ChevronDown`）
- 子任务统计徽章
- 深度参数控制缩进级别
- 独立的操作按钮（取消、重试、查看）

**UI 设计：**
```typescript
// 视觉层级
className={cn(
  "rounded-lg border bg-card p-3 space-y-2",
  depth > 0 && "ml-6 border-l-2 border-l-primary/20"
)}

// 子任务统计
{hasChildren && (
  <Badge variant="secondary" className="text-[9px] px-1.5 h-4">
    {overallStatus?.activeCount || 0}/{overallStatus?.totalCount || 0}
  </Badge>
)}
```

#### TaskItem 组件 (`src/components/tasks/task-item.tsx`)

**更新内容：**
- ✅ 支持 `children` 属性接收子任务列表
- ✅ 支持 `depth` 属性控制嵌套深度
- ✅ 内置展开/折叠状态管理
- ✅ 递归渲染子任务
- ✅ 子任务统计显示
- ✅ 向后兼容（无子任务时与原来一致）

**兼容性：**
```typescript
// 可以单独使用（无子任务）
<TaskItem job={job} />

// 也可以传入子任务
<TaskItem job={parentJob} children={childJobs} />
```

### 3. 任务类型标签完善

为所有任务类型添加了图标和标签：

| 任务类型 | 标签 | 图标 |
|---------|------|------|
| `storyboard_generation` | 分镜提取 | 📹 Film |
| `storyboard_basic_extraction` | 基础分镜提取 | 📹 Film |
| `storyboard_matching` | 角色场景匹配 | 👥 Users |
| `batch_video_generation` | 批量视频生成 | 🎬 Video |
| `shot_video_generation` | 单镜视频生成 | 🎬 Video |
| `shot_tts_generation` | 语音合成 | ✨ Sparkles |
| `final_video_export` | 最终成片导出 | 🎞️ Film |
| ... | ... | ... |

## 数据流

### 1. 任务创建流程

```typescript
// 1. 创建父任务
const parentJob = await createJob({
  userId,
  projectId,
  type: "storyboard_generation",
  inputData: { episodeId },
});

// 2. 创建子任务（关联父任务）
const childJob1 = await createJob({
  userId,
  projectId,
  type: "storyboard_basic_extraction",
  inputData: { episodeId },
  parentJobId: parentJob.id, // 👈 关键：关联父任务
});

const childJob2 = await createJob({
  userId,
  projectId,
  type: "storyboard_matching",
  inputData: { episodeId, basicExtractionJobId: childJob1.id },
  parentJobId: parentJob.id, // 👈 关键：关联父任务
});
```

### 2. 任务查询流程

```typescript
// 1. 通过 SSE 或 API 获取任务列表
const jobs = await getUserJobs({ limit: 20 });

// 2. 构建任务树
const taskTree = buildTaskTree(jobs);

// 3. 获取节点状态
taskTree.forEach(node => {
  const status = getNodeOverallStatus(node);
  console.log(`任务 ${node.job.id}: ${status.activeCount}/${status.totalCount}`);
});
```

### 3. 状态更新流程

```
子任务状态变化
    ↓
SSE 推送更新
    ↓
useTaskSubscription 更新 jobs
    ↓
buildTaskTree 重新构建树
    ↓
getNodeOverallStatus 计算整体状态
    ↓
UI 重新渲染
```

## 数据库支持

### Schema 定义

```sql
CREATE TABLE job (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  parent_job_id TEXT REFERENCES job(id) ON DELETE CASCADE, -- 👈 父任务关联
  progress INTEGER DEFAULT 0,
  ...
);

-- 索引优化
CREATE INDEX idx_job_parent ON job(parent_job_id);
CREATE INDEX idx_job_user_created ON job(user_id, created_at DESC);
```

### 级联删除

当父任务被删除时，所有子任务会自动删除（`ON DELETE CASCADE`）。

## UI/UX 设计

### 视觉层级

```
┌─────────────────────────────────────────┐
│ ▼ 📹 分镜提取              [1/2] 🔄 处理中│ ← 父任务（可展开）
│   ┌─────────────────────────────────────│
│   │ 📹 基础分镜提取            ✅ 已完成  │ ← 子任务（缩进+边框）
│   │   进度：100%                         │
│   └─────────────────────────────────────│
│   │ 👥 角色场景匹配            🔄 处理中  │
│   │   进度：60%                          │
│   │   正在匹配角色：小明                  │
└─────────────────────────────────────────┘
```

### 交互设计

1. **展开/折叠**
   - 点击箭头图标展开或折叠
   - 图标旋转动画（`ChevronRight` ↔ `ChevronDown`）
   - 子节点默认折叠（避免信息过载）

2. **状态指示**
   - 使用颜色区分状态（黄、蓝、绿、红、灰）
   - 父任务显示子任务统计（`2/5`）
   - 进度条显示处理进度

3. **操作按钮**
   - 每个任务独立操作（取消、重试、查看）
   - 按钮大小适配紧凑布局
   - 悬停效果提升可点击性

### 响应式设计

- 移动端：保持相同的树形结构，调整间距
- 桌面端：完整显示所有信息
- 滚动优化：使用 `ScrollArea` 组件

## 性能优化

### 1. 渲染优化

```typescript
// 只显示前 10 个根任务
const displayedTree = taskTree.slice(0, 10);

// 懒加载：子任务在展开时才渲染
{hasChildren && isExpanded && (
  <div className="space-y-1">
    {node.children.map(...)}
  </div>
)}
```

### 2. 状态管理

```typescript
// 使用 Set 管理展开状态（O(1) 查询）
const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

// 增量更新，不重新渲染整个树
const toggleNode = (nodeId: string) => {
  setExpandedNodes((prev) => {
    const newSet = new Set(prev);
    // ...
    return newSet;
  });
};
```

### 3. 数据缓存

```typescript
// 缓存任务详情，避免重复查询
const [jobDetails, setJobDetails] = useState<Map<string, JobDetails>>(new Map());
```

## 测试覆盖

### 单元测试

- ✅ `buildTaskTree` - 树形结构构建
- ✅ `getNodeOverallStatus` - 状态计算
- ✅ `hasActiveTask` - 活跃任务检测
- ✅ `getChildJobIds` - 子任务 ID 提取

### 组件测试

- ✅ `TaskNodeItem` - 渲染和交互
- ✅ `TaskItem` - 递归渲染
- ✅ `BackgroundTasks` - 整体集成

### 集成测试场景

1. 分镜提取任务（1个父任务 + 2个子任务）
2. 批量视频生成（1个父任务 + N个子任务）
3. 嵌套任务（多层父子关系）
4. 状态同步（子任务状态变化影响父任务）
5. 历史任务加载（持久化验证）

## 使用示例

### 示例 1：分镜提取

```typescript
// 在 storyboard-processors.ts 中
export async function processStoryboardGeneration(jobData: Job) {
  // 1. 更新父任务状态
  await updateJobProgress({
    jobId: jobData.id,
    progress: 10,
    progressMessage: "开始分镜提取流程...",
  });

  // 2. 创建第一步子任务
  const basicExtractionJob = await createJob({
    userId: jobData.userId,
    projectId: jobData.projectId!,
    type: "storyboard_basic_extraction",
    inputData: { episodeId, parentJobId: jobData.id },
    parentJobId: jobData.id, // 👈 关联父任务
  });

  // 3. 创建第二步子任务
  const matchingJob = await createJob({
    userId: jobData.userId,
    projectId: jobData.projectId!,
    type: "storyboard_matching",
    inputData: { episodeId, basicExtractionJobId: basicExtractionJob.id },
    parentJobId: jobData.id, // 👈 关联父任务
  });

  // 4. 完成父任务
  await completeJob({
    jobId: jobData.id,
    resultData: {
      childJobIds: [basicExtractionJob.id, matchingJob.id],
    },
  });
}
```

### 示例 2：批量操作

```typescript
// 批量生成视频
export async function batchGenerateVideos(shotIds: string[]) {
  // 创建父任务
  const batchJob = await createJob({
    userId,
    projectId,
    type: "batch_video_generation",
    inputData: { shotIds },
    totalSteps: shotIds.length,
  });

  // 创建子任务
  const childJobs = await Promise.all(
    shotIds.map((shotId, index) =>
      createJob({
        userId,
        projectId,
        type: "shot_video_generation",
        inputData: { shotId },
        parentJobId: batchJob.id, // 👈 关联父任务
      })
    )
  );

  return { batchJobId: batchJob.id, childJobIds: childJobs.map(j => j.id) };
}
```

## 后续优化建议

### 短期优化（1-2周）

1. **批量操作**
   - [ ] 批量展开/折叠所有任务
   - [ ] 批量取消子任务
   - [ ] 批量重试失败任务

2. **进度聚合**
   - [ ] 父任务显示子任务的平均进度
   - [ ] 预估完成时间

3. **筛选和搜索**
   - [ ] 按任务类型筛选
   - [ ] 按状态筛选
   - [ ] 搜索任务（按名称、ID）

### 中期优化（1-2月）

1. **任务依赖可视化**
   - [ ] 显示任务之间的依赖关系
   - [ ] DAG 图表视图

2. **性能优化**
   - [ ] 虚拟滚动（大量任务时）
   - [ ] 增量更新（只更新变化的节点）
   - [ ] Web Worker 处理树形结构

3. **用户体验**
   - [ ] 拖拽调整任务优先级
   - [ ] 快捷键支持
   - [ ] 任务通知（完成、失败）

### 长期优化（3-6月）

1. **任务调度器**
   - [ ] 自动重试策略
   - [ ] 优先级队列
   - [ ] 资源限制（并发控制）

2. **任务分析**
   - [ ] 任务执行时间统计
   - [ ] 失败原因分析
   - [ ] 性能瓶颈识别

3. **多租户支持**
   - [ ] 团队任务共享
   - [ ] 权限控制
   - [ ] 任务委派

## 文档

- ✅ 功能说明：`parent-child-task-display.md`
- ✅ 测试指南：`parent-child-task-testing.md`
- ✅ 实现总结：本文档

## 总结

本次实现为后台任务模块带来了以下改进：

1. **可视化增强**：通过树形结构清晰展示任务关系
2. **交互改进**：支持展开/折叠，按需查看详情
3. **状态聚合**：父任务智能显示子任务整体状态
4. **性能优化**：懒加载、状态缓存、限制显示数量
5. **扩展性**：支持多层嵌套、易于扩展新功能

该功能已完成开发并通过测试，可以立即使用。

