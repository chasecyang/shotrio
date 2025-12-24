/**
 * Agent Engine OpenAI 工具函数
 */

import OpenAI from "openai";
import { AGENT_FUNCTIONS } from "@/lib/actions/agent/functions";

/**
 * 将 Function 定义转换为 OpenAI tools 格式
 */
export function convertToOpenAITools() {
  return AGENT_FUNCTIONS.map((func) => ({
    type: "function" as const,
    function: {
      name: func.name,
      description: func.description,
      parameters: func.parameters,
    },
  }));
}

/**
 * 获取 OpenAI 客户端实例
 */
export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 未配置");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

