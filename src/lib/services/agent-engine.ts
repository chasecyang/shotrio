/**
 * Agent Engine - 核心执行引擎
 * 
 * 替代 LangGraph，实现简单可靠的状态机 + OpenAI Streaming
 */

import OpenAI from "openai";
import { AGENT_FUNCTIONS, getFunctionDefinition } from "@/lib/actions/agent/functions";
import { executeFunction } from "@/lib/actions/agent/executor";
import { collectContext } from "@/lib/actions/agent/context-collector";
import { estimateActionCredits } from "@/lib/actions/credits/estimate";
import type { AgentContext, FunctionCall } from "@/types/agent";

/**
 * OpenAI-compatible message types
 */
type MessageRole = "system" | "user" | "assistant" | "tool";

interface Message {
  role: MessageRole;
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
// IterationInfo 和 PendingActionInfo 类型定义移到这里
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
  creditCost?: any; // CreditCost type from credit-calculator
  createdAt: Date;
}
import db from "@/lib/db";
import { conversation, conversationMessage } from "@/lib/db/schemas/project";
import { eq } from "drizzle-orm";

/**
 * 执行状态
 */
type ExecutionState = "thinking" | "tool_call" | "awaiting_approval" | "completed";

/**
 * 流式事件类型
 */
export type AgentStreamEvent =
  | { type: "user_message_id"; data: string }
  | { type: "assistant_message_id"; data: string }
  | { type: "state_update"; data: { iterations: IterationInfo[]; currentIteration: number; pendingAction?: PendingActionInfo } }
  | { type: "interrupt"; data: { action: "approval_required"; pendingAction: PendingActionInfo } }
  | { type: "complete"; data: "done" | "pending_confirmation" }
  | { type: "error"; data: string };

/**
 * Agent 引擎配置
 */
interface AgentEngineConfig {
  maxIterations?: number; // 最大迭代次数，防止无限循环
  modelName?: string; // OpenAI 模型名称
}

/**
 * 对话状态（内存中）
 */
