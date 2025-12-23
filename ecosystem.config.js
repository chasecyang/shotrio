/**
 * PM2 配置文件
 * 用于生产环境进程管理
 * 
 * 使用方法：
 * pm2 start ecosystem.config.js
 * pm2 logs
 * pm2 restart all
 * pm2 stop all
 */

module.exports = {
  apps: [
    {
      name: "shotrio-web",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "./logs/web-error.log",
      out_file: "./logs/web-out.log",
      time: true,
    },
    {
      name: "shotrio-worker",
      script: "./node_modules/.bin/tsx",
      args: "src/workers/standalone-worker.ts",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 5000,
    },
  ],
};

