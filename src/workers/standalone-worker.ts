/**
 * 独立 Worker 进程
 * 持续监听并处理任务队列
 * 
 * 使用方法：
 * - 开发环境：npm run worker:dev
 * - 生产环境：npm run worker:start
 * - 使用 PM2：pm2 start ecosystem.config.js
 */

import { getPendingJobs, failJob, requeueJob } from "../lib/actions/job";
import { processJob, registerAllProcessors } from "../lib/workers/job-processor";
import { getWorkerToken } from "../lib/workers/auth";
import { recoverTimeoutJobs } from "../lib/workers/utils/timeout-handler";
import { DependencyNotReadyError } from "../lib/workers/errors/DependencyNotReadyError";
import type { Job } from "@/types/job";

const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL || '2000'); // 2 秒轮询一次（更短的轮询间隔以充分利用并发能力）
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '10'); // 最多同时处理 10 个任务
const ERROR_RETRY_DELAY = 5000; // 错误后等待 5 秒再重试
const IDLE_POLL_INTERVAL = parseInt(process.env.WORKER_IDLE_POLL_INTERVAL || '5000'); // 空闲时 5 秒轮询一次
const TIMEOUT_CHECK_INTERVAL = 60000; // 每60秒检查一次超时任务

const processingJobs = new Map<string, Promise<void>>(); // 当前正在处理的任务
let workerToken: string;
let isFetching = false; // 是否正在获取任务（防止重复获取）
let consecutiveEmptyPolls = 0; // 连续空轮询次数

/**
 * 获取并启动新任务（不等待任务完成）
 */
async function fetchAndStartJobs() {
  // 防止重复获取
  if (isFetching) {
    return;
  }

  isFetching = true;

  try {
    // 计算可用槽位
    const availableSlots = MAX_CONCURRENT_JOBS - processingJobs.size;
    
    if (availableSlots <= 0) {
      // 已达到并发上限，无需获取新任务
      return;
    }

    // 获取待处理任务
    const result = await getPendingJobs(availableSlots, workerToken);

    if (!result.success || !result.jobs || result.jobs.length === 0) {
      consecutiveEmptyPolls++;
      return;
    }

    consecutiveEmptyPolls = 0;
    console.log(`\n[Worker] 发现 ${result.jobs.length} 个待处理任务，当前并发: ${processingJobs.size}/${MAX_CONCURRENT_JOBS}`);

    // 立即启动所有任务（不等待完成）
    for (const job of result.jobs) {
      const jobPromise = processJobAsync(job);
      processingJobs.set(job.id, jobPromise);
      
      // 任务完成后自动清理
      jobPromise.finally(() => {
        processingJobs.delete(job.id);
      });
    }
  } catch (error) {
    console.error("[Worker] 获取任务失败:", error);
    await new Promise((resolve) => setTimeout(resolve, ERROR_RETRY_DELAY));
  } finally {
    isFetching = false;
  }
}

/**
 * 异步处理单个任务
 */
