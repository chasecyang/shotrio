import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { eq, and, or, inArray, isNull } from "drizzle-orm";

/**
 * SSE (Server-Sent Events) 端点
 * 实时推送用户的任务更新
 * 
 * GET /api/tasks/stream
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;

    // 创建 SSE 流
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // 发送初始连接消息
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
        );

        // 定期查询任务更新
        const intervalId = setInterval(async () => {
          try {
            // 1. 查询活跃的根任务（没有父任务的）
            const activeRootJobs = await db.query.job.findMany({
              where: and(
                eq(job.userId, userId),
                or(eq(job.status, "pending"), eq(job.status, "processing"))
              ),
              orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
              limit: 50, // 增加限制以包含子任务
            });

            // 2. 构建任务ID集合（包括父任务ID）
            const rootJobIds = new Set<string>();
            const childJobIds = new Set<string>();
            
            activeRootJobs.forEach((j) => {
              if (!j.parentJobId) {
                rootJobIds.add(j.id);
              } else {
                childJobIds.add(j.id);
                // 记录父任务ID，稍后需要查询
                if (j.parentJobId) {
                  rootJobIds.add(j.parentJobId);
                }
              }
            });

            // 3. 如果有子任务但缺少父任务，补充查询父任务
            const missingParentIds = Array.from(rootJobIds).filter(
              id => !activeRootJobs.some(j => j.id === id)
            );

            let parentJobs: typeof activeRootJobs = [];
            if (missingParentIds.length > 0) {
              parentJobs = await db.query.job.findMany({
                where: and(
                  eq(job.userId, userId),
                  inArray(job.id, missingParentIds)
                ),
              });
            }

            // 4. 查询最近完成的根任务（最近5分钟内）
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const recentCompletedRootJobs = await db.query.job.findMany({
              where: and(
                eq(job.userId, userId),
                or(
                  eq(job.status, "completed"),
                  eq(job.status, "failed"),
                  eq(job.status, "cancelled")
                )
              ),
              orderBy: (jobs, { desc }) => [desc(jobs.updatedAt)],
              limit: 15,
            }).then(jobs => 
              jobs.filter(j => j.updatedAt && new Date(j.updatedAt) > fiveMinutesAgo)
            );

            // 5. 合并所有任务（去重）
            const jobMap = new Map();
            [...activeRootJobs, ...parentJobs, ...recentCompletedRootJobs].forEach(j => {
              if (!jobMap.has(j.id)) {
                jobMap.set(j.id, j);
              }
            });
            const allJobs = Array.from(jobMap.values());

            // 发送任务更新
            const data = JSON.stringify({
              type: "jobs_update",
              jobs: allJobs.map((j) => ({
                id: j.id,
                projectId: j.projectId,
                type: j.type,
                status: j.status,
                progress: j.progress,
                currentStep: j.currentStep,
                totalSteps: j.totalSteps,
                progressMessage: j.progressMessage,
                errorMessage: j.errorMessage,
                resultData: j.resultData,
                inputData: j.inputData, // 添加 inputData 字段
                createdAt: j.createdAt,
                startedAt: j.startedAt,
                updatedAt: j.updatedAt,
              })),
              timestamp: new Date().toISOString(),
            });

            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch (error) {
            console.error("SSE 查询任务失败:", error);
            // 发送错误但不中断连接
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: "查询失败" })}\n\n`
              )
            );
          }
        }, 2000); // 每 2 秒推送一次

        // 心跳检测（每 30 秒）
        const heartbeatId = setInterval(() => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`)
          );
        }, 30000);

        // 清理函数
        const cleanup = () => {
          clearInterval(intervalId);
          clearInterval(heartbeatId);
        };

        // 监听客户端断开连接
        request.signal.addEventListener("abort", () => {
          cleanup();
          try {
            controller.close();
          } catch {
            // 可能已经关闭
          }
        });

        // 设置超时（10 分钟后自动断开）
        setTimeout(() => {
          cleanup();
          try {
            controller.close();
          } catch {
            // 可能已经关闭
          }
        }, 10 * 60 * 1000);
      },
    });

    // 返回 SSE 响应
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // 禁用 Nginx 缓冲
      },
    });
  } catch (error) {
    console.error("SSE 初始化失败:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

