import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { job } from "@/lib/db/schemas/project";
import { eq, and, or } from "drizzle-orm";

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
            // 查询活跃任务（pending 或 processing）
            const activeJobs = await db.query.job.findMany({
              where: and(
                eq(job.userId, userId),
                or(eq(job.status, "pending"), eq(job.status, "processing"))
              ),
              orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
              limit: 20,
            });

            // 同时查询最近完成的任务（最近5分钟内完成的）
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const recentCompletedJobs = await db.query.job.findMany({
              where: and(
                eq(job.userId, userId),
                or(
                  eq(job.status, "completed"),
                  eq(job.status, "failed"),
                  eq(job.status, "cancelled")
                ),
                // 只推送最近完成的任务
              ),
              orderBy: (jobs, { desc }) => [desc(jobs.updatedAt)],
              limit: 10,
            }).then(jobs => 
              jobs.filter(j => j.updatedAt && new Date(j.updatedAt) > fiveMinutesAgo)
            );

            // 合并活跃任务和最近完成的任务
            const allJobs = [...activeJobs, ...recentCompletedJobs];

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

