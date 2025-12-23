/**
 * LangGraph Agent State Definition
 * 
 * 定义 Agent 执行过程中的状态结构
 */

import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import type { AgentContext as AgentContextType } from "@/types/agent";
import type { CreditCost } from "@/lib/utils/credit-calculator";

/**
 * 迭代信息（用于前端展示）
 */
export interface IterationInfo {
  id: string;
  iterationNumber: number;
  content?: string;
  functionCall?: {
    id: string;
    name: string;
    displayName?: string;
    description?: string;
    category: string;
    status: "pending" | "executing" | "completed" | "failed";
    result?: string;
    error?: string;
  };
  timestamp: Date;
}

/**
 * 待确认操作信息（用于 interrupt）
 */
export interface PendingActionInfo {
  id: string;
  functionCall: {
    id: string;
    name: string;
    displayName?: string;
    arguments: Record<string, unknown>;
    category: string;
  };
  message: string;
  creditCost?: CreditCost;
  createdAt: Date;
}

/**
 * Agent State 定义
 * 
 * 使用 LangGraph Annotation 定义状态结构
 * reducer 函数定义如何合并状态更新
 */
export const AgentStateAnnotation = Annotation.Root({
  /**
   * 消息历史（LangChain 格式）
   * reducer: 追加新消息到数组末尾
   */
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),

  /**
   * 项目上下文
   * reducer: 完全替换
   */
  projectContext: Annotation<AgentContextType>({
    reducer: (_, update) => update,
    default: () => ({
      projectId: "",
      selectedEpisodeId: null,
      selectedShotIds: [],
      selectedResource: null,
      recentJobs: [],
    }),
  }),

  /**
   * 迭代历史（用于前端展示）
   * reducer: 完全替换（节点返回完整数组）
   */
  iterations: Annotation<IterationInfo[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),

  /**
   * 当前迭代编号
   * reducer: 取最大值
   */
  currentIteration: Annotation<number>({
    reducer: (current, update) => Math.max(current, update),
    default: () => 0,
  }),

  /**
   * 待确认操作（用于 interrupt）
   * reducer: 完全替换
   */
  pendingAction: Annotation<PendingActionInfo | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),

  /**
   * 对话ID（用于保存消息到数据库）
   * reducer: 完全替换
   */
  conversationId: Annotation<string | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),

  /**
   * 项目ID
   * reducer: 完全替换
   */
  projectId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  /**
   * 用户审批决定（用于 interrupt resume）
   * reducer: 完全替换
   */
  userApproval: Annotation<{ approved: boolean; reason?: string } | undefined>({
    reducer: (_, update) => update,
    default: () => undefined,
  }),
});

/**
 * Agent State 类型
 */
export type AgentState = typeof AgentStateAnnotation.State;

