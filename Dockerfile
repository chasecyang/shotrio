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

# 如果部署平台通过 build-arg 传入变量，需在构建阶段显式映射到环境变量
# 注意：这仅用于 `npm run build` 过程，运行时请使用平台的 Runtime Env 注入
ARG BETTER_AUTH_SECRET
ARG R2_ACCOUNT_ID
ARG R2_ACCESS_KEY_ID
ARG R2_SECRET_ACCESS_KEY
ARG R2_BUCKET_NAME
ARG R2_PUBLIC_DOMAIN
ARG R2_PUBLIC_BUCKET_URL

ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET \
    R2_ACCOUNT_ID=$R2_ACCOUNT_ID \
    R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID \
    R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY \
    R2_BUCKET_NAME=$R2_BUCKET_NAME \
    R2_PUBLIC_DOMAIN=$R2_PUBLIC_DOMAIN \
    R2_PUBLIC_BUCKET_URL=$R2_PUBLIC_BUCKET_URL

# 构建 Next.js 应用 (standalone 模式)
RUN npm run build

# Stage 3: 生产运行镜像
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 安装 ffmpeg 用于视频缩略图生成
RUN apk add --no-cache ffmpeg

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

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 启动应用
CMD ["node", "server.js"]
