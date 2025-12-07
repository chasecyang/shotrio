/**
 * 独立 Worker 进程
 * 持续监听并处理任务队列
 * 
 * 使用方法：
 * - 开发环境：npm run worker:dev
 * - 生产环境：npm run worker:start
 * - 使用 PM2：pm2 start ecosystem.config.js
 */

import { getPendingJobs } from "../lib/actions/job";
import { processJob } from "../lib/workers/job-processor";
import { getWorkerToken } from "../lib/workers/auth";

const POLL_INTERVAL = 10000; // 10 秒轮询一次
const MAX_CONCURRENT_JOBS = 5; // 最多同时处理 5 个任务
const ERROR_RETRY_DELAY = 30000; // 错误后等待 30 秒再重试

let isProcessing = false;
let processingCount = 0;
let workerToken: string;

/**
 * 主处理循环
 */
async function processQueue() {
  // 防止重复处理
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    // 获取待处理任务
    const availableSlots = MAX_CONCURRENT_JOBS - processingCount;
    if (availableSlots <= 0) {
      console.log(`[Worker] 已达到并发上限 (${processingCount}/${MAX_CONCURRENT_JOBS})，跳过本轮`);
      return;
    }

    const result = await getPendingJobs(availableSlots, workerToken);

    if (!result.success || !result.jobs || result.jobs.length === 0) {
      // 没有任务，静默等待
      return;
    }

    console.log(`[Worker] 发现 ${result.jobs.length} 个待处理任务`);

    // 并发处理任务
    const processingPromises = result.jobs.map(async (job) => {
      processingCount++;
      console.log(`[Worker] 开始处理任务 ${job.id} (${job.type})`);

      try {
        await processJob(job);
        console.log(`[Worker] ✅ 任务 ${job.id} 处理完成`);
      } catch (error) {
        console.error(`[Worker] ❌ 任务 ${job.id} 处理失败:`, error);
      } finally {
        processingCount--;
      }
    });

    await Promise.allSettled(processingPromises);
  } catch (error) {
    console.error("[Worker] 队列处理错误:", error);
    // 发生错误时等待更长时间再重试
    await new Promise((resolve) => setTimeout(resolve, ERROR_RETRY_DELAY));
  } finally {
    isProcessing = false;
  }
}

/**
 * 启动 Worker
 */
async function startWorker() {
  console.log("=================================");
  console.log("🚀 Cineqo Task Worker 启动中...");
  console.log("=================================");
  console.log(`轮询间隔: ${POLL_INTERVAL / 1000} 秒`);
  console.log(`最大并发: ${MAX_CONCURRENT_JOBS}`);
  console.log(`环境: ${process.env.NODE_ENV || "development"}`);
  console.log("=================================\n");

  // 验证 Worker Token
  try {
    workerToken = getWorkerToken();
    console.log("✅ Worker 认证 Token 已加载");
  } catch (error) {
    console.error("❌ Worker 认证失败:", error);
    console.error("请确保在环境变量中设置了 WORKER_API_SECRET");
    process.exit(1);
  }

  console.log("\n开始处理任务队列...\n");

  // 立即执行一次
  await processQueue();

  // 定时轮询
  setInterval(async () => {
    await processQueue();
  }, POLL_INTERVAL);

  // 优雅关闭
  process.on("SIGTERM", () => {
    console.log("\n[Worker] 收到 SIGTERM 信号，等待任务完成后退出...");
    const checkInterval = setInterval(() => {
      if (processingCount === 0) {
        console.log("[Worker] 所有任务已完成，退出进程");
        clearInterval(checkInterval);
        process.exit(0);
      } else {
        console.log(`[Worker] 等待 ${processingCount} 个任务完成...`);
      }
    }, 1000);
  });

  process.on("SIGINT", () => {
    console.log("\n[Worker] 收到 SIGINT 信号，强制退出");
    process.exit(0);
  });
}

// 启动
startWorker().catch((error) => {
  console.error("❌ Worker 启动失败:", error);
  process.exit(1);
});

