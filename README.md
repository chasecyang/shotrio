# Shotrio - AI 微短剧创作平台

一个基于 Next.js 的 AI 驱动的微短剧创作平台，支持小说自动拆分、角色提取、分镜生成等功能。

## 技术栈

- **前端框架**：Next.js 15 + React 19 + TypeScript
- **样式**：Tailwind CSS 4 + shadcn/ui
- **数据库**：PostgreSQL (Neon) + Drizzle ORM
- **认证**：Better Auth
- **AI 服务**：OpenAI GPT-4 + Fal.ai (图像生成)
- **存储**：Cloudflare R2
- **国际化**：next-intl

## 功能特性

### 已实现

- ✅ 用户认证（登录/注册）
- ✅ 项目管理
- ✅ 小说导入与 AI 自动拆分
- ✅ 角色管理与造型生成
- ✅ 素材管理
- ✅ 异步任务队列系统
- ✅ 实时任务进度推送（SSE）
- ✅ 任务中心 UI
- ✅ 多语言支持（中文/英文）

### 开发中

- 🚧 视频生成
- 🚧 项目导出

## 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 数据库
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
# 数据库
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Better Auth
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# OpenAI
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.deepseek.com  # 可选，默认使用 OpenAI 官方 API
OPENAI_CHAT_MODEL=deepseek-chat           # 用于普通对话和 JSON 生成
OPENAI_REASONING_MODEL=deepseek-reasoner  # 用于复杂推理任务（可选）

# Fal.ai
FAL_KEY=xxx

# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=xxx
R2_PUBLIC_URL=https://xxx

# Worker 认证（重要！）
# 生成方法：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
WORKER_API_SECRET=your-64-character-random-token
```

⚠️ **安全提示**：`WORKER_API_SECRET` 用于保护内部 Worker API，请务必设置强随机值。详见 [安全配置指南](./docs/SECURITY.md)。

### 初始化数据库

```bash
# 推送数据库 schema
npm run db:push

# 或生成迁移文件
npm run db:generate
npm run db:migrate
```

### 开发模式

需要启动两个进程：

```bash
# 终端 1：Web 服务
npm run dev

# 终端 2：Worker 进程（处理异步任务）
npm run worker:dev
```

应用将在 http://localhost:3000 启动。

### 生产部署

详细的部署指南请参考：[Worker 部署指南](./docs/worker-deployment-guide.md)

#### 使用 PM2（推荐）

```bash
# 构建
npm run build

# 启动所有服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs
```

#### 手动启动

```bash
# 终端 1：Web 服务
npm start

# 终端 2：Worker 进程
npm run worker:start
```

## 项目结构

```
shotrio/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [lang]/            # 多语言路由
│   │   └── api/               # API Routes
│   ├── components/            # React 组件
│   │   ├── ui/               # shadcn/ui 组件
│   │   ├── tasks/            # 任务中心组件
│   │   ├── projects/         # 项目相关组件
│   │   └── layout/           # 布局组件
│   ├── lib/
│   │   ├── actions/          # Server Actions
│   │   ├── services/         # 外部服务集成
│   │   ├── db/               # 数据库配置和 Schema
│   │   └── workers/          # 任务处理器
│   ├── workers/              # 独立 Worker 进程
│   ├── hooks/                # React Hooks
│   └── types/                # TypeScript 类型定义
├── docs/                      # 文档
├── messages/                  # 国际化翻译
├── public/                    # 静态资源
├── ecosystem.config.js        # PM2 配置
└── drizzle.config.ts         # Drizzle ORM 配置
```

## 核心功能说明

### 异步任务系统

Shotrio 使用 PostgreSQL 作为任务队列，通过独立的 Worker 进程处理耗时任务。

**架构**：
- Web 应用创建任务 → 写入数据库
- Worker 进程轮询任务 → 处理并更新状态
- 前端通过 SSE 实时接收进度更新

**支持的任务类型**：
- 小说拆分（AI）
- 角色提取（AI）
- 角色造型生成（图像生成）
- 批量图像生成
- 视频生成

**安全特性**：
- Worker 进程认证保护
- 项目所有权验证
- 输入验证和清理
- 速率限制（单用户最多 10 个待处理任务）
- SQL 注入防护

详见：
- [Worker 部署指南](./docs/worker-deployment-guide.md)
- [安全配置指南](./docs/SECURITY.md)

### 数据库 Schema

主要表结构：
- `user` - 用户表
- `project` - 项目表
- `character` - 角色表
- `character_image` - 角色造型表
- `episode` - 剧集表
- `shot` - 分镜表
- `job` - 任务队列表

## 开发指南

### 数据库操作

```bash
# 查看数据库
npm run db:studio

# 推送 schema 变更
npm run db:push

# 生成迁移
npm run db:generate
```

### 代码规范

- 使用 ESLint 进行代码检查
- Server Components 优先，Client Components 仅用于交互
- 使用 Server Actions 代替 RESTful API
- 所有异步操作通过任务队列处理

### 添加新的任务类型

1. 在 `src/types/job.ts` 添加类型定义
2. 在 `src/lib/workers/job-processor.ts` 添加处理逻辑
3. 在 `src/lib/actions/` 创建对应的 action
4. 更新 UI 组件

## 监控和维护

### 查看 Worker 日志

```bash
# PM2
pm2 logs shotrio-worker

# systemd
sudo journalctl -u shotrio-worker -f
```

### 健康检查

```bash
# 检查 Worker 状态
pm2 status shotrio-worker

# 查看任务队列
# 连接数据库执行：
SELECT status, COUNT(*) FROM job GROUP BY status;
```

## 故障排查

常见问题和解决方案：

1. **Worker 不处理任务**
   - 检查 Worker 进程是否运行
   - 查看日志中的错误信息
   - 确认数据库连接正常
   - **检查 `WORKER_API_SECRET` 是否正确配置**

2. **Worker 启动失败**
   - 错误信息：`WORKER_API_SECRET 未配置`
   - 解决方案：在 `.env` 中设置 `WORKER_API_SECRET`
   - 生成方法：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

3. **任务失败**
   - 检查 API 密钥是否有效
   - 查看 `job` 表中的 `error_message`
   - 使用"重试"功能重新执行

4. **SSE 连接断开**
   - 检查 Nginx 配置（如使用）
   - 确认防火墙允许长连接

5. **安全警告**
   - 日志中出现 `[Security] 未授权的 xxx 调用`
   - 说明有未授权访问尝试，检查 Worker Token 配置

详见：
- [Worker 部署指南](./docs/worker-deployment-guide.md)
- [安全配置指南](./docs/SECURITY.md)

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

[MIT License](./LICENSE)

## 联系方式

- GitHub: [shotrio](https://github.com/yourusername/shotrio)
- Email: your@email.com

---

**最后更新**：2024-12-06
