# Job Actions 模块

任务管理模块，负责任务的创建、查询、更新和生命周期管理。

## 📁 文件结构

```
job/
├── index.ts                  # 统一导出入口
├── create.ts                 # 任务创建和速率限制
├── user-operations.ts        # 用户操作（查询列表、取消、重试）
├── worker-operations.ts      # Worker 操作（仅供内部使用）
└── README.md                 # 本文件
```

## 🔑 模块功能

### 创建模块（create.ts）
- `createJob()` - 创建新任务
- 速率限制检查（防止用户滥用）

### 用户操作模块（user-operations.ts）
- `getUserJobs()` - 获取用户的任务列表（支持筛选）
- `cancelJob()` - 取消任务
- `retryJob()` - 重试失败的任务
- `markJobAsImported()` - 标记任务为已导入
- `getJobDetail()` - 获取任务详情
- `getCutExportHistory()` - 获取剪辑导出历史

### Worker 操作模块（worker-operations.ts）
⚠️ **仅供内部 Worker 使用，需要 workerToken 认证**

- `startJob()` - 开始处理任务
- `updateJobProgress()` - 更新任务进度
- `completeJob()` - 完成任务
- `failJob()` - 标记任务失败
- `getPendingJobs()` - 获取待处理任务队列

## 📦 使用方法

```typescript
// 导入所需函数
import {
  createJob,
  getUserJobs
} from "@/lib/actions/job";

// 创建任务
const result = await createJob({
  userId: "user-id",
  projectId: "project-id",
  type: "asset_image",
  inputData: { prompt: "..." }
});

// 获取用户任务列表
const jobs = await getUserJobs({
  status: ["pending", "processing"],
  limit: 20
});
```

## 🔒 安全特性

1. **速率限制**
   - 单用户最多 10 个并发任务
   - 每天最多创建 1000 个任务

2. **Worker 认证**
   - Worker 操作需要通过 `verifyWorkerToken()` 验证
   - 防止未授权调用

3. **权限检查**
   - 确保用户只能操作自己的任务
