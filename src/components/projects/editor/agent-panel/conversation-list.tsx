"use client";

import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Plus
} from "lucide-react";
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
import type { Conversation } from "./agent-context";

interface ConversationListProps {
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  conversations: Conversation[];
  isLoading?: boolean;
  // 可选的新建对话回调
  onCreateConversation?: () => void;
}

// 状态图标和样式
const statusConfig = {
  awaiting_approval: {
    icon: AlertCircle,
    label: "待批准",
    className: "text-orange-600 dark:text-orange-500",
    badgeClassName: "bg-orange-500/20 text-orange-600 dark:text-orange-500 font-semibold",
    animationClassName: "animate-bounce",
    cardClassName: "border-l-2 border-l-orange-500",
  },
  active: {
    icon: Clock,
    label: "活跃中",
    className: "text-blue-500",
    badgeClassName: "bg-blue-500/10 text-blue-500",
    animationClassName: "animate-pulse",
    cardClassName: "",
  },
  completed: {
    icon: CheckCircle,
    label: "已完成",
    className: "text-muted-foreground",
    badgeClassName: "bg-muted/50 text-muted-foreground",
    animationClassName: "",
    cardClassName: "opacity-70",
  },
};

// 使用 React.memo 优化，避免不必要的重渲染
export const ConversationList = memo(function ConversationList({
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  conversations,
  isLoading = false,
  onCreateConversation,
}: ConversationListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  const handleDeleteClick = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationToDelete(conversationId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (conversationToDelete) {
      onDeleteConversation(conversationToDelete);
      setConversationToDelete(null);
    }
    setDeleteDialogOpen(false);
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
    return new Date(date).toLocaleDateString("zh-CN");
  };

  return (
    <div className="flex h-full flex-col">
      {/* New Conversation Button */}
      {onCreateConversation && (
        <div className="p-3 shrink-0 border-b">
          <Button 
            onClick={onCreateConversation}
            className="w-full"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            新建对话
          </Button>
        </div>
      )}

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                暂无对话
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                点击 + 创建新对话
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const config = statusConfig[conv.status];
              const StatusIcon = config.icon;
              const isActive = conv.id === currentConversationId;

              return (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={cn(
                    "group flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                    "hover:bg-accent hover:border-accent-foreground/20",
                    isActive
                      ? "bg-accent border-accent-foreground/20 shadow-sm"
                      : "bg-card border-border",
                    config.cardClassName
                  )}
                >
                  {/* Status Icon */}
                  <div className={cn("shrink-0 mt-0.5", config.animationClassName)}>
                    <StatusIcon className={cn("h-4 w-4", config.className)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-none truncate">
                        {conv.title}
                      </p>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleDeleteClick(conv.id, e)}
                        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="删除对话"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          config.badgeClassName
                        )}
                      >
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(conv.lastActivityAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

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
});
