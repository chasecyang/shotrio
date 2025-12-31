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
import { Send, Bot, Square, ArrowDown, ChevronDown, MessageSquarePlus, Trash2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { getCreditBalance } from "@/lib/actions/credits/balance";
import { createConversation, updateConversationTitle } from "@/lib/actions/conversation/crud";
import { generateConversationTitle } from "@/lib/actions/conversation/title-generator";
import { isAwaitingApproval } from "@/lib/services/agent-engine/approval-utils";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AgentPanelProps {
  projectId: string;
}

// 判断是否为视频相关操作
function isVideoRelatedFunction(functionName: string): boolean {
  const videoRelatedFunctions = [
    'generate_video_asset',
    'generate_image_asset',
    'update_asset',
    'delete_asset',
  ];
  return videoRelatedFunctions.includes(functionName);
}

// 判断是否为项目/剧集相关操作（需要刷新项目数据）
function isProjectRelatedFunction(functionName: string): boolean {
  const projectRelatedFunctions = [
    'update_episode',
    'set_art_style',
  ];
  return projectRelatedFunctions.includes(functionName);
}

export function AgentPanel({ projectId }: AgentPanelProps) {
  const agent = useAgent();
  const t = useTranslations();
  
  const [input, setInput] = useState("");
  const [creditBalance, setCreditBalance] = useState<number | undefined>(undefined);
  const [isUserNearBottom, setIsUserNearBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 跟踪每个对话是否已经生成过标题，避免重复生成
  const titleGeneratedRef = useRef<Set<string>>(new Set());
  // 对话删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

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

  // 使用 Agent Stream Hook
  const { sendMessage, abort, resumeConversation } = useAgentStream({
    onComplete: () => {
      // 设置 loading 状态为 false（由 context 统一管理）
      agent.setLoading(false);
      
      // 延迟刷新对话列表
      setTimeout(() => agent.refreshConversations(true), 100);
      
      // 触发事件刷新（检查所有包含 toolCalls 的消息，而不只是最后一条）
      let hasAssetRelatedTool = false;
      let hasProjectRelatedTool = false;
      
      for (const message of agent.state.messages) {
        if (message.toolCalls && message.toolCalls.length > 0) {
          const toolName = message.toolCalls[0]?.function.name;
          if (toolName && isVideoRelatedFunction(toolName)) {
            hasAssetRelatedTool = true;
          }
          if (toolName && isProjectRelatedFunction(toolName)) {
            hasProjectRelatedTool = true;
          }
        }
      }
      
      if (hasAssetRelatedTool) {
        // 视频/资产操作触发统一的资产变更事件
        setTimeout(() => window.dispatchEvent(new CustomEvent("asset-created")), 200);
      }
      if (hasProjectRelatedTool) {
        setTimeout(() => window.dispatchEvent(new CustomEvent("project-changed")), 200);
      }
    },
    onError: (error) => {
      // 设置 loading 状态为 false（由 context 统一管理）
      agent.setLoading(false);
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

  // 条件自动滚动到底部：只在用户位于底部时滚动
  useEffect(() => {
    if (scrollRef.current && isUserNearBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent.state.messages, agent.state.isLoading, isUserNearBottom]);

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim() || agent.state.isLoading) return;

    const userMessage = input.trim();
    setInput("");
    agent.setLoading(true);

    try {
      // 检查是否有待批准操作，如果有则先拒绝（从消息历史推导）
      const messages = agent.state.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.toolCalls,
        tool_call_id: msg.toolCallId,
      }));
      
      if (isAwaitingApproval(messages as any[]) && agent.state.currentConversationId) {
        console.log("[AgentPanel] 检测到待批准操作，先拒绝");
        // 步骤1：纯粹拒绝
        await resumeConversation(agent.state.currentConversationId, false);
        // 不 return，继续执行发送消息逻辑
      }

      let conversationId = agent.state.currentConversationId;

      // 如果是新对话模式，先创建对话
      if (agent.state.isNewConversation || !conversationId) {
        const result = await createConversation({ 
          projectId,
          title: t('editor.agent.panel.newConversation'), // 临时标题，立即会被生成的标题替换
          context: agent.currentContext // 保存当前上下文（选中的剧集、资源等）
        });
        
        if (!result.success || !result.conversationId) {
          toast.error(result.error || "创建对话失败");
          agent.setLoading(false);
          return;
        }
        
        conversationId = result.conversationId;
        
        // 批量更新状态（React 18 会自动批处理）
        agent.dispatch({ type: "SET_CURRENT_CONVERSATION", payload: conversationId });
        agent.dispatch({ type: "SET_NEW_CONVERSATION", payload: false });
        
        // 🆕 立即生成标题（异步执行，不阻塞消息发送）
        updateConversationTitleFromMessage(conversationId, userMessage);
        
        // 异步刷新对话列表（不阻塞消息发送，静默刷新）
        agent.refreshConversations(true);
      }

      // 添加用户消息到本地状态
      agent.addMessage({
        role: "user",
        content: userMessage,
      });

      // 使用 hook 发送消息
      await sendMessage(userMessage, agent.currentContext, conversationId);
    } catch (error) {
      agent.setLoading(false);
      console.error("发送消息失败:", error);
      toast.error("发送失败");
    }
  }, [input, agent, projectId, sendMessage, resumeConversation, t, updateConversationTitleFromMessage]);

  // 停止 AI 生成
  const handleStop = useCallback(() => {
    abort();
    toast.info("已停止 AI 生成");
  }, [abort]);

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

  // 处理对话删除
  const handleDeleteClick = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (conversationToDelete) {
      await agent.deleteConversationById(conversationToDelete);
      setConversationToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  // 创建新对话
  const handleCreateNewConversation = async () => {
    await agent.createNewConversation();
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(date).toLocaleDateString();
  };

  // 获取状态配置
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "awaiting_approval":
        return { Icon: AlertCircle, className: "text-amber-600 dark:text-amber-400" };
      case "active":
        return { Icon: Clock, className: "text-blue-500" };
      case "completed":
        return { Icon: CheckCircle, className: "text-muted-foreground" };
      default:
        return { Icon: MessageSquarePlus, className: "text-muted-foreground" };
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
        {/* Header with Conversation Dropdown */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-0 hover:bg-transparent flex-1 justify-start min-w-0">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">
                      {agent.state.isNewConversation 
                        ? t('editor.agent.panel.newConversation')
                        : agent.state.conversations.find(c => c.id === agent.state.currentConversationId)?.title || t('editor.agent.panel.aiAssistant')}
                    </h3>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[320px]">
                {/* New Conversation Button */}
                <DropdownMenuItem 
                  onClick={handleCreateNewConversation}
                  className="font-medium"
                >
                  <MessageSquarePlus className="h-4 w-4 mr-2" />
                  新建对话
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                
                {/* Conversation List */}
                <div className="max-h-[400px] overflow-y-auto">
                  {agent.state.conversations.length === 0 ? (
                    <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                      暂无对话历史
                    </div>
                  ) : (
                    agent.state.conversations.map((conv) => {
                      const { Icon, className } = getStatusIcon(conv.status);
                      const isActive = conv.id === agent.state.currentConversationId;
                      
                      return (
                        <DropdownMenuItem
                          key={conv.id}
                          onClick={() => agent.loadConversation(conv.id)}
                          className={cn(
                            "flex items-start gap-2 py-2 px-2 cursor-pointer",
                            isActive && "bg-accent"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", className)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{conv.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(conv.lastActivityAt)}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => handleDeleteClick(conv.id, e)}
                            className="h-6 w-6 shrink-0 opacity-0 hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages - with proper overflow handling */}
        <div className="flex-1 overflow-hidden relative">
          <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden" onScroll={handleScroll}>
            <div className="py-2">
              {agent.state.isNewConversation || (agent.state.messages.length === 0 && !agent.state.isLoading) ? (
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
                  {agent.state.messages
                    .filter(msg => msg.role !== "tool") // 过滤掉 tool 消息（工具执行结果通过 DisplayStepCard 显示）
                    .map((message) => (
                      <ChatMessage 
                        key={message.id} 
                        message={message} 
                        currentBalance={creditBalance}
                      />
                    ))}
                  {agent.state.isLoading && <TypingIndicator />}
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
              disabled={agent.state.isLoading}
            />
            <Button
              onClick={agent.state.isLoading ? handleStop : handleSend}
              disabled={!agent.state.isLoading && !input.trim()}
              size="icon"
              variant={agent.state.isLoading ? "destructive" : "default"}
              className="h-[60px] w-[60px] shrink-0"
              title={agent.state.isLoading ? t('editor.agent.chatInput.stopGeneration') : t('editor.agent.chatInput.sendMessage')}
            >
              {agent.state.isLoading ? (
                <Square className="h-5 w-5" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {agent.state.isLoading ? t('editor.agent.chatInput.stopToInterrupt') : t('editor.agent.chatInput.enterToSend')}
          </p>
        </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个对话吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
