// AI Agent 系统类型定义

import type { Job } from "./job";
import type { SelectedResource } from "@/components/projects/editor/editor-context";

/**
 * Agent 消息角色
 */
export type AgentMessageRole = "user" | "assistant" | "system";

/**
 * Function 调用状态
 */
export type FunctionCallStatus = "pending" | "executing" | "completed" | "failed" | "cancelled";

/**
 * Function 分类
 */
export type FunctionCategory = "read" | "generation" | "modification" | "deletion";

/**
 * 迭代步骤（用于展示多轮交互时间线）
 */
export interface IterationStep {
  id: string;
  iterationNumber: number; // 第几轮
  thinkingProcess?: string; // 该轮的思考过程
  content?: string; // 该轮的对话内容
  functionCall?: {
    // 该轮的工具调用
    id: string;
    name: string;
    description?: string; // 工具描述
    displayName?: string; // 用户友好的显示名称
    category: FunctionCategory;
    status: "pending" | "executing" | "completed" | "failed";
    result?: string;
    error?: string;
  };
  timestamp: Date;
}

/**
 * Agent 消息
 */
export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  timestamp: Date;
  // AI 的思考过程（仅用于简单消息的向后兼容，新的流式消息使用 iterations）
  thinkingProcess?: string;
  // 完整的迭代步骤时间线（用于多轮交互展示）
  iterations?: IterationStep[];
  // 标识消息是否正在流式输出中
  isStreaming?: boolean;
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
 * 待确认的操作
 */
export interface PendingAction {
  id: string;
  functionCalls: FunctionCall[];
  message: string;
  createdAt: Date;
}

/**
 * 任务执行状态
 */
export interface TaskExecution {
  id: string;
  functionCallId: string;
  functionName: string;
  jobId?: string;
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  progressMessage?: string;
  result?: unknown;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Agent 聊天输入
 */
export interface AgentChatInput {
  message: string;
  context: AgentContext;
  history: AgentMessage[];
}

/**
 * Agent 聊天响应（用于确认操作等非流式场景）
 */
export interface AgentChatResponse {
  success: boolean;
  message?: string;
  messageId?: string;
  // 需要确认的操作
  pendingActions?: PendingAction[];
  // 已执行的只读操作结果
  executedResults?: FunctionExecutionResult[];
  error?: string;
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

/**
 * 确认操作的输入
 */
export interface ConfirmActionInput {
  actionId: string;
  approved: boolean;
  // 用户修改后的参数（如果支持修改）
  modifiedParameters?: Record<string, unknown>;
}

/**
 * Agent 状态（用于持久化）
 */
export interface AgentState {
  projectId: string;
  messages: AgentMessage[];
  lastUpdated: Date;
}

