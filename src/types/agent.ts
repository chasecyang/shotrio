// AI Agent 系统类型定义

import type { Job } from "./job";
import type { SelectedResource } from "@/components/projects/editor/editor-context";

/**
 * Agent 消息角色
 */
export type AgentMessageRole = "user" | "assistant" | "system" | "tool";

/**
 * OpenAI 兼容的消息类型（用于 Agent Engine）
 * 与 AgentMessage 不同，这是用于与 LLM 交互的精简格式
 */
export interface EngineMessage {
  role: AgentMessageRole;
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string; // for tool messages
}

/**
 * Function 分类
 */
export type FunctionCategory = "read" | "generation" | "modification" | "deletion";

/**
 * Agent 消息
 * 
 * 注意：运行时状态（isStreaming、isInterrupted）
 * 不作为消息的持久化字段，而是通过 stream 事件管理
 */
export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  timestamp: Date;
  // Tool 消息字段
  toolCallId?: string; // tool 消息的关联 ID
  toolCalls?: Array<{ // assistant 消息的 tool_calls
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  // 运行时状态：仅用于前端 UI 展示，不持久化到数据库
  // 这些字段通过 stream 事件动态设置
  isStreaming?: boolean;
  isInterrupted?: boolean;
}

/**
 * 序列化友好的 Job 信息（用于 AgentContext）
 */
export interface SerializableJobInfo {
  id: string;
  type: Job["type"];
  status: Job["status"];
  progressMessage: string | null;
}

/**
 * Agent 上下文
 */
export interface AgentContext {
  projectId: string;
  selectedEpisodeId: string | null;
  selectedShotIds: string[];
  selectedResource: SelectedResource | null;
  recentJobs: SerializableJobInfo[]; // 使用序列化友好的格式
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
 * Function 参数属性定义
 */
export interface FunctionParameterProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: {
    type: string;
    properties?: Record<string, unknown>;
  };
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
    properties: Record<string, FunctionParameterProperty>;
    required?: string[];
  };
  category: FunctionCategory;
  needsConfirmation: boolean;
}
