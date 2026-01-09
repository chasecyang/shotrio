# Web Dockerfile - Next.js Standalone 多阶段构建
# 生成最小化的生产镜像

# Stage 1: 安装依赖
FROM node:24-alpine AS deps
WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json ./

# 安装所有依赖
RUN npm ci

# Stage 2: 构建应用
FROM node:24-alpine AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码和配置文件
COPY . .

# 构建 Next.js 应用 (standalone 模式)
RUN npm run build

# Stage 3: 生产运行镜像
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 创建非 root 用户以提高安全性
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制 public 文件夹 (静态资源)
COPY --from=builder /app/public ./public

# 设置 .next 目录权限
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 复制 standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 复制静态文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 复制迁移文件（用于代码内迁移）
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 启动应用
CMD ["node", "server.js"]
