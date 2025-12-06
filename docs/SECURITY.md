# 安全配置指南

本文档说明 Cineqo 项目的安全配置和最佳实践。

## 🔐 Worker 进程认证

### 为什么需要 Worker 认证？

Worker 进程需要调用内部 API 来更新任务状态和处理数据。为了防止未授权访问，我们使用 `WORKER_API_SECRET` 来验证 Worker 的身份。

### 配置步骤

1. **生成安全的 Token**

使用以下命令生成一个 64 字符的随机 token：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. **设置环境变量**

将生成的 token 添加到 `.env` 文件中：

```bash
WORKER_API_SECRET=your-generated-token-here
```

⚠️ **重要提示**：
- 不要将此 token 提交到版本控制系统
- 在生产环境中使用不同的 token
- 定期更换 token（建议每 3-6 个月）

3. **重启服务**

修改环境变量后，需要重启所有相关服务：

```bash
# 重启 Next.js 应用
npm run dev  # 或 npm run build && npm start

# 重启 Worker 进程
npm run worker:start  # 或使用 PM2: pm2 restart worker
```

## 🛡️ 安全特性

### 1. 授权验证

所有 Worker 内部 API 调用都需要验证 `WORKER_API_SECRET`：

- `startJob()`
- `updateJobProgress()`
- `completeJob()`
- `failJob()`
- `getPendingJobs()`

### 2. 项目所有权验证

在处理任务时，系统会验证：
- 用户是否有权访问指定的项目
- 剧集/角色是否属于该项目
- 防止跨项目数据泄露

### 3. 输入验证

所有用户输入都经过严格验证：
- **内容长度限制**：小说内容最大 50,000 字符
- **数量限制**：最多 50 集，最多处理 100 个剧集
- **危险字符过滤**：移除控制字符，防止 Prompt Injection

### 4. 速率限制

防止资源滥用：
- 单用户最多 10 个待处理任务
- 单用户每天最多 100 个任务
- 超过限制会返回友好的错误提示

### 5. SQL 注入防护

- 使用参数化查询
- 严格验证数值参数
- 限制查询结果数量

## 🚨 安全检查清单

部署前请确保：

- [ ] 已设置强随机的 `WORKER_API_SECRET`
- [ ] `.env` 文件未被提交到 Git
- [ ] 生产环境使用不同的密钥
- [ ] 数据库连接使用 SSL
- [ ] API 密钥（OpenAI、Fal.ai）权限最小化
- [ ] R2 存储桶配置了适当的 CORS 策略
- [ ] 定期审查日志中的安全警告

## 📊 监控和日志

系统会记录以下安全事件：

```
[Security] 未授权的 startJob 调用
[Security] 未授权的 getPendingJobs 调用
[Security] WORKER_API_SECRET 未配置，拒绝所有 Worker 请求
```

建议配置日志监控系统，及时发现异常访问。

## 🔄 更新 Worker Token

如果需要更换 token：

1. 生成新的 token
2. 更新所有环境的 `.env` 文件
3. 重启所有服务（包括 Worker 进程）
4. 验证服务正常运行

## 📞 报告安全问题

如果发现安全漏洞，请通过以下方式报告：
- 发送邮件至安全团队
- 不要在公开 issue 中讨论安全问题

## 🔗 相关文档

- [任务系统快速开始](./TASK_SYSTEM_QUICK_START.md)
- [Worker 部署指南](./worker-deployment-guide.md)
- [环境变量配置](./.env.example)

