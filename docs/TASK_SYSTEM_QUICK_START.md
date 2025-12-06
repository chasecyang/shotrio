# 任务系统快速开始

## 概览

Cineqo 的任务系统用于处理耗时的 AI 操作，如小说拆分、角色提取、图像生成等。系统采用独立 Worker 进程架构，实时更新进度。

## 开发环境快速启动

### 1. 安装依赖（首次）

```bash
npm install
```

### 2. 配置环境变量

确保 `.env` 文件包含：

```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
FAL_KEY=...
```

### 3. 初始化数据库

```bash
npm run db:push
```

### 4. 启动服务

**重要**：需要同时运行两个进程

```bash
# 终端 1：Web 服务
npm run dev

# 终端 2：Worker 进程
npm run worker:dev
```

访问 http://localhost:3000

## 生产环境部署

### 快速部署（PM2）

```bash
# 1. 构建
npm run build

# 2. 启动所有服务（Web + Worker）
pm2 start ecosystem.config.js

# 3. 查看状态
pm2 status

# 4. 查看日志
pm2 logs
```

### 手动部署

```bash
# 终端 1：Web 服务
npm start

# 终端 2：Worker 进程
npm run worker:start
```

## 使用任务系统

### 前端提交任务

```typescript
// 例如：小说拆分
const result = await splitNovelByAIAsync(content, projectId, {
  maxEpisodes: 20,
});

if (result.success) {
  console.log("任务已提交，ID:", result.jobId);
  // 用户可以在任务中心查看进度
}
```

### 查看任务进度

用户可以通过以下方式查看任务：
1. **任务中心**：点击页面右上角的"任务中心"按钮
2. **实时更新**：任务进度自动通过 SSE 推送
3. **Toast 通知**：任务完成时弹出通知

### 监控任务

```bash
# 查看 Worker 日志
pm2 logs cineqo-worker

# 查看数据库中的任务
psql $DATABASE_URL -c "SELECT id, type, status, progress FROM job ORDER BY created_at DESC LIMIT 10;"
```

## 常见操作

### 重启 Worker

```bash
pm2 restart cineqo-worker
```

### 查看错误日志

```bash
pm2 logs cineqo-worker --err
```

### 清理旧任务

```sql
DELETE FROM job WHERE status IN ('completed', 'failed') AND created_at < NOW() - INTERVAL '30 days';
```

## 配置调整

编辑 `src/workers/standalone-worker.ts`：

```typescript
const POLL_INTERVAL = 10000;      // 轮询间隔：10秒
const MAX_CONCURRENT_JOBS = 5;     // 最大并发：5个任务
```

**建议**：
- 开发环境：`POLL_INTERVAL = 5000`（5秒）
- 生产环境：`POLL_INTERVAL = 10000`（10秒）
- 高性能服务器：`MAX_CONCURRENT_JOBS = 10`

## 故障排查

### Worker 没有处理任务？

1. 检查 Worker 是否运行：
   ```bash
   pm2 status cineqo-worker
   ```

2. 查看日志：
   ```bash
   pm2 logs cineqo-worker --lines 50
   ```

3. 检查数据库中是否有待处理任务：
   ```sql
   SELECT COUNT(*) FROM job WHERE status = 'pending';
   ```

### 任务一直卡在 processing？

可能是 Worker 崩溃了，重启 Worker：
```bash
pm2 restart cineqo-worker
```

手动将任务重置为 pending：
```sql
UPDATE job SET status = 'pending', started_at = NULL WHERE status = 'processing' AND started_at < NOW() - INTERVAL '10 minutes';
```

## 更多信息

详细文档：[Worker 部署指南](./worker-deployment-guide.md)

