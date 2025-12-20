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
import { Send, Loader2, Trash2, Bot, Info } from "lucide-react";
import { toast } from "sonner";
import { confirmAndExecuteAction, cancelAction } from "@/lib/actions/agent";
import { useTaskTracking } from "./use-task-tracking";
import type { IterationStep, FunctionCategory } from "@/types/agent";

interface AgentPanelProps {
  projectId: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AgentPanel({ projectId: _projectId }: AgentPanelProps) {
  const agent = useAgent();
  
  // 启用任务追踪
  useTaskTracking();
  
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent.state.messages, isProcessing]);

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
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法获取响应流");
      }

      const decoder = new TextDecoder();
      const iterations: IterationStep[] = [];
      let currentIteration: IterationStep | null = null;
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
                currentIteration = {
                  id: `iter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  iterationNumber: event.data.iterationNumber,
                  timestamp: new Date(),
                };
                iterations.push(currentIteration);
                agent.updateMessage(tempMsgId, {
                  iterations: [...iterations],
                  isStreaming: true,
                });
                break;

              case "thinking":
                if (currentIteration) {
                  currentIteration.thinkingProcess = event.data.content;
                  agent.updateMessage(tempMsgId, {
                    iterations: [...iterations],
                    isStreaming: true,
                  });
                }
                break;

              case "content":
                if (currentIteration) {
                  // event.data.content 已经是该轮的完整累积内容
                  currentIteration.content = event.data.content;
                  agent.updateMessage(tempMsgId, {
                    iterations: [...iterations],
                    isStreaming: true,
                  });
                }
                break;

              case "function_start":
                // 显示正在执行的工具
                toast.info(`正在执行：${event.data.displayName || event.data.description || event.data.name}`);
                if (currentIteration) {
                  currentIteration.functionCall = {
                    id: `fc-${Date.now()}`,
                    name: event.data.name,
                    description: event.data.description,
                    displayName: event.data.displayName,
                    category: event.data.category as FunctionCategory,
                    status: "executing",
                  };
                  agent.updateMessage(tempMsgId, {
                    iterations: [...iterations],
                    isStreaming: true,
                  });
                }
                break;

              case "function_result":
                if (currentIteration?.functionCall) {
                  if (event.data.success) {
                    currentIteration.functionCall.status = "completed";
                    currentIteration.functionCall.result = "执行成功";
                    if (event.data.jobId) {
                      // 如果创建了 Job，添加任务追踪
                      agent.addTask({
                        functionCallId: event.data.functionCallId,
                        functionName: currentIteration.functionCall.name,
                        jobId: event.data.jobId,
                        status: "running",
                      });
                    }
                  } else {
                    currentIteration.functionCall.status = "failed";
                    currentIteration.functionCall.error = event.data.error;
                  }
                  agent.updateMessage(tempMsgId, {
                    iterations: [...iterations],
                    isStreaming: true,
                  });
                }
                break;

              case "pending_action":
                // 添加待确认操作
                const actionData = event.data;
                agent.addPendingAction({
                  functionCalls: [actionData.functionCall],
                  message: actionData.message,
                });
                break;

              case "complete":
                // 流结束
                break;

              case "error":
                toast.error(event.data);
                if (currentIteration) {
                  currentIteration.content = (currentIteration.content || "") + `\n\n错误：${event.data}`;
                }
                agent.updateMessage(tempMsgId, {
                  iterations: [...iterations],
                  isStreaming: true,
                });
                break;
            }
          } catch (parseError) {
            console.error("解析事件失败:", line, parseError);
          }
        }
      }

      // 最终更新消息，标记流式完成
      // 合并所有迭代的content作为完整内容
      const finalContent = iterations
        .map((iter) => iter.content)
        .filter(Boolean)
        .join("\n\n");
      
      agent.updateMessage(tempMsgId, {
        content: finalContent || "完成",
        iterations: [...iterations],
        isStreaming: false,
      });
    } catch (error) {
      console.error("流式处理失败:", error);
      toast.error("发送失败");
      agent.updateMessage(tempMsgId, {
        content: `抱歉，出错了：${error instanceof Error ? error.message : "未知错误"}`,
        isStreaming: false,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, agent]);

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

        // 添加结果消息
        agent.addMessage({
          role: "assistant",
          content: response.message || "操作已完成",
        });

        // 移除 pending action
        agent.removePendingAction(action.id);

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
  }, [agent]);

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
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}

