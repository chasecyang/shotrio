"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAgent } from "./agent-context";
import { useAgentStream } from "./use-agent-stream";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, Square } from "lucide-react";
import { toast } from "sonner";
import { getCreditBalance } from "@/lib/actions/credits/balance";
import { createConversation } from "@/lib/actions/conversation/crud";
import type { IterationStep } from "@/types/agent";

interface AgentPanelProps {
  projectId: string;
}

// 判断是否为分镜相关操作
function isShotRelatedFunction(functionName: string): boolean {
  const shotRelatedFunctions = [
    'create_shot',
    'update_shot',
    'delete_shots', 'reorder_shots'
  ];
  return shotRelatedFunctions.includes(functionName);
}

export function AgentPanel({ projectId }: AgentPanelProps) {
  const agent = useAgent();
  const t = useTranslations();
  
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 使用 Agent Stream Hook
  const { sendMessage, abort } = useAgentStream({
    onIterationUpdate: (iterations: IterationStep[]) => {
      // 检查是否有分镜相关操作完成
      const lastIteration = iterations[iterations.length - 1];
      if (lastIteration?.functionCall?.status === "completed" && 
          isShotRelatedFunction(lastIteration.functionCall.name)) {
        // 延迟触发刷新，确保数据库操作已完成
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("shots-changed"));
        }, 200);
      }
    },
    onComplete: () => {
      setIsProcessing(false);
      
      // 检查当前消息的所有iterations，看是否有分镜相关操作完成
      const currentMessage = agent.state.messages.find(
        m => m.id === agent.state.messages[agent.state.messages.length - 1]?.id
      );
      if (currentMessage?.iterations) {
        const hasShotRelatedCompleted = currentMessage.iterations.some(
          iteration => 
            iteration.functionCall?.status === "completed" && 
            isShotRelatedFunction(iteration.functionCall.name)
        );
        if (hasShotRelatedCompleted) {
          // 延迟触发刷新，确保数据库操作已完成
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("shots-changed"));
          }, 300);
        }
      }
      
      // 延迟刷新对话列表
      setTimeout(() => {
        agent.refreshConversations();
      }, 100);
    },
    onError: (error) => {
      setIsProcessing(false);
      console.error("Agent Stream 错误:", error);
      if (error !== "用户中断") {
        toast.error("发送失败");
      }
    },
  });

  // 获取用户积分余额
  useEffect(() => {
    async function fetchBalance() {
      try {
        const result = await getCreditBalance();
        if (result.success && result.balance) {
          setCreditBalance(result.balance.balance);
        }
      } catch (error) {
        console.error("获取积分余额失败:", error);
      }
    }
    fetchBalance();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent.state.messages, isProcessing]);

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    setIsProcessing(true);

    try {
      let conversationId = agent.state.currentConversationId;

      // 如果是新对话模式，先创建对话
      if (agent.state.isNewConversation || !conversationId) {
        const result = await createConversation({ 
          projectId,
          title: t('editor.agent.panel.newConversation'), // 临时标题，稍后会被AI生成的标题替换
          context: agent.currentContext // 保存当前上下文（选中的剧集、分镜等）
        });
        
        if (!result.success || !result.conversationId) {
          toast.error(result.error || "创建对话失败");
          setIsProcessing(false);
          return;
        }
        
        conversationId = result.conversationId;
        
        // 批量更新状态（React 18 会自动批处理）
        agent.dispatch({ type: "SET_CURRENT_CONVERSATION", payload: conversationId });
        agent.dispatch({ type: "SET_NEW_CONVERSATION", payload: false });
        
        // 异步刷新对话列表（不阻塞消息发送）
        agent.refreshConversations();
      }

      // 添加用户消息到本地状态
      agent.addMessage({
        role: "user",
        content: userMessage,
      });

      // 使用 hook 发送消息
      await sendMessage(userMessage, agent.currentContext, conversationId);
    } catch (error) {
      setIsProcessing(false);
      console.error("发送消息失败:", error);
      toast.error("发送失败");
    }
  }, [input, isProcessing, agent, projectId, sendMessage, t]);

  // 停止 AI 生成
  const handleStop = useCallback(() => {
    abort();
    toast.info("已停止 AI 生成");
  }, [abort]);

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
    <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <h3 className="text-sm font-semibold">
              {agent.state.isNewConversation 
                ? t('editor.agent.panel.newConversation')
                : agent.state.conversations.find(c => c.id === agent.state.currentConversationId)?.title || t('editor.agent.panel.aiAssistant')}
            </h3>
          </div>
        </div>

        {/* Messages - with proper overflow handling */}
        <div className="flex-1 overflow-hidden">
          <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden">
            <div className="py-2">
              {agent.state.isNewConversation || (agent.state.messages.length === 0 && !isProcessing) ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    {agent.state.isNewConversation ? t('editor.agent.panel.startNewConversation') : t('editor.agent.panel.startConversation')}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    {t('editor.agent.panel.welcomeMessage')}
                  </p>
                </div>
              ) : (
                <>
                  {agent.state.messages.map((message) => (
                    <ChatMessage 
                      key={message.id} 
                      message={message} 
                      currentBalance={creditBalance}
                    />
                  ))}
                  {isProcessing && <TypingIndicator />}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('editor.agent.chatInput.placeholder')}
              className="min-h-[60px] max-h-[120px] resize-none"
              disabled={isProcessing}
            />
            <Button
              onClick={isProcessing ? handleStop : handleSend}
              disabled={!isProcessing && !input.trim()}
              size="icon"
              variant={isProcessing ? "destructive" : "default"}
              className="h-[60px] w-[60px] shrink-0"
              title={isProcessing ? t('editor.agent.chatInput.stopGeneration') : t('editor.agent.chatInput.sendMessage')}
            >
              {isProcessing ? (
                <Square className="h-5 w-5" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {isProcessing ? t('editor.agent.chatInput.stopToInterrupt') : t('editor.agent.chatInput.enterToSend')}
          </p>
        </div>
    </div>
  );
}