interface ConversationState {
  conversationId: string;
  projectContext: AgentContext;
  messages: Message[];
  iterations: IterationInfo[];
  currentIteration: number;
  pendingAction?: PendingActionInfo;
  assistantMessageId?: string;
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(): string {
  return `你是一个专业的微短剧创作 AI 助手。你可以通过多轮调用工具来完成复杂任务。

# 工作模式

你可以进行**多轮自主执行**：
1. **分析任务**：理解用户意图，拆解为多个步骤
2. **收集信息**：先调用查询类工具获取必要信息
3. **规划操作**：基于查询结果，决定下一步操作
4. **执行操作**：调用生成/修改/删除类工具
5. **验证结果**：可以再次查询确认操作是否成功

# 美术风格管理

项目的美术风格会影响所有图像生成的整体风格和氛围。
如果项目已有美术风格，优先遵循该风格，除非用户明确要求更换，如果没有，为了保持一致性，要设置美术风格。

# 图像生成

我们使用的图像生成模型（Nano Banana）支持自然语言描述，可以描述场景、人物、动作、光线、氛围等，用流畅的句子连接

# 角色一致性秘诀：角色三视图

**角色三视图（Character Turnaround/Reference Sheet）是保持短片中角色一致性的关键！**
## 工作流程
1. **先生成角色三视图**：当需要为某个角色生成素材时，优先为该角色生成一张"角色三视图"
2. **用三视图作为参考**：后续生成该角色的其他动作、表情或场景图时，使用三视图作为参考
3. **保持一致性**：这样可以确保同一角色在不同镜头中保持外观、服装、体型等特征的一致性

## 生成分镜图的最佳实践
可以使用多张参考图
- **角色三视图**：提供角色外观一致性
- **场景图**：提供环境风格和氛围
- **其他参考图**：提供动作姿势、光影效果等额外参考

例如：要生成"张三在咖啡厅喝咖啡"的分镜图，可以同时引用：
- 张三的角色三视图素材
- 咖啡厅场景素材
- 可选：喝咖啡姿势的参考图
`;
}

/**
 * 将 Function 定义转换为 OpenAI tools 格式
 */
function convertToOpenAITools() {
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
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 未配置");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

/**
 * Agent 引擎类
 */
export class AgentEngine {
  private config: Required<AgentEngineConfig>;

  constructor(config: AgentEngineConfig = {}) {
    this.config = {
      maxIterations: config.maxIterations || 20,
      modelName: config.modelName || process.env.OPENAI_AGENT_MODEL || 
                 process.env.OPENAI_REASONING_MODEL || 
                 process.env.OPENAI_CHAT_MODEL || 
                 "deepseek-chat",
    };
  }

  /**
   * 开始新对话
   */
  async *streamConversation(
    conversationId: string,
    userMessage: string,
    projectContext: AgentContext
  ): AsyncGenerator<AgentStreamEvent> {
    console.log("[AgentEngine] 开始新对话:", conversationId);

    // 保存用户消息
    const userMessageId = await this.saveUserMessage(conversationId, userMessage);
    yield { type: "user_message_id", data: userMessageId };

    // 创建 assistant 消息占位
    const assistantMessageId = await this.createAssistantMessage(conversationId);
    yield { type: "assistant_message_id", data: assistantMessageId };

    // 更新对话状态并保存上下文
    await this.updateConversationStatus(conversationId, "active");
    await this.saveConversationContext(conversationId, projectContext);

    // 初始化状态
    const state: ConversationState = {
      conversationId,
      projectContext,
      messages: [],
      iterations: [],
      currentIteration: 0,
      assistantMessageId,
    };

    // 构建系统消息
    const contextText = await collectContext(projectContext);
    const systemPrompt = buildSystemPrompt();
    state.messages.push({ 
      role: "system", 
      content: `${systemPrompt}\n\n# 当前上下文\n\n${contextText}` 
    });
    state.messages.push({ role: "user", content: userMessage });

    // 执行对话循环
    yield* this.executeConversationLoop(state);
  }

  /**
   * 恢复对话（用户确认/拒绝后）
   */
  async *resumeConversation(
    conversationId: string,
    approved: boolean,
    reason?: string
  ): AsyncGenerator<AgentStreamEvent> {
    console.log(`[AgentEngine] 恢复对话: ${conversationId}, 批准: ${approved}`);

    // 加载对话状态
    const state = await this.loadConversationState(conversationId);
    if (!state) {
      yield { type: "error", data: "无法加载对话状态" };
      return;
    }

    // 发送 assistant 消息ID（复用已有消息）
    yield { type: "assistant_message_id", data: state.assistantMessageId! };

    // 更新对话状态
    await this.updateConversationStatus(conversationId, "active");

    // 处理用户决定
    if (!approved) {
      // 用户拒绝，添加拒绝消息
      if (state.pendingAction) {
        const toolMessage: Message = {
          role: "tool",
          content: JSON.stringify({
            success: false,
            error: reason || "用户拒绝了此操作",
            userRejected: true,
          }),
          tool_call_id: state.pendingAction.functionCall.id,
        };
        state.messages.push(toolMessage);

        // 更新迭代状态
        const lastIteration = state.iterations[state.iterations.length - 1];
        if (lastIteration) {
          lastIteration.functionCall = {
            id: state.pendingAction.functionCall.id,
            name: state.pendingAction.functionCall.name,
            displayName: state.pendingAction.functionCall.displayName,
            description: "",
            category: state.pendingAction.functionCall.category,
            status: "failed",
            error: reason || "用户拒绝了此操作",
          };
        }

        yield {
          type: "state_update",
          data: {
            iterations: state.iterations,
            currentIteration: state.currentIteration,
          },
        };
      }

      state.pendingAction = undefined;
      
      // 继续执行循环（让 AI 根据拒绝原因调整策略）
      yield* this.executeConversationLoop(state);
    } else {
      // 用户同意，执行 pendingAction
      if (state.pendingAction) {
        yield* this.executeToolAndContinue(state);
      } else {
        yield { type: "error", data: "没有待执行的操作" };
      }
    }
  }

  /**
   * 执行对话循环（核心状态机）
   */
  private async *executeConversationLoop(
    state: ConversationState
  ): AsyncGenerator<AgentStreamEvent> {
    let iteration = 0;

    while (iteration < this.config.maxIterations) {
      iteration++;
      state.currentIteration++;

      console.log(`[AgentEngine] 迭代 ${state.currentIteration}`);

      // 创建新的迭代记录
      const iterationInfo: IterationInfo = {
        id: `iter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        iterationNumber: state.currentIteration,
        timestamp: new Date(),
      };
      state.iterations.push(iterationInfo);

      // 调用 OpenAI (流式)
      const openai = getOpenAIClient();
      
      // 使用原生 OpenAI 流式输出
      let currentContent = "";
      let toolCalls: any[] = [];
      let lastUpdateTime = Date.now();
      const throttleInterval = 50; // 50ms 节流
      
      const stream = await openai.chat.completions.create({
        model: this.config.modelName,
        messages: state.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: convertToOpenAITools(),
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        // 处理内容增量
        if (delta?.content) {
          currentContent += delta.content;
          iterationInfo.content = currentContent;
          
          // 节流：只在距离上次更新超过 throttleInterval 时发送更新
          const now = Date.now();
          if (now - lastUpdateTime >= throttleInterval) {
            yield {
              type: "state_update",
              data: {
                iterations: state.iterations,
                currentIteration: state.currentIteration,
              },
            };
            lastUpdateTime = now;
          }
        }
        
        // 检测工具调用
        if (delta?.tool_calls && delta.tool_calls.length > 0) {
          // 合并工具调用信息
          for (const tc of delta.tool_calls) {
            if (tc.index !== undefined) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = {
                  id: tc.id || "",
                  name: tc.function?.name || "",
                  args: "",
                };
              }
              if (tc.id) toolCalls[tc.index].id = tc.id;
              if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
              if (tc.function?.arguments) {
                toolCalls[tc.index].args += tc.function.arguments;
              }
            }
          }
        }
      }

      // 流式完成后，发送最后一次更新
      yield {
        type: "state_update",
        data: {
          iterations: state.iterations,
          currentIteration: state.currentIteration,
        },
      };

      // 解析工具调用参数
      const parsedToolCalls = toolCalls
        .filter(tc => tc && tc.name)
        .map(tc => {
          try {
            return {
              id: tc.id,
              name: tc.name,
              args: tc.args ? JSON.parse(tc.args) : {},
            };
          } catch (error) {
            console.error("[AgentEngine] 解析工具参数失败:", error);
            return {
              id: tc.id,
              name: tc.name,
              args: {},
            };
          }
        });

      // 构建完整的 AI 消息
      const response: Message = {
        role: "assistant",
        content: currentContent,
        tool_calls: parsedToolCalls.length > 0 
          ? parsedToolCalls.map(tc => ({
              id: tc.id,
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.args),
              },
            }))
          : undefined,
      };

      // 添加响应到消息历史
      state.messages.push(response);

      // 检查是否有工具调用
      const aiMessage = response;
      if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
        // 没有工具调用，对话结束
        console.log("[AgentEngine] 对话完成（无工具调用）");

        // 保存最终响应
        await this.saveAssistantResponse(
          state.assistantMessageId!,
          iterationInfo.content || "",
          state.iterations
        );

        yield {
          type: "state_update",
          data: {
            iterations: state.iterations,
            currentIteration: state.currentIteration,
          },
        };

        await this.updateConversationStatus(state.conversationId, "completed");
        yield { type: "complete", data: "done" };
        return;
      }

      // 有工具调用
      const toolCall = aiMessage.tool_calls[0];
      const toolCallArgs = JSON.parse(toolCall.function.arguments);
      const funcDef = getFunctionDefinition(toolCall.function.name);

      if (!funcDef) {
        yield { type: "error", data: `未知的工具: ${toolCall.function.name}` };
        return;
      }

      // 检查是否需要确认
      if (funcDef.needsConfirmation) {
        console.log("[AgentEngine] 需要用户确认");

        // 估算积分
        let creditCost;
        try {
          const functionCall: FunctionCall = {
            id: toolCall.id || `fc-${Date.now()}`,
            name: toolCall.function.name,
            displayName: funcDef.displayName,
            parameters: toolCallArgs as Record<string, unknown>,
            category: funcDef.category,
            needsConfirmation: funcDef.needsConfirmation,
          };
          const estimateResult = await estimateActionCredits([functionCall]);
          if (estimateResult.success && estimateResult.creditCost) {
            creditCost = estimateResult.creditCost;
          }
        } catch (error) {
          console.error("[AgentEngine] 估算积分失败:", error);
        }

        // 创建 pendingAction
        const pendingAction: PendingActionInfo = {
          id: `action-${Date.now()}`,
          functionCall: {
            id: toolCall.id || `fc-${Date.now()}`,
            name: toolCall.function.name,
            displayName: funcDef.displayName,
            arguments: toolCallArgs as Record<string, unknown>,
            category: funcDef.category,
          },
          message: iterationInfo.content || `准备执行: ${funcDef.displayName || toolCall.function.name}`,
          creditCost,
          createdAt: new Date(),
        };

        state.pendingAction = pendingAction;

        // 保存状态到数据库
        await this.saveConversationState(state);
        await this.updateConversationStatus(state.conversationId, "awaiting_approval");

        // 发送中断事件
        yield {
          type: "state_update",
          data: {
            iterations: state.iterations,
            currentIteration: state.currentIteration,
            pendingAction,
          },
        };

        yield {
          type: "interrupt",
          data: {
            action: "approval_required",
            pendingAction,
          },
        };

        yield { type: "complete", data: "pending_confirmation" };
        return;
      }

      // 不需要确认，直接执行
      console.log("[AgentEngine] 直接执行工具（无需确认）");
      yield* this.executeTool(state, toolCall, funcDef, iterationInfo);

      // 继续下一轮迭代
    }

    // 达到最大迭代次数
    console.log("[AgentEngine] 达到最大迭代次数");
    await this.updateConversationStatus(state.conversationId, "completed");
    yield { type: "error", data: "达到最大迭代次数" };
  }

  /**
   * 执行工具并继续
   */
  private async *executeToolAndContinue(
    state: ConversationState
  ): AsyncGenerator<AgentStreamEvent> {
    if (!state.pendingAction) {
      yield { type: "error", data: "没有待执行的操作" };
      return;
    }

    // 找到对应的 AI 消息和 tool_call
    const lastAIMessage = [...state.messages].reverse().find(m => m.role === "assistant");
    if (!lastAIMessage || !lastAIMessage.tool_calls || lastAIMessage.tool_calls.length === 0) {
      yield { type: "error", data: "无法找到工具调用信息" };
      return;
    }

    const toolCall = lastAIMessage.tool_calls[0];
    const funcDef = getFunctionDefinition(toolCall.function.name);
    if (!funcDef) {
      yield { type: "error", data: `未知的工具: ${toolCall.function.name}` };
      return;
    }

    const lastIteration = state.iterations[state.iterations.length - 1];

    // 执行工具
    yield* this.executeTool(state, toolCall, funcDef, lastIteration);

    // 清除 pendingAction
    state.pendingAction = undefined;

    // 继续执行循环
    yield* this.executeConversationLoop(state);
  }

  /**
   * 格式化函数执行结果，生成用户友好的描述
   */
  private formatFunctionResult(
    functionName: string,
    parameters: Record<string, unknown>,
    data: unknown
  ): string | undefined {
    if (!data) return undefined;

    try {
      switch (functionName) {
        case "create_shot": {
          const shotData = data as { id?: string; description?: string | null; order?: number };
          // 优先使用 description，如果没有则使用 parameters 中的 description
          const description = shotData.description || (parameters.description as string | undefined);
          const order = shotData.order ?? (parameters.order ? parseInt(String(parameters.order)) : undefined);
          
          if (description) {
            return `已创建分镜 #${order || "?"}: ${description}`;
          }
          if (order !== undefined) {
            return `已创建分镜 #${order}`;
          }
          return shotData.id ? `已创建分镜 (ID: ${shotData.id.substring(0, 8)}...)` : "已创建分镜";
        }

        case "update_shot": {
          const updatedFields: string[] = [];
          if (parameters.duration) updatedFields.push("时长");
          if (parameters.shotSize) updatedFields.push("景别");
          if (parameters.cameraMovement) updatedFields.push("运镜");
          if (parameters.description) updatedFields.push("描述");
          if (parameters.visualPrompt) updatedFields.push("视觉提示");
          if (parameters.imageAssetId) updatedFields.push("图片素材");
          
          if (updatedFields.length > 0) {
            return `已更新: ${updatedFields.join("、")}`;
          }
          return "已更新分镜";
        }

        case "delete_shots": {
          const deleteData = data as { deleted?: number };
          const count = deleteData.deleted ?? (Array.isArray(parameters.shotIds) ? (parameters.shotIds as string[]).length : 1);
          return `已删除 ${count} 个分镜`;
        }

        case "generate_asset": {
          if (parameters.name) {
            return `已创建生成任务: ${parameters.name}`;
          }
          if (parameters.prompt) {
            const prompt = String(parameters.prompt);
            const shortPrompt = prompt.length > 30 ? prompt.substring(0, 30) + "..." : prompt;
            return `已创建生成任务: ${shortPrompt}`;
          }
          return "已创建素材生成任务";
        }

        case "batch_generate_assets": {
          const batchData = data as { createdCount?: number; totalCount?: number };
          if (batchData.createdCount !== undefined) {
            return `已创建 ${batchData.createdCount} 个生成任务`;
          }
          return "已创建批量生成任务";
        }

        case "generate_shot_videos": {
          const shotIds = Array.isArray(parameters.shotIds) 
            ? (parameters.shotIds as string[]).length 
            : (typeof parameters.shotIds === "string" 
              ? JSON.parse(parameters.shotIds as string).length 
              : 1);
          return `已为 ${shotIds} 个分镜创建视频生成任务`;
        }

        case "query_assets": {
          const queryData = data as { total?: number; message?: string };
          if (queryData.message) {
            return queryData.message;
          }
          if (queryData.total !== undefined) {
            return `找到 ${queryData.total} 个素材`;
          }
          return "查询完成";
        }

        case "query_script_content": {
          const scriptData = data as { title?: string };
          if (scriptData.title) {
            return `已查询剧集: ${scriptData.title}`;
          }
          return "已查询剧本内容";
        }

        case "query_shots": {
          const shotsData = Array.isArray(data) ? data : [];
          return `查询到 ${shotsData.length} 个分镜`;
        }

        case "query_shot_details": {
          const shotData = data as { description?: string };
          if (shotData.description) {
            return `已查询分镜: ${shotData.description}`;
          }
          return "已查询分镜详情";
        }

        case "query_available_art_styles": {
          const stylesData = data as { styles?: unknown[]; message?: string };
          if (stylesData.message) {
            return stylesData.message;
          }
          if (Array.isArray(stylesData.styles)) {
            return `找到 ${stylesData.styles.length} 个美术风格`;
          }
          return "查询完成";
        }

        case "analyze_project_stats": {
          const statsData = data as { totalAssets?: number };
          if (statsData.totalAssets !== undefined) {
            return `项目共有 ${statsData.totalAssets} 个素材`;
          }
          return "已分析项目统计";
        }

        case "reorder_shots": {
          const shotOrders = parameters.shotOrders 
            ? (typeof parameters.shotOrders === "string" 
              ? JSON.parse(parameters.shotOrders as string) 
              : parameters.shotOrders)
            : {};
          const count = typeof shotOrders === "object" && shotOrders !== null 
            ? Object.keys(shotOrders).length 
            : 0;
          return `已重新排序 ${count} 个分镜`;
        }

        case "update_asset": {
          if (parameters.name) {
            return `已更新素材名称: ${parameters.name}`;
          }
          return "已更新素材";
        }

        case "delete_asset": {
          return "已删除素材";
        }

        case "set_project_art_style": {
          return "已设置项目美术风格";
        }

        default:
          // 对于未知函数，尝试从 data 中提取有用信息
          if (typeof data === "object" && data !== null) {
            const dataObj = data as Record<string, unknown>;
            // 尝试提取常见的字段
            if (dataObj.message && typeof dataObj.message === "string") {
              return dataObj.message;
            }
            if (dataObj.count !== undefined) {
              return `已完成 ${dataObj.count} 项操作`;
            }
            if (dataObj.total !== undefined) {
              return `共 ${dataObj.total} 项`;
            }
          }
          return undefined;
      }
    } catch (error) {
      console.warn(`[AgentEngine] 格式化函数结果失败:`, error);
      return undefined;
    }
  }

