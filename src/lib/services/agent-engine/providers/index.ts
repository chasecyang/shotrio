/**
 * Agent Provider 工厂
 */

import type { AgentProvider, AgentTool } from "./types";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { AGENT_FUNCTIONS } from "@/lib/actions/agent/functions";

export type { AgentProvider, AgentTool, AgentStreamChunk } from "./types";

/**
 * 获取 Agent Provider 实例
 * 根据环境变量 AGENT_MODEL_PROVIDER 选择提供商
 */
export function getAgentProvider(): AgentProvider {
  const provider = process.env.AGENT_MODEL_PROVIDER || "gemini";

  switch (provider) {
    case "gemini":
      return new GeminiProvider();
    default:
      return new OpenAIProvider();
  }
}

/**
 * 将 Function 定义转换为 Agent Tools 格式
 */
export function convertToAgentTools(): AgentTool[] {
  return AGENT_FUNCTIONS.map((func) => ({
    type: "function" as const,
    function: {
      name: func.name,
      description: func.description,
      parameters: func.parameters,
    },
  }));
}
