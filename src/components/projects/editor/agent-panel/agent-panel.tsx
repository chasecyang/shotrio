"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAgent } from "./agent-context";
import { useAgentStream } from "./use-agent-stream";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { SuggestionCards } from "./suggestion-cards";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, Square, ArrowDown } from "lucide-react";
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
    'create_shots',
    'update_shots',
    'delete_shots',
  ];
  return shotRelatedFunctions.includes(functionName);
}

export function AgentPanel({ projectId }: AgentPanelProps) {
  const agent = useAgent();
  const t = useTranslations();
  
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | undefined>(undefined);
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 跟踪每个对话是否已经生成过标题，避免重复生成
  const titleGeneratedRef = useRef<Set<string>>(new Set());
  // 保存第一条用户消息，用于生成标题
  const firstUserMessageRef = useRef<{ conversationId: string; message: string } | null>(null);
  
  // 清除 firstUserMessageRef 的辅助函数
  const clearFirstUserMessageRef = useCallback((reason: string) => {
    if (firstUserMessageRef.current) {
      console.log(`[AgentPanel] ${reason}，清除 firstUserMessageRef`);
      firstUserMessageRef.current = null;
    }
  }, []);

  // 检测用户是否在底部
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = 100; // 距离底部100px以内视为在底部
    const nearBottom = scrollHeight - scrollTop - clientHeight < threshold;
    setIsUserNearBottom(nearBottom);
  }, []);

  // 滚动到底部的函数
  const scrollToBottom = useCallback((smooth = false) => {
    if (!scrollRef.current) return;
    if (smooth) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // 检查是否应该生成标题
  const shouldGenerateTitle = useCallback((checkStreaming = false) => {
    if (!firstUserMessageRef.current || !agent.state.currentConversationId) {
      return false;
    }

    const { conversationId } = firstUserMessageRef.current;
    
    // 验证是否为当前对话
    if (conversationId !== agent.state.currentConversationId) {
      return false;
    }

    const userMessages = agent.state.messages.filter(m => m.role === "user");
    const assistantMessages = agent.state.messages.filter(m => m.role === "assistant");
    const hasPendingAction = assistantMessages.some(m => m.pendingAction);
    
    // 必须是第一次对话：一条用户消息，一条助手消息
    if (userMessages.length !== 1 || assistantMessages.length !== 1) {
      return false;
    }
    
    // 不能有待确认的操作
    if (hasPendingAction) {
      return false;
    }
    
    // 如果需要检查流式状态（fallback 机制）
    if (checkStreaming) {
      const lastAssistantMessage = assistantMessages[0];
      return !lastAssistantMessage.isStreaming;
    }
    
    return true;
  }, [agent.state.currentConversationId, agent.state.messages]);

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

  // 尝试生成标题
  const tryGenerateTitle = useCallback((source: string) => {
    if (!firstUserMessageRef.current) {
      return;
    }

    const { conversationId, message } = firstUserMessageRef.current;
    
    const userMessages = agent.state.messages.filter(m => m.role === "user");
    const assistantMessages = agent.state.messages.filter(m => m.role === "assistant");
    const hasPendingAction = assistantMessages.some(m => m.pendingAction);
    
    console.log(`[AgentPanel] ${source} 检查标题生成条件:`, {
      conversationId,
      userMessagesCount: userMessages.length,
      assistantMessagesCount: assistantMessages.length,
      hasPendingAction,
    });

    if (shouldGenerateTitle()) {
      console.log(`[AgentPanel] ${source} 触发标题生成`);
      updateConversationTitleFromMessage(conversationId, message);
      firstUserMessageRef.current = null;
    } else if (hasPendingAction) {
      console.log(`[AgentPanel] ${source} 跳过：有待确认操作`);
    } else if (userMessages.length > 1 || assistantMessages.length > 1) {
      console.log(`[AgentPanel] ${source} 跳过：不是第一条消息`);
      firstUserMessageRef.current = null;
    }
  }, [agent.state.messages, shouldGenerateTitle, updateConversationTitleFromMessage]);

  // 使用 Agent Stream Hook
  const { sendMessage, abort, resumeConversation } = useAgentStream({
    onIterationUpdate: (iterations: IterationStep[]) => {
      // 检查是否有分镜相关操作完成并触发刷新
      const lastIteration = iterations[iterations.length - 1];
      if (lastIteration?.functionCall?.status === "completed" && 
          isShotRelatedFunction(lastIteration.functionCall.name)) {
        setTimeout(() => window.dispatchEvent(new CustomEvent("shots-changed")), 200);
      }
    },
    onComplete: () => {
      setIsProcessing(false);
      
      // 尝试生成标题（主要路径）
      tryGenerateTitle("onComplete");
      
      // 延迟刷新对话列表
      setTimeout(() => agent.refreshConversations(true), 100);
    },
    onError: (error) => {
      setIsProcessing(false);
      console.error("Agent Stream 错误:", error);
      
      // 发生错误时清除引用
      clearFirstUserMessageRef("发生错误");
      
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

  // 条件自动滚动到底部：只在用户位于底部时滚动
  useEffect(() => {
    if (scrollRef.current && isUserNearBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent.state.messages, isProcessing, isUserNearBottom]);

  // 监听对话切换，清除保存的第一条消息引用
  useEffect(() => {
    // 切换到不同的对话时清除引用
    if (agent.state.currentConversationId && firstUserMessageRef.current && 
        firstUserMessageRef.current.conversationId !== agent.state.currentConversationId) {
      clearFirstUserMessageRef("切换对话");
    }
    
    // 进入新对话模式时清除引用
    if (agent.state.isNewConversation) {
      clearFirstUserMessageRef("进入新对话模式");
    }
  }, [agent.state.currentConversationId, agent.state.isNewConversation, clearFirstUserMessageRef]);

  // 监听消息变化，检查是否需要生成标题（Fallback机制）
  // 主要路径在 onComplete 回调中，这里作为备用
  useEffect(() => {
    if (!firstUserMessageRef.current || !agent.state.currentConversationId) {
      return;
    }

    // 只处理当前对话
    if (firstUserMessageRef.current.conversationId !== agent.state.currentConversationId) {
      return;
    }

    const userMessages = agent.state.messages.filter(m => m.role === "user");
    const assistantMessages = agent.state.messages.filter(m => m.role === "assistant");
    const hasPendingAction = assistantMessages.some(m => m.pendingAction);
    
    console.log("[AgentPanel] Fallback: 检查标题生成条件:", {
      conversationId: firstUserMessageRef.current.conversationId,
      userMessagesCount: userMessages.length,
      assistantMessagesCount: assistantMessages.length,
      hasPendingAction,
    });
    
    // 检查条件并决定是否生成标题
    if (userMessages.length === 1 && assistantMessages.length === 1 && !hasPendingAction) {
      // 检查流式状态
      if (shouldGenerateTitle(true)) {
        const { conversationId, message } = firstUserMessageRef.current;
        console.log("[AgentPanel] Fallback: 触发标题生成");
        updateConversationTitleFromMessage(conversationId, message);
        firstUserMessageRef.current = null;
      } else {
        console.log("[AgentPanel] Fallback: 消息仍在流式传输中");
      }
    } else if (hasPendingAction) {
      console.log("[AgentPanel] Fallback: 有待确认操作，跳过");
    } else if (userMessages.length > 1) {
      clearFirstUserMessageRef("Fallback: 已有多条消息");
    }
  }, [agent.state.messages, agent.state.currentConversationId, shouldGenerateTitle, updateConversationTitleFromMessage, clearFirstUserMessageRef]);

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    setIsProcessing(true);

    try {
      // 检查是否有pendingAction，如果有则将新消息作为拒绝理由
      const lastAssistantMessage = agent.state.messages
        .filter(m => m.role === "assistant")
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      
      if (lastAssistantMessage?.pendingAction && agent.state.currentConversationId) {
        // 同步调用 resumeConversation，将新消息作为拒绝理由
        // 这会让 AI 看到用户的新消息并继续对话
        await resumeConversation(
          agent.state.currentConversationId, 
          false, 
          `用户拒绝了操作并回复：${userMessage}`
        );
        // 完成后直接返回，不继续创建新对话
        return;
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
    clearFirstUserMessageRef("用户中断");
    toast.info("已停止 AI 生成");
  }, [abort, clearFirstUserMessageRef]);

  // 处理建议选择
  const handleSelectSuggestion = useCallback((text: string) => {
    setInput(text);
    // 可选：自动聚焦到输入框
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      textarea?.focus();
    }, 100);
  }, []);

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
        <div className="flex-1 overflow-hidden relative">
          <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden" onScroll={handleScroll}>
            <div className="py-2">
              {agent.state.isNewConversation || (agent.state.messages.length === 0 && !isProcessing) ? (
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    {agent.state.isNewConversation ? t('editor.agent.panel.startNewConversation') : t('editor.agent.panel.startConversation')}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md mb-8">
                    {t('editor.agent.panel.welcomeMessage')}
                  </p>
                  
                  {/* 建议卡片 */}
                  <SuggestionCards onSelectSuggestion={handleSelectSuggestion} />
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

          {/* 回到底部按钮 */}
          {!isUserNearBottom && (
            <div className="absolute bottom-4 right-4 z-10">
              <Button
                size="icon"
                onClick={() => scrollToBottom(true)}
                className="h-10 w-10 rounded-full shadow-lg transition-all hover:scale-110"
                title={t('editor.agent.panel.scrollToBottom')}
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            </div>
          )}
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