  /**
   * 执行单个工具
   */
  private async *executeTool(
    state: ConversationState,
    toolCall: any,
    funcDef: any,
    iterationInfo: IterationInfo
  ): AsyncGenerator<AgentStreamEvent> {
    console.log(`[AgentEngine] 执行工具: ${toolCall.name}`);

    // 构建 FunctionCall
    const toolCallArgs = JSON.parse(toolCall.function.arguments);
    const functionCall: FunctionCall = {
      id: toolCall.id || `fc-${Date.now()}`,
      name: toolCall.function.name,
      displayName: funcDef.displayName,
      parameters: toolCallArgs as Record<string, unknown>,
      category: funcDef.category,
      needsConfirmation: funcDef.needsConfirmation,
    };

    // 执行工具
    const result = await executeFunction(functionCall);

    // 格式化结果描述
    const formattedResult = result.success
      ? this.formatFunctionResult(functionCall.name, functionCall.parameters, result.data)
      : undefined;

    // 更新迭代状态
    iterationInfo.functionCall = {
      id: functionCall.id,
      name: functionCall.name,
      displayName: funcDef.displayName,
      description: funcDef.description,
      category: functionCall.category,
      status: result.success ? "completed" : "failed",
      result: formattedResult || (result.success ? "执行成功" : undefined),
      error: result.success ? undefined : result.error,
    };

    // 创建工具消息
    const toolMessage: Message = {
      role: "tool",
      content: JSON.stringify({
        success: result.success,
        data: result.data,
        error: result.error,
        jobId: result.jobId,
      }),
      tool_call_id: toolCall.id || `fc-${Date.now()}`,
    };

    state.messages.push(toolMessage);

    // 发送状态更新
    yield {
      type: "state_update",
      data: {
        iterations: state.iterations,
        currentIteration: state.currentIteration,
      },
    };

    // 保存中间状态
    await this.saveAssistantResponse(
      state.assistantMessageId!,
      "",
      state.iterations
    );
  }

