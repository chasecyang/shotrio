"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAgent } from "./agent-context";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { PendingActionCard } from "./pending-action-card";
import { TaskStatusCard } from "./task-status-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Send, Trash2, Bot, Info, Square } from "lucide-react";
import { toast } from "sonner";
import { confirmAndExecuteAction, cancelAction } from "@/lib/actions/agent";
import { useTaskTracking } from "./use-task-tracking";
import type { IterationStep, FunctionCategory } from "@/types/agent";

interface AgentPanelProps {
  projectId: string;
}

// 分镜相关操作，执行成功后需要刷新时间轴
const SHOT_RELATED_FUNCTIONS = [
  'create_shot', 'batch_create_shots',
  'update_shot', 'batch_update_shot_duration',
  'delete_shots', 'reorder_shots'
];

// 辅助函数：创建新的 iterations 数组（确保触发 React 重新渲染）
// 放在组件外部避免每次渲染创建新函数
function updateIterations(
  iterations: IterationStep[],
  index: number,
  updates: Partial<IterationStep>
): IterationStep[] {
  return iterations.map((iter, i) =>
    i === index ? { ...iter, ...updates } : iter
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AgentPanel({ projectId: _projectId }: AgentPanelProps) {
  const agent = useAgent();
  
  // 启用任务追踪
  useTaskTracking();
  
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent.state.messages, isProcessing]);

  // 处理流式请求错误的辅助函数
  const handleStreamError = useCallback((error: unknown, tempMsgId: string, errorContext: string) => {
    // 检查是否是用户中断
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("用户中断了 AI 生成");
      agent.updateMessage(tempMsgId, {
        content: agent.state.messages.find(m => m.id === tempMsgId)?.content || "",
        isStreaming: false,
        isInterrupted: true,
      });
      toast.info("已停止 AI 生成");
    } else {
      console.error(`${errorContext}:`, error);
      toast.error(errorContext === "流式处理失败" ? "发送失败" : "继续执行失败");
      agent.updateMessage(tempMsgId, {
        content: `抱歉，出错了：${error instanceof Error ? error.message : "未知错误"}`,
        isStreaming: false,
      });
    }
  }, [agent]);

  // 处理流式响应的通用函数
  const processStreamingResponse = useCallback(async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    tempMsgId: string
  ) => {
    const decoder = new TextDecoder();
    let iterations: IterationStep[] = [];
    let currentIterationIndex = -1;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 解码并添加到缓冲区
      buffer += decoder.decode(value, { stream: true });

      // 按行分割
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // 保留最后一个不完整的行

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);

          switch (event.type) {
            case "status":
              // Status events are handled by the typing indicator
              break;

            case "iteration_start":
              // 创建新的迭代步骤
              iterations = [...iterations, {
                id: `iter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                iterationNumber: event.data.iterationNumber,
                timestamp: new Date(),
              }];
              currentIterationIndex = iterations.length - 1;
              agent.updateMessage(tempMsgId, { iterations, isStreaming: true });
              break;

            case "thinking":
              if (currentIterationIndex >= 0) {
                iterations = updateIterations(iterations, currentIterationIndex, {
                  thinkingProcess: event.data.content,
                });
                agent.updateMessage(tempMsgId, { iterations, isStreaming: true });
              }
              break;

            case "content":
              if (currentIterationIndex >= 0) {
                iterations = updateIterations(iterations, currentIterationIndex, {
                  content: event.data.content,
                });
                agent.updateMessage(tempMsgId, { iterations, isStreaming: true });
              }
              break;

            case "function_start":
              toast.info(`正在执行：${event.data.displayName || event.data.description || event.data.name}`);
              if (currentIterationIndex >= 0) {
                iterations = updateIterations(iterations, currentIterationIndex, {
                  functionCall: {
                    id: `fc-${Date.now()}`,
                    name: event.data.name,
                    description: event.data.description,
                    displayName: event.data.displayName,
                    category: event.data.category as FunctionCategory,
                    status: "executing",
                  },
                });
                agent.updateMessage(tempMsgId, { iterations, isStreaming: true });
              }
              break;

            case "function_result":
              if (currentIterationIndex >= 0 && iterations[currentIterationIndex]?.functionCall) {
                const fc = iterations[currentIterationIndex].functionCall!;
                iterations = updateIterations(iterations, currentIterationIndex, {
                  functionCall: {
                    ...fc,
                    status: event.data.success ? "completed" : "failed",
                    result: event.data.success ? "执行成功" : undefined,
                    error: event.data.success ? undefined : event.data.error,
                  },
                });
                if (event.data.success && event.data.jobId) {
                  agent.addTask({
                    functionCallId: event.data.functionCallId,
                    functionName: fc.name,
                    jobId: event.data.jobId,
                    status: "running",
                  });
                }
                // 如果是分镜相关操作执行成功，触发时间轴刷新
                if (event.data.success && SHOT_RELATED_FUNCTIONS.includes(fc.name)) {
                  window.dispatchEvent(new CustomEvent("shots-changed"));
                }
                agent.updateMessage(tempMsgId, { iterations, isStreaming: true });
              }
              break;

            case "pending_action":
              // 添加待确认操作
              const actionData = event.data;
              agent.addPendingAction({
                functionCalls: [actionData.functionCall],
                message: actionData.message,
                conversationState: actionData.conversationState,
              });
              break;

            case "complete":
              // 流结束
              break;

            case "error":
              toast.error(event.data);
              if (currentIterationIndex >= 0) {
                const currentContent = iterations[currentIterationIndex]?.content || "";
                iterations = updateIterations(iterations, currentIterationIndex, {
                  content: currentContent + `\n\n错误：${event.data}`,
                });
                agent.updateMessage(tempMsgId, { iterations, isStreaming: true });
              }
              break;
          }
        } catch (parseError) {
          console.error("解析事件失败:", line, parseError);
        }
      }
    }

    // 最终更新消息，标记流式完成
    const finalContent = iterations.map((iter) => iter.content).filter(Boolean).join("\n\n");
    agent.updateMessage(tempMsgId, {
      content: finalContent || "完成",
      iterations,
      isStreaming: false,
    });
  }, [agent]);

  // 发送消息（流式版本）
  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    setIsProcessing(true);

    // 添加用户消息
    agent.addMessage({
      role: "user",
      content: userMessage,
    });

    // 创建临时 AI 消息，标记为流式中
    const tempMsgId = agent.addMessage({
      role: "assistant",
      content: "",
      isStreaming: true,
      iterations: [],
    });

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    try {
      // 调用流式 API
      const response = await fetch("/api/agent/chat-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          context: agent.currentContext,
          history: agent.state.messages.slice(0, -1), // 不包含刚创建的临时消息
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法获取响应流");
      }

      await processStreamingResponse(reader, tempMsgId);
    } catch (error) {
      handleStreamError(error, tempMsgId, "流式处理失败");
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [input, isProcessing, agent, processStreamingResponse, handleStreamError]);

  // 恢复对话（用户确认操作后）
  const resumeConversation = useCallback(async (
    action: typeof agent.state.pendingActions[0], 
    executionResults: Array<{
      functionCallId: string;
      success: boolean;
      data?: unknown;
      error?: string;
      jobId?: string;
    }> | undefined
  ) => {
    if (!action.conversationState || !executionResults) return;

    setIsProcessing(true);

    // 创建新的 AI 消息用于继续对话
    const tempMsgId = agent.addMessage({
      role: "assistant",
      content: "",
      isStreaming: true,
      iterations: [],
    });

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    try {
      // 调用恢复对话 API
      const response = await fetch("/api/agent/resume-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationState: action.conversationState,
          executionResults,
          context: agent.currentContext,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法获取响应流");
      }

      await processStreamingResponse(reader, tempMsgId);
    } catch (error) {
      handleStreamError(error, tempMsgId, "恢复对话失败");
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [agent, processStreamingResponse, handleStreamError]);

  // 确认操作
  const handleConfirmAction = useCallback(async (actionId: string) => {
    const action = agent.state.pendingActions.find((a) => a.id === actionId);
    if (!action) return;

    try {
      const response = await confirmAndExecuteAction({
        actionId: action.id,
        functionCalls: action.functionCalls,
      });

      if (response.success) {
        toast.success(response.message || "执行成功");

        // 移除 pending action
        agent.removePendingAction(action.id);

        // 如果是分镜相关操作，触发时间轴刷新
        const functionName = action.functionCalls[0]?.name;
        if (functionName && SHOT_RELATED_FUNCTIONS.includes(functionName)) {
          window.dispatchEvent(new CustomEvent("shots-changed"));
        }

        // 如果有任务 ID，创建任务追踪
        if (response.executedResults) {
          response.executedResults.forEach((result) => {
            if (result.jobId) {
              agent.addTask({
                functionCallId: "",
                functionName: action.functionCalls[0].name,
                jobId: result.jobId,
                status: "running",
              });
            }
          });
        }

        // 如果有对话状态，恢复对话让 Agent 继续
        if (action.conversationState) {
          await resumeConversation(action, response.executedResults);
        } else {
          // 没有对话状态时，添加结果消息（向后兼容）
          agent.addMessage({
            role: "assistant",
            content: response.message || "操作已完成",
          });
        }
      } else {
        toast.error(response.error || "执行失败");
        agent.addMessage({
          role: "assistant",
          content: `执行失败：${response.error || "未知错误"}`,
        });
      }
    } catch (error) {
      console.error("执行操作失败:", error);
      toast.error("执行失败");
    }
  }, [agent, resumeConversation]);

  // 停止 AI 生成
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // 取消操作
  const handleCancelAction = useCallback(async (actionId: string) => {
    await cancelAction(actionId);
    agent.removePendingAction(actionId);
    toast.info("已取消操作");
  }, [agent]);

  // 清除历史
  const handleClearHistory = useCallback(() => {
    agent.clearMessages();
    toast.success("已清除对话历史");
  }, [agent]);

  // 键盘快捷键
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <h3 className="text-sm font-semibold">AI 助手</h3>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleClearHistory}
          disabled={agent.state.messages.length === 0}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages - with proper overflow handling */}
      <div className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden">
          <div className="py-2">
            {agent.state.messages.length === 0 && !isProcessing ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <Info className="mb-4 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  向 AI 助手描述你想要做什么
                </p>
              </div>
            ) : (
              <>
                {agent.state.messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {isProcessing && <TypingIndicator />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pending Actions */}
      {agent.state.pendingActions.length > 0 && (
        <>
          <Separator />
          <div className="border-t border-border bg-muted/30 p-4 shrink-0">
            <h4 className="mb-3 text-sm font-semibold">待确认操作</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {agent.state.pendingActions.map((action) => (
                <PendingActionCard
                  key={action.id}
                  action={action}
                  onConfirm={handleConfirmAction}
                  onCancel={handleCancelAction}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Running Tasks */}
      {agent.state.runningTasks.length > 0 && (
        <>
          <Separator />
          <div className="border-t border-border bg-muted/30 p-4 shrink-0">
            <h4 className="mb-3 text-sm font-semibold">执行中的任务</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {agent.state.runningTasks.map((task) => (
                <TaskStatusCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Input */}
      <div className="border-t border-border p-4 shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想要做什么..."
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={isProcessing}
          />
          <Button
            onClick={isProcessing ? handleStop : handleSend}
            disabled={!isProcessing && !input.trim()}
            size="icon"
            variant={isProcessing ? "destructive" : "default"}
            className="h-[60px] w-[60px] shrink-0"
            title={isProcessing ? "停止生成" : "发送消息"}
          >
            {isProcessing ? (
              <Square className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isProcessing ? "点击停止按钮中断生成" : "Enter 发送 · Shift+Enter 换行"}
        </p>
      </div>
    </div>
  );
}

