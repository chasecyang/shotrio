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
import { createConversation, updateConversationTitle } from "@/lib/actions/conversation/crud";
import { generateConversationTitle } from "@/lib/actions/conversation/title-generator";
import type { IterationStep } from "@/types/agent";

interface AgentPanelProps {
  projectId: string;
}

// 判断是否为分镜相关操作
function isShotRelatedFunction(functionName: string): boolean {
  const shotRelatedFunctions = [
    'create_shot',
    'batch_create_shots',
    'update_shot',
    'delete_shots',
    'reorder_shots'
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
  // 跟踪每个对话是否已经生成过标题，避免重复生成
  const titleGeneratedRef = useRef<Set<string>>(new Set());
  // 保存第一条用户消息，用于生成标题
  const firstUserMessageRef = useRef<{ conversationId: string; message: string } | null>(null);
  
  // 使用 Agent Stream Hook
  const { sendMessage, abort, resumeConversation } = useAgentStream({
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
      
      // 标记需要检查标题生成（在 useEffect 中实际处理）
      // 这里不直接检查，因为状态可能还没更新
      
      // 延迟刷新对话列表（静默刷新，不显示全屏loading）
      setTimeout(() => {
        agent.refreshConversations(true);
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

  // 监听对话切换，清除保存的第一条消息引用
  useEffect(() => {
    // 当切换到新对话或加载已有对话时，清除 firstUserMessageRef
    // 但保留 titleGeneratedRef，因为它是全局的，用于避免重复生成
    if (agent.state.isNewConversation || agent.state.currentConversationId) {
      // 如果当前对话已经有消息了，说明不是新对话的第一条消息，清除引用
      if (agent.state.messages.length > 0) {
        firstUserMessageRef.current = null;
      }
    }
  }, [agent.state.currentConversationId, agent.state.isNewConversation]);

  // 更新对话标题的函数
  const updateConversationTitleFromMessage = useCallback(async (
    conversationId: string,
    userMessage: string
  ) => {
    // 如果已经生成过标题，跳过
    if (titleGeneratedRef.current.has(conversationId)) {
      console.log("[AgentPanel] 标题已生成，跳过:", conversationId);
      return;
    }

    console.log("[AgentPanel] 开始生成标题，conversationId:", conversationId, "userMessage:", userMessage);

    try {
      // 生成标题
      const generatedTitle = await generateConversationTitle(userMessage);
      console.log("[AgentPanel] 生成的标题:", generatedTitle);
      
      // 更新数据库中的标题
      const result = await updateConversationTitle(conversationId, generatedTitle);
      
      if (result.success) {
        // 标记为已生成
        titleGeneratedRef.current.add(conversationId);
        
        console.log("[AgentPanel] 标题更新成功:", generatedTitle);
        
        // 更新前端状态
        agent.dispatch({
          type: "UPDATE_CONVERSATION_TITLE",
          payload: { conversationId, title: generatedTitle },
        });
        
        // 刷新对话列表以反映新标题
        agent.refreshConversations(true);
      } else {
        console.error("[AgentPanel] 更新对话标题失败:", result.error);
      }
    } catch (error) {
      console.error("[AgentPanel] 生成或更新对话标题失败:", error);
      // 失败时保持使用临时标题，不显示错误提示（避免打扰用户）
    }
  }, [agent]);

  // 监听消息变化，检查是否需要生成标题
  useEffect(() => {
    const conversationId = agent.state.currentConversationId;
    if (!conversationId || !firstUserMessageRef.current) {
      return;
    }

    // 只处理第一条消息的标题生成
    if (firstUserMessageRef.current.conversationId !== conversationId) {
      return;
    }

    // 检查是否只有一条用户消息和一条助手消息（第一条消息）
    // 排除系统消息
    const userMessages = agent.state.messages.filter(m => m.role === "user");
    const assistantMessages = agent.state.messages.filter(m => m.role === "assistant");
    
    console.log("[AgentPanel] 检查标题生成条件:", {
      conversationId,
      userMessagesCount: userMessages.length,
      assistantMessagesCount: assistantMessages.length,
      totalMessages: agent.state.messages.length,
      firstUserMessageRef: firstUserMessageRef.current,
    });
    
    // 确保有一条用户消息和至少一条助手消息，且助手消息已完成（不是流式状态）
    if (userMessages.length === 1 && assistantMessages.length >= 1) {
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
      // 如果助手消息已完成（不是流式状态），则生成标题
      if (!lastAssistantMessage.isStreaming) {
        const userMessage = firstUserMessageRef.current.message;
        console.log("[AgentPanel] 开始生成标题，用户消息:", userMessage);
        updateConversationTitleFromMessage(conversationId, userMessage);
        // 清除保存的第一条消息引用
        firstUserMessageRef.current = null;
      }
    } else if (userMessages.length > 1 || assistantMessages.length > 1) {
      // 如果不是第一条消息，清除引用
      firstUserMessageRef.current = null;
    }
  }, [agent.state.messages, agent.state.currentConversationId, updateConversationTitleFromMessage]);

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    setIsProcessing(true);

    try {
      // 检查是否有pendingAction，如果有则自动拒绝
      const lastAssistantMessage = agent.state.messages
        .filter(m => m.role === "assistant")
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      
      if (lastAssistantMessage?.pendingAction && agent.state.currentConversationId) {
        // 清除UI状态
        agent.updateMessage(lastAssistantMessage.id, {
          pendingAction: undefined,
        });
        
        // 异步拒绝pendingAction，使用新消息作为拒绝理由（不等待完成）
        resumeConversation(agent.state.currentConversationId, false, userMessage)
          .catch(error => {
            console.error("[AgentPanel] 拒绝pendingAction失败:", error);
            // 不显示错误提示，因为用户已经发送了新消息
          });
      }

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
        
        // 保存第一条用户消息，用于后续生成标题
        firstUserMessageRef.current = {
          conversationId,
          message: userMessage,
        };
        
        // 异步刷新对话列表（不阻塞消息发送，静默刷新）
        agent.refreshConversations(true);
      } else {
        // 如果已有对话，检查是否已经有用户消息
        // 如果已经有用户消息，说明不是第一条消息，清除 firstUserMessageRef
        const existingUserMessages = agent.state.messages.filter(m => m.role === "user");
        if (existingUserMessages.length > 0) {
          firstUserMessageRef.current = null;
        }
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
      // 如果发送失败，清除保存的第一条消息引用
      firstUserMessageRef.current = null;
    }
  }, [input, isProcessing, agent, projectId, sendMessage, resumeConversation, t]);

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