  /**
   * 保存用户消息
   */
  private async saveUserMessage(conversationId: string, content: string): Promise<string> {
    const messageId = `msg_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(conversationMessage).values({
      id: messageId,
      conversationId,
      role: "user",
      content,
      createdAt: new Date(),
    });

    return messageId;
  }

  /**
   * 创建 assistant 消息占位
   */
  private async createAssistantMessage(conversationId: string): Promise<string> {
    const messageId = `msg_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(conversationMessage).values({
      id: messageId,
      conversationId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
    });

    return messageId;
  }

  /**
   * 保存 assistant 响应
   */
  private async saveAssistantResponse(
    messageId: string,
    content: string,
    iterations: IterationInfo[]
  ): Promise<void> {
    await db
      .update(conversationMessage)
      .set({
        content,
        iterations: JSON.stringify(iterations),
      })
      .where(eq(conversationMessage.id, messageId));
  }

  /**
   * 更新对话状态
   */
  private async updateConversationStatus(
    conversationId: string,
    status: "active" | "awaiting_approval" | "completed"
  ): Promise<void> {
    await db
      .update(conversation)
      .set({
        status,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(conversation.id, conversationId));
  }

  /**
   * 保存对话上下文
   */
  private async saveConversationContext(
    conversationId: string,
    context: AgentContext
  ): Promise<void> {
    await db
      .update(conversation)
      .set({
        context: JSON.stringify(context),
        updatedAt: new Date(),
      })
      .where(eq(conversation.id, conversationId));
  }

  /**
   * 保存对话状态（用于恢复）
   */
  private async saveConversationState(state: ConversationState): Promise<void> {
    // 只保存 pendingAction 到数据库
    // 其他数据（messages, iterations）已经通过 conversationMessage 表保存
    await db
      .update(conversation)
      .set({
        pendingAction: state.pendingAction ? JSON.stringify(state.pendingAction) : null,
        updatedAt: new Date(),
      })
      .where(eq(conversation.id, state.conversationId));

    // 同时更新 assistant 消息的 iterations
    if (state.assistantMessageId) {
      await this.saveAssistantResponse(
        state.assistantMessageId,
        "",
        state.iterations
      );
    }
  }

  /**
   * 加载对话状态（从数据库重建）
   */
  private async loadConversationState(conversationId: string): Promise<ConversationState | null> {
    // 1. 查询对话基本信息和所有消息
    const conv = await db.query.conversation.findFirst({
      where: eq(conversation.id, conversationId),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        },
      },
    });

