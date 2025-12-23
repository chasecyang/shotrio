/**
 * LangGraph PostgreSQL Checkpointer
 * 
 * 配置 LangGraph 的持久化层，使用 PostgreSQL 保存 checkpoints
 */

import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";

let checkpointer: PostgresSaver | null = null;
let pool: Pool | null = null;

/**
 * 获取或创建 PostgresSaver 实例
 * 
 * 使用单例模式确保连接池复用
 */
export async function getCheckpointer(): Promise<PostgresSaver> {
  if (checkpointer) {
    return checkpointer;
  }

  // 创建 PostgreSQL 连接池
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    pool = new Pool({
      connectionString: databaseUrl,
      // 连接池配置
      max: 20, // 最大连接数
      idleTimeoutMillis: 30000, // 空闲连接超时
      connectionTimeoutMillis: 10000, // 连接超时
    });

    // 处理连接池错误
    pool.on("error", (err) => {
      console.error("[LangGraph Checkpointer] PostgreSQL pool error:", err);
    });

    console.log("[LangGraph Checkpointer] PostgreSQL connection pool created");
  }

  // 创建 PostgresSaver
  checkpointer = new PostgresSaver(pool);

  // 初始化表结构
  try {
    await checkpointer.setup();
    console.log("[LangGraph Checkpointer] Database tables initialized");
  } catch (error) {
    console.error("[LangGraph Checkpointer] Failed to setup tables:", error);
    throw error;
  }

  return checkpointer;
}

/**
 * 关闭 checkpointer 和连接池
 * 
 * 用于优雅关闭应用
 */
export async function closeCheckpointer(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    checkpointer = null;
    console.log("[LangGraph Checkpointer] Connection pool closed");
  }
}

/**
 * 生成 thread ID
 * 
 * thread ID 用于标识一个对话会话
 */
export function generateThreadId(projectId: string, conversationId: string): string {
  return `${projectId}_${conversationId}`;
}

/**
 * 解析 thread ID
 */
export function parseThreadId(threadId: string): { projectId: string; conversationId: string } | null {
  const parts = threadId.split("_");
  if (parts.length !== 2) {
    return null;
  }
  return {
    projectId: parts[0],
    conversationId: parts[1],
  };
}

