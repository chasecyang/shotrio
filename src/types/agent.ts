// AI Agent 系统类型定义
// 
// 注意：LangGraph 迁移后，IterationStep 和 PendingAction 的实际定义
// 移到了 lib/services/langgraph/state.ts，这里仅保留必要的类型引用

import type { Job } from "./job";
import type { SelectedResource } from "@/components/projects/editor/editor-context";
import type { IterationInfo, PendingActionInfo } from "@/lib/services/langgraph/state";

/**
 * Agent 消息角色
 */
export type AgentMessageRole = "user" | "assistant" | "system";

/**
 * Function 分类
 */
export type FunctionCategory = "read" | "generation" | "modification" | "deletion";

/**
 * 迭代步骤（从 LangGraph state 导出，保持向后兼容）
 */
export type IterationStep = IterationInfo;

/**
 * Agent 消息
 * 
 * 注意：运行时状态（isStreaming、isInterrupted、pendingAction）
 * 不再作为消息的持久化字段，而是通过 LangGraph stream 事件管理
 */
export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  timestamp: Date;
  // 完整的迭代步骤时间线
  iterations?: IterationStep[];
  // 运行时状态：仅用于前端 UI 展示，不持久化到数据库
  // 这些字段通过 stream 事件动态设置
  isStreaming?: boolean;
  isInterrupted?: boolean;
  pendingAction?: PendingActionInfo;
}

/**
 * Agent 上下文
 */
export interface AgentContext {
  projectId: string;
  selectedEpisodeId: string | null;
  selectedShotIds: string[];
  selectedResource: SelectedResource | null;
  recentJobs: Job[];
}

/**
 * Function 调用
 */
export interface FunctionCall {
  id: string;
  name: string;
  displayName?: string; // 用户友好的显示名称
  parameters: Record<string, unknown>;
  category: FunctionCategory;
  needsConfirmation: boolean;
  // AI 给出的调用理由
  reason?: string;
}

/**
 * Function 执行结果
 */
export interface FunctionExecutionResult {
  functionCallId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  // 如果创建了 Job，返回 jobId
  jobId?: string;
}

/**
 * Function 定义
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  displayName?: string; // 用于用户界面展示的友好名称
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  category: FunctionCategory;
  needsConfirmation: boolean;
}
