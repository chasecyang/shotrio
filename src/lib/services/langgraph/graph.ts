/**
 * LangGraph Agent State Graph
 * 
 * 定义 Agent 执行流程的状态图
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { AgentStateAnnotation, type AgentState, type IterationInfo, type PendingActionInfo } from "./state";
import { getCheckpointer } from "./checkpointer";
import { AGENT_FUNCTIONS, getFunctionDefinition } from "@/lib/actions/agent/functions";
import { executeFunction } from "@/lib/actions/agent/executor";
import { collectContext } from "@/lib/actions/agent/context-collector";
import { estimateActionCredits } from "@/lib/actions/credits/estimate";
import type { FunctionCall } from "@/types/agent";

/**
 * 构建 Agent 系统提示词
 */
function buildAgentSystemPrompt(): string {
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
 * 将 Function 定义转换为 LangChain tools 格式
 */
function convertToLangChainTools() {
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
 * 节点1: 收集上下文
 */
async function collectContextNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log("[LangGraph] 收集上下文...");
  
  // 如果消息中已经有系统提示词，跳过
  if (state.messages.some(m => m._getType() === "system")) {
    return {};
  }
  
  // 收集项目上下文
  const contextText = await collectContext(state.projectContext);
  
  // 构建系统消息
  const systemPrompt = buildAgentSystemPrompt();
  const systemMessage = new HumanMessage({
    content: `${systemPrompt}\n\n# 当前上下文\n\n${contextText}`,
  });
  
  return {
    messages: [systemMessage],
  };
}

/**
 * 节点2: 调用 AI 模型
 */
async function callModelNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log("[LangGraph] 调用 AI 模型...");
  
  // 增加迭代计数
  const iterationNumber = state.currentIteration + 1;
  
  // 创建新的迭代记录
  const newIteration: IterationInfo = {
    id: `iter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    iterationNumber,
    timestamp: new Date(),
  };
  
  // 从环境变量选择模型
  // OPENAI_AGENT_MODEL: Agent 专用模型（优先级最高）
  // OPENAI_REASONING_MODEL: 推理模型（如 deepseek-reasoner）
  // OPENAI_CHAT_MODEL: 对话模型（如 deepseek-chat，默认）
  const modelName = process.env.OPENAI_AGENT_MODEL 
    || process.env.OPENAI_REASONING_MODEL 
    || process.env.OPENAI_CHAT_MODEL 
    || "deepseek-chat";
  
  console.log(`[LangGraph] 使用模型: ${modelName}`);
  
  const model = new ChatOpenAI({
    modelName,
    temperature: 0.7,
    maxTokens: 4096, // DeepSeek 最大支持 8192，使用 4096 平衡速度和质量
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL,
    },
  });
  
  // 绑定工具
  const modelWithTools = model.bindTools(convertToLangChainTools());
  
  // 调用模型
  const response = await modelWithTools.invoke(state.messages);
  
  // 更新迭代信息
  if (response.content) {
    newIteration.content = typeof response.content === "string" 
      ? response.content 
      : JSON.stringify(response.content);
  }
  
  return {
    messages: [response],
    iterations: [...state.iterations, newIteration], // 追加到现有迭代
    currentIteration: iterationNumber,
  };
}

/**
 * 节点3: 检查工具调用
 * 
 * 判断是否需要执行工具
 */
function shouldContinue(state: AgentState): "checkConfirmation" | "end" {
  const lastMessage = state.messages[state.messages.length - 1];
  
  // 检查是否有工具调用
  if (lastMessage._getType() === "ai" && (lastMessage as AIMessage).tool_calls?.length) {
    return "checkConfirmation";
  }
  
  return "end";
}

/**
 * 节点4: 检查是否需要确认
 */
async function checkConfirmationNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log("[LangGraph] 检查是否需要确认...");
  
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCall = lastMessage.tool_calls?.[0];
  
  if (!toolCall) {
    throw new Error("No tool call found");
  }
  
  const funcDef = getFunctionDefinition(toolCall.name);
  
  if (!funcDef) {
    throw new Error(`Unknown function: ${toolCall.name}`);
  }
  
  // 如果需要确认，设置 pendingAction
  if (funcDef.needsConfirmation) {
    // 估算积分消耗
    let creditCost;
    try {
      const functionCall: FunctionCall = {
        id: toolCall.id || `fc-${Date.now()}`,
        name: toolCall.name,
        displayName: funcDef.displayName,
        parameters: toolCall.args as Record<string, unknown>,
        category: funcDef.category,
        needsConfirmation: funcDef.needsConfirmation,
      };
      
      const estimateResult = await estimateActionCredits([functionCall]);
      if (estimateResult.success && estimateResult.creditCost) {
        creditCost = estimateResult.creditCost;
      }
    } catch (error) {
      console.error("[LangGraph] 估算积分失败:", error);
    }
    
    const pendingAction: PendingActionInfo = {
      id: `action-${Date.now()}`,
      functionCall: {
        id: toolCall.id || `fc-${Date.now()}`,
        name: toolCall.name,
        displayName: funcDef.displayName,
        arguments: toolCall.args as Record<string, unknown>,
        category: funcDef.category,
      },
      message: lastMessage.content as string || `准备执行: ${funcDef.displayName || toolCall.name}`,
      creditCost,
      createdAt: new Date(),
    };
    
    return {
      pendingAction,
    };
  }
  
  return {};
}

/**
 * 决定是否需要等待用户确认
 */
function needsApproval(state: AgentState): "waitForApproval" | "executeTool" {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCall = lastMessage.tool_calls?.[0];
  
  if (!toolCall) {
    return "executeTool";
  }
  
  const funcDef = getFunctionDefinition(toolCall.name);
  
  if (funcDef?.needsConfirmation) {
    return "waitForApproval";
  }
  
  return "executeTool";
}

/**
 * 节点5: 等待用户确认
 * 
 * 这个节点会中断执行，等待用户确认或拒绝
 */
async function waitForApprovalNode(): Promise<Partial<AgentState>> {
  console.log("[LangGraph] 等待用户确认...");
  
  // 这个节点实际上不做任何事情
  // 它的作用是标记一个中断点
  // LangGraph 会在这里暂停，等待外部输入
  
  return {};
}

/**
 * 节点6: 执行工具
 */
async function executeToolNode(state: AgentState): Promise<Partial<AgentState>> {
  console.log("[LangGraph] 执行工具...");
  
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCall = lastMessage.tool_calls?.[0];
  
  if (!toolCall) {
    throw new Error("No tool call found");
  }
  
  const funcDef = getFunctionDefinition(toolCall.name);
  
  if (!funcDef) {
    throw new Error(`Unknown function: ${toolCall.name}`);
  }
  
  // 检查用户是否拒绝了操作
  if (state.userApproval && !state.userApproval.approved) {
    console.log("[LangGraph] 用户拒绝了操作，返回拒绝消息");
    
    // 创建拒绝消息
    const toolMessage = new ToolMessage({
      content: JSON.stringify({
        success: false,
        error: state.userApproval.reason || "用户拒绝了此操作",
        userRejected: true,
      }),
      tool_call_id: toolCall.id || `fc-${Date.now()}`,
    });
    
    // 更新迭代状态
    const currentIterations = [...state.iterations];
    const lastIteration = currentIterations[currentIterations.length - 1];
    
    if (lastIteration) {
      lastIteration.functionCall = {
        id: toolCall.id || `fc-${Date.now()}`,
        name: toolCall.name,
        displayName: funcDef.displayName,
        description: funcDef.description,
        category: funcDef.category,
        status: "failed",
        error: state.userApproval.reason || "用户拒绝了此操作",
      };
    }
    
    return {
      messages: [toolMessage],
      iterations: currentIterations,
      pendingAction: undefined,
      userApproval: undefined, // 清除审批状态
    };
  }
  
  // 构建 FunctionCall
  const functionCall: FunctionCall = {
    id: toolCall.id || `fc-${Date.now()}`,
    name: toolCall.name,
    displayName: funcDef.displayName,
    parameters: toolCall.args as Record<string, unknown>,
    category: funcDef.category,
    needsConfirmation: funcDef.needsConfirmation,
  };
  
  // 执行工具
  const result = await executeFunction(functionCall);
  
  // 更新当前迭代的工具调用状态
  const currentIterations = [...state.iterations];
  const lastIteration = currentIterations[currentIterations.length - 1];
  
  if (lastIteration) {
    lastIteration.functionCall = {
      id: functionCall.id,
      name: functionCall.name,
      displayName: funcDef.displayName,
      description: funcDef.description,
      category: functionCall.category,
      status: result.success ? "completed" : "failed",
      result: result.success ? "执行成功" : undefined,
      error: result.success ? undefined : result.error,
    };
  }
  
  // 创建工具消息
  const toolMessage = new ToolMessage({
    content: JSON.stringify({
      success: result.success,
      data: result.data,
      error: result.error,
      jobId: result.jobId,
    }),
    tool_call_id: toolCall.id || `fc-${Date.now()}`,
  });
  
  return {
    messages: [toolMessage],
    iterations: currentIterations,
    pendingAction: undefined, // 清除 pendingAction
    userApproval: undefined, // 清除审批状态
  };
}

/**
 * 创建 Agent 状态图
 */
export async function createAgentGraph() {
  const checkpointer = await getCheckpointer();
  
  // 创建状态图
  const workflow = new StateGraph(AgentStateAnnotation)
    // 添加节点
    .addNode("collectContext", collectContextNode)
    .addNode("callModel", callModelNode)
    .addNode("checkConfirmation", checkConfirmationNode)
    .addNode("waitForApproval", waitForApprovalNode)
    .addNode("executeTool", executeToolNode)
    // 定义边
    .addEdge(START, "collectContext")
    .addEdge("collectContext", "callModel")
    .addConditionalEdges("callModel", shouldContinue, {
      checkConfirmation: "checkConfirmation",
      end: END,
    })
    .addConditionalEdges("checkConfirmation", needsApproval, {
      waitForApproval: "waitForApproval",
      executeTool: "executeTool",
    })
    .addEdge("waitForApproval", "executeTool")
    .addEdge("executeTool", "callModel");
  
  // 编译图
  const graph = workflow.compile({
    checkpointer,
    interruptBefore: ["waitForApproval"], // 在等待确认前中断
  });
  
  return graph;
}

/**
 * 获取或创建 Agent 图实例（单例）
 */
let graphInstance: Awaited<ReturnType<typeof createAgentGraph>> | null = null;

export async function getAgentGraph() {
  if (!graphInstance) {
    graphInstance = await createAgentGraph();
  }
  return graphInstance;
}

