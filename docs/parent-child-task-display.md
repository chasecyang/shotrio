# 父子任务关系展示功能

## 概述

为后台任务模块增加了父子任务关系的树形展示功能，用户可以清晰地看到任务之间的层级关系。

## 功能特性

### 1. 任务树形结构

- **父任务展示**：显示主要任务及其状态
- **子任务展示**：通过展开/折叠查看子任务
- **嵌套层级**：支持多级任务嵌套
- **视觉区分**：通过缩进和边框颜色区分层级

### 2. 任务统计

父任务会显示子任务统计信息：
- **活跃/总数**：`2/5` 表示 5 个子任务中有 2 个正在执行
- **整体状态**：根据子任务状态智能显示父任务状态

### 3. 交互功能

- **展开/折叠**：点击箭头图标展开或折叠子任务
- **独立操作**：每个任务可以独立取消、重试或查看结果
- **状态同步**：子任务状态变化会影响父任务的整体状态显示

## 使用场景

### 分镜提取任务

```
📹 分镜提取 (2/2)
  ├─ 📹 基础分镜提取
  └─ 👥 角色场景匹配
```

当执行分镜提取时，会创建：
1. 父任务：`storyboard_generation`
2. 子任务 1：`storyboard_basic_extraction`（基础分镜提取）
3. 子任务 2：`storyboard_matching`（角色场景匹配）

### 批量操作任务

```
🖼️ 批量图像生成 (5/10)
  ├─ ✨ 场景图生成 - 森林小屋
  ├─ ✨ 场景图生成 - 城堡大厅
  ├─ ✨ 场景图生成 - 山顶
  └─ ...
```

批量生成图像或视频时，会创建一个父任务和多个子任务。

## 技术实现

### 核心工具函数 (`task-tree.ts`)

```typescript
// 构建任务树
const taskTree = buildTaskTree(jobs);

// 获取节点整体状态
const status = getNodeOverallStatus(node);

// 检查是否有活跃任务
const hasActive = hasActiveTask(node);
```

### 数据结构

```typescript
interface TaskNode {
  job: Partial<Job>;
  children: TaskNode[];
}
```

### 组件更新

1. **BackgroundTasks 组件**
   - 使用 `buildTaskTree` 构建树形结构
   - 使用 `TaskNodeItem` 递归渲染任务树
   - 支持展开/折叠状态管理

2. **TaskItem 组件**
   - 支持 `children` 属性接收子任务列表
   - 支持 `depth` 属性控制嵌套深度
   - 递归渲染子任务

## UI 设计

### 视觉层级

- **缩进**：子任务向右缩进 8 个单位 (`ml-8`)
- **左边框**：使用主题色的左边框标识子任务 (`border-l-2 border-l-primary/30`)
- **图标**：使用箭头图标（`ChevronRight`/`ChevronDown`）表示展开状态

### 状态标识

- **徽章颜色**：
  - 黄色：等待中
  - 蓝色：处理中
  - 绿色：已完成
  - 红色：失败
  - 灰色：已取消

- **子任务统计**：
  - 显示格式：`活跃数/总数`
  - 位置：任务标题右侧

### 交互反馈

- **悬停效果**：任务卡片悬停时显示阴影
- **按钮反馈**：展开按钮悬停时背景色变化
- **透明度**：已完成的任务降低透明度，悬停时恢复

## 数据库支持

任务表包含 `parent_job_id` 字段：

```sql
parent_job_id TEXT REFERENCES job(id) ON DELETE CASCADE
```

创建子任务时设置 `parentJobId`：

```typescript
await createJob({
  userId,
  projectId,
  type: "storyboard_basic_extraction",
  inputData: { episodeId },
  parentJobId: parentJob.id,  // 关联父任务
});
```

## 状态计算逻辑

父任务的整体状态由子任务状态决定：

1. **处理中**：任何子任务在处理中
2. **失败**：所有子任务完成且至少有一个失败
3. **已完成**：所有子任务都成功完成
4. **已取消**：部分或全部子任务被取消

```typescript
export function getNodeOverallStatus(node: TaskNode) {
  let activeCount = 0;
  let hasFailures = false;
  let allCompleted = true;
  
  // 递归统计子任务状态
  // ...
  
  return { status, allCompleted, hasFailures, activeCount, totalCount };
}
```

## 性能优化

1. **懒加载**：子任务默认折叠，只在展开时渲染
2. **限制数量**：后台任务面板只显示最近 10 个根任务
3. **状态缓存**：使用 Map 缓存任务详细信息

## 后续扩展

- [ ] 支持批量展开/折叠
- [ ] 添加任务进度聚合（父任务显示子任务总进度）
- [ ] 支持任务依赖关系可视化
- [ ] 添加任务关系图表视图
- [ ] 支持任务过滤和搜索

## 测试建议

1. **创建父子任务**：执行分镜提取，观察任务树结构
2. **展开折叠**：测试展开/折叠交互
3. **状态变化**：观察子任务状态变化对父任务的影响
4. **多层嵌套**：测试多级任务嵌套的显示效果
5. **批量操作**：测试批量生成任务的显示