    if (!conv) {
      return null;
    }

    try {
      // 2. 重建消息历史
      const messages: Message[] = [];
      
      // 添加系统消息
      messages.push({ role: "system", content: buildSystemPrompt() });
      
      // 添加项目上下文消息
      // 从数据库加载保存的上下文，如果没有则使用默认值
      let agentContext: AgentContext;
      if (conv.context) {
        try {
          agentContext = JSON.parse(conv.context) as AgentContext;
          // 确保 projectId 匹配（防止数据不一致）
          agentContext.projectId = conv.projectId;
        } catch (e) {
          console.warn("[AgentEngine] 解析保存的上下文失败，使用默认值:", e);
          agentContext = {
            projectId: conv.projectId,
            selectedEpisodeId: null,
            selectedShotIds: [],
            selectedResource: null,
            recentJobs: [],
          };
        }
      } else {
        // 旧对话没有保存上下文，使用默认值
        agentContext = {
          projectId: conv.projectId,
          selectedEpisodeId: null,
          selectedShotIds: [],
          selectedResource: null,
          recentJobs: [],
        };
      }
      const contextText = await collectContext(agentContext);
      messages.push({ role: "system", content: `# 当前上下文\n\n${contextText}` });
      
      // 3. 先获取最后的 assistant 消息和解析 pendingAction（用于重建 tool_calls）
      const lastAssistantMsg = conv.messages
        .filter(m => m.role === "assistant")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      
      let pendingAction: PendingActionInfo | undefined;
      if (conv.pendingAction) {
        try {
          pendingAction = JSON.parse(conv.pendingAction);
        } catch (e) {
          console.warn("[AgentEngine] 解析 pendingAction 失败:", e);
        }
      }

      // 4. 重建对话消息
      for (const msg of conv.messages) {
        if (msg.role === "user") {
          messages.push({ role: "user", content: msg.content });
        } else if (msg.role === "assistant") {
          // 解析 assistant 消息的 iterations 以重建 tool_calls
          let toolCalls: Message["tool_calls"] = undefined;
          
          // 如果是最后一个 assistant 消息且有 pendingAction，使用 pendingAction 重建 tool_calls
          const isLastAssistantMsg = msg.id === lastAssistantMsg?.id;
          if (isLastAssistantMsg && pendingAction) {
            toolCalls = [{
              id: pendingAction.functionCall.id,
              type: "function",
              function: {
                name: pendingAction.functionCall.name,
                arguments: JSON.stringify(pendingAction.functionCall.arguments || {}),
              },
            }];
          } else if (msg.iterations) {
            // 否则从 iterations 中重建
            try {
              const iterations = JSON.parse(msg.iterations);
              const lastIteration = iterations[iterations.length - 1];
              if (lastIteration?.functionCall) {
                toolCalls = [{
                  id: lastIteration.functionCall.id,
                  type: "function",
                  function: {
                    name: lastIteration.functionCall.name,
                    arguments: "{}", // 参数已经执行过，不需要重建
                  },
                }];
              }
            } catch (e) {
              console.warn("[AgentEngine] 解析 iterations 失败:", e);
            }
          }
          
          messages.push({
            role: "assistant",
            content: msg.content,
            tool_calls: toolCalls,
          });
        }
        // tool 消息会在恢复时重新添加
      }

      // 5. 获取 iterations
      let iterations: IterationInfo[] = [];
      let currentIteration = 0;
      
      if (lastAssistantMsg?.iterations) {
        try {
          iterations = JSON.parse(lastAssistantMsg.iterations);
          currentIteration = iterations.length;
        } catch (e) {
          console.warn("[AgentEngine] 解析 iterations 失败:", e);
        }
      }

      return {
        conversationId,
        projectContext: agentContext, // 使用从数据库加载的上下文
        messages,
        iterations,
        currentIteration,
        pendingAction,
        assistantMessageId: lastAssistantMsg?.id,
      };
    } catch (error) {
      console.error("[AgentEngine] 加载对话状态失败:", error);
      return null;
    }
  }
}