async function processJobAsync(job: Job): Promise<void> {
  console.log(`[Worker] ▶️  开始处理任务 ${job.id} (${job.type})`);
  const startTime = Date.now();

  try {
    await processJob(job);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Worker] ✅ 任务 ${job.id} 处理完成 (耗时 ${duration}s)`);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 特殊处理依赖未就绪错误
    if (error instanceof DependencyNotReadyError) {
      const retryCount = ((job.inputData as Record<string, unknown>)?._retryCount as number || 0) + 1;
      const MAX_RETRIES = 20; // ~40秒（2秒轮询间隔）

      if (retryCount <= MAX_RETRIES) {
        // 重新排队
        const waitingForIds = error.waitingFor.map(d => d.imageDataId);
        try {
          await requeueJob(job.id, retryCount, waitingForIds, workerToken);
          console.log(`[Worker] 🔄 任务 ${job.id} 等待依赖，重试 ${retryCount}/${MAX_RETRIES}`);
          return;
        } catch (requeueError) {
          console.error(`[Worker] ⚠️  重新排队任务 ${job.id} 失败:`, requeueError);
          // 如果重新排队失败，继续执行失败逻辑
        }
      } else {
        // 超过最大重试次数，标记为失败
        console.error(`[Worker] ❌ 任务 ${job.id} 依赖超时 (耗时 ${duration}s)`);
        try {
          await failJob(
            {
              jobId: job.id,
              errorMessage: "依赖超时：引用的图片生成未完成",
            },
            workerToken
          );
          console.log(`[Worker] 📝 已将任务 ${job.id} 标记为失败（依赖超时）`);
        } catch (failError) {
          console.error(`[Worker] ⚠️  标记任务 ${job.id} 失败时出错:`, failError);
        }
        return;
      }
    }

    // 其他错误照常处理
    console.error(`[Worker] ❌ 任务 ${job.id} 处理失败 (耗时 ${duration}s):`, error);

    // 立即标记任务为失败，不等待超时
    try {
      await failJob(
        {
          jobId: job.id,
          errorMessage: error instanceof Error ? error.message : "处理任务失败",
        },
        workerToken
      );
      console.log(`[Worker] 📝 已将任务 ${job.id} 标记为失败`);
    } catch (failError) {
      console.error(`[Worker] ⚠️  标记任务 ${job.id} 失败时出错:`, failError);
      // 不抛出错误，避免影响其他任务的处理
    }
  }
}

/**
 * 启动 Worker
 */
async function startWorker() {
  console.log("=================================");
  console.log("🚀 ShotRio Task Worker 启动中...");
  console.log("=================================");
  console.log(`活跃轮询间隔: ${POLL_INTERVAL / 1000} 秒`);
  console.log(`空闲轮询间隔: ${IDLE_POLL_INTERVAL / 1000} 秒`);
  console.log(`最大并发数: ${MAX_CONCURRENT_JOBS}`);
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

  console.log("\n📦 注册任务处理器...");
  registerAllProcessors();
  
  console.log("\n⏳ 开始监听任务队列...\n");

  // 立即执行一次
  await fetchAndStartJobs();

  // 智能轮询：根据是否有任务调整轮询频率
  setInterval(async () => {
    // 如果连续多次空轮询，使用较长的间隔
    const shouldPoll = consecutiveEmptyPolls < 3 || Date.now() % IDLE_POLL_INTERVAL < POLL_INTERVAL;
    
    if (shouldPoll) {
      await fetchAndStartJobs();
    }
  }, POLL_INTERVAL);

  // 超时任务恢复（每60秒检查一次）
  setInterval(async () => {
    try {
      const result = await recoverTimeoutJobs(workerToken);
      if (result.recovered > 0) {
        console.log(`[Worker] 🔄 已恢复 ${result.recovered} 个超时任务`);
      }
      if (result.errors.length > 0) {
        console.error(`[Worker] ⚠️  超时恢复出现 ${result.errors.length} 个错误`);
      }
    } catch (error) {
      console.error("[Worker] 超时恢复失败:", error);
    }
  }, TIMEOUT_CHECK_INTERVAL);

  // 状态监控
  setInterval(() => {
    if (processingJobs.size > 0) {
      const jobIds = Array.from(processingJobs.keys()).join(", ");
      console.log(`[Worker] 📊 当前并发: ${processingJobs.size}/${MAX_CONCURRENT_JOBS} | 处理中: ${jobIds}`);
    }
  }, 30000); // 每 30 秒输出一次状态

  // 优雅关闭
  process.on("SIGTERM", () => {
    console.log("\n[Worker] 收到 SIGTERM 信号，等待任务完成后退出...");
    const checkInterval = setInterval(() => {
      if (processingJobs.size === 0) {
        console.log("[Worker] 所有任务已完成，退出进程");
        clearInterval(checkInterval);
        process.exit(0);
      } else {
        const jobIds = Array.from(processingJobs.keys()).join(", ");
        console.log(`[Worker] 等待 ${processingJobs.size} 个任务完成: ${jobIds}`);
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

