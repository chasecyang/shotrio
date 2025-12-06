# Worker 部署指南

## 概述

Cineqo 使用独立的 Worker 进程来处理耗时任务（如小说拆分、角色提取、图像生成等）。Worker 会持续监听任务队列，自动处理待处理的任务。

## 架构说明

```
┌─────────────────┐
│   Next.js App   │  用户提交任务
│  (Web Server)   │────────┐
└─────────────────┘        │
                           ↓
                  ┌──────────────────┐
                  │   PostgreSQL     │  任务队列
                  │  (job 表)        │
                  └──────────────────┘
                           ↑
                           │ 轮询获取任务
┌─────────────────┐        │
│  Worker Process │────────┘
│   (独立进程)     │  处理并更新状态
└─────────────────┘
```

## 开发环境

### 启动方式

```bash
# 终端 1：启动 Web 服务
npm run dev

# 终端 2：启动 Worker
npm run worker:dev
```

`worker:dev` 会使用 `tsx watch` 自动监听文件变化并重启。

## 生产环境

### 方案 1：使用 PM2（推荐）

PM2 是一个强大的进程管理器，可以自动重启、日志管理、负载均衡等。

#### 安装 PM2

```bash
npm install -g pm2
```

#### 启动应用

```bash
# 启动所有服务（Web + Worker）
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 实时监控
pm2 monit

# 重启服务
pm2 restart all

# 停止服务
pm2 stop all

# 删除服务
pm2 delete all
```

#### 开机自启动

```bash
# 保存当前进程列表
pm2 save

# 生成启动脚本
pm2 startup

# 按照提示执行命令（通常需要 sudo）
```

#### 查看 Worker 日志

```bash
# 实时查看 Worker 日志
pm2 logs cineqo-worker

# 查看最近 100 行
pm2 logs cineqo-worker --lines 100

# 只看错误日志
pm2 logs cineqo-worker --err
```

### 方案 2：使用 systemd（Linux）

如果你的服务器使用 systemd，可以创建服务单元：

#### 创建服务文件

```bash
sudo nano /etc/systemd/system/cineqo-worker.service
```

```ini
[Unit]
Description=Cineqo Task Worker
After=network.target postgresql.service

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/cineqo
Environment="NODE_ENV=production"
Environment="DATABASE_URL=your-database-url"
ExecStart=/usr/bin/npm run worker:start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 启动服务

```bash
# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start cineqo-worker

# 设置开机自启
sudo systemctl enable cineqo-worker

# 查看状态
sudo systemctl status cineqo-worker

# 查看日志
sudo journalctl -u cineqo-worker -f
```

### 方案 3：使用 Docker

如果你使用 Docker 部署，可以创建单独的 Worker 容器：

#### Dockerfile.worker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["npm", "run", "worker:start"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - postgres

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - postgres
    restart: always

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_DB=cineqo
      - POSTGRES_USER=cineqo
      - POSTGRES_PASSWORD=secret
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 配置说明

### 环境变量

确保以下环境变量已配置：

```bash
# 数据库连接
DATABASE_URL=postgresql://user:password@host:5432/dbname

# OpenAI API（用于 AI 任务）
OPENAI_API_KEY=sk-xxx

# Fal.ai API（用于图像生成）
FAL_KEY=xxx

# R2 存储（用于文件上传）
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=xxx
R2_PUBLIC_URL=https://xxx
```

### Worker 参数调整

编辑 `src/workers/standalone-worker.ts` 中的常量：

```typescript
const POLL_INTERVAL = 10000;      // 轮询间隔（毫秒）
const MAX_CONCURRENT_JOBS = 5;     // 最大并发任务数
const ERROR_RETRY_DELAY = 30000;   // 错误重试延迟（毫秒）
```

**调整建议**：
- 如果服务器性能好，可以增加 `MAX_CONCURRENT_JOBS`
- 如果任务较多，可以减小 `POLL_INTERVAL`（但不建议小于 5 秒）
- 生产环境建议 `POLL_INTERVAL` 保持 10-30 秒

## 监控和维护

### 健康检查

Worker 没有 HTTP 接口，但可以通过以下方式检查：

```bash
# 检查进程是否运行
ps aux | grep worker

# PM2 状态
pm2 status cineqo-worker

# systemd 状态
sudo systemctl status cineqo-worker
```

### 日志查看

```bash
# PM2
pm2 logs cineqo-worker --lines 50

# systemd
sudo journalctl -u cineqo-worker -n 50 -f

# Docker
docker-compose logs -f worker
```

### 常见问题

#### Worker 不处理任务

1. 检查 Worker 是否运行
2. 检查数据库连接是否正常
3. 查看日志中是否有错误
4. 确认任务表中有 `status='pending'` 的任务

#### Worker 频繁重启

1. 检查环境变量是否配置正确
2. 查看错误日志
3. 确认数据库连接稳定
4. 检查内存使用情况

#### 任务处理太慢

1. 增加 `MAX_CONCURRENT_JOBS`
2. 减小 `POLL_INTERVAL`
3. 考虑部署多个 Worker 实例（需要确保数据库支持并发锁）

## 扩展方案

### 多 Worker 实例

可以同时运行多个 Worker 实例来提高吞吐量：

```bash
# PM2 方式
pm2 start ecosystem.config.js
pm2 scale cineqo-worker 3  # 运行 3 个 Worker 实例

# Docker Compose 方式
docker-compose up --scale worker=3
```

数据库使用 `FOR UPDATE SKIP LOCKED` 确保不会重复处理任务。

### 监控告警

可以集成监控工具：

- **Prometheus + Grafana**：监控任务处理量、成功率
- **Sentry**：捕获 Worker 错误
- **Datadog / New Relic**：全面的 APM 监控

## 更新部署

```bash
# 拉取最新代码
git pull

# 安装依赖（如有更新）
npm install

# 重启服务
pm2 restart all

# 或 systemd
sudo systemctl restart cineqo-worker
```

## 回滚

```bash
# PM2
pm2 stop cineqo-worker
git checkout <previous-commit>
npm install
pm2 start ecosystem.config.js

# systemd
sudo systemctl stop cineqo-worker
git checkout <previous-commit>
npm install
sudo systemctl start cineqo-worker
```

## 性能优化建议

1. **数据库索引**：确保 `job` 表有适当的索引
   ```sql
   CREATE INDEX idx_job_user_status ON job(user_id, status);
   CREATE INDEX idx_job_created_pending ON job(created_at) WHERE status = 'pending';
   ```

2. **连接池**：配置合适的数据库连接池大小

3. **日志轮转**：配置日志轮转避免磁盘占满
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 100M
   pm2 set pm2-logrotate:retain 7
   ```

4. **资源限制**：为 Worker 设置内存限制
   ```javascript
   // ecosystem.config.js
   max_memory_restart: '500M',
   ```

## 故障排查清单

- [ ] Worker 进程是否正在运行？
- [ ] 数据库连接是否正常？
- [ ] 环境变量是否配置正确？
- [ ] API 密钥（OpenAI, Fal.ai）是否有效？
- [ ] 磁盘空间是否充足？
- [ ] 内存使用是否正常？
- [ ] 日志中是否有明显错误？
- [ ] 任务表中是否有待处理任务？

## 联系支持

如有问题，请查看：
- GitHub Issues
- 项目文档
- 日志文件

---

**最后更新**：2024-12-06

