"use client";

import { useState, memo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Plus,
  RefreshCw
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
import { Skeleton } from "@/components/ui/skeleton";
import type { Conversation } from "./agent-context";

interface ConversationListProps {
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  conversations: Conversation[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  // Optional new conversation callback
  onCreateConversation?: () => void;
}

// Status icons and styles (labels will be translated)
const getStatusConfig = (t: (key: string) => string) => ({
  awaiting_approval: {
    icon: AlertCircle,
    label: t('editor.agent.chatStatus.awaitingApproval'),
    className: "text-amber-600 dark:text-amber-400",
    badgeClassName: "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium",
    animationClassName: "",
    cardClassName: "bg-amber-500/10",
  },
  active: {
    icon: Clock,
    label: t('editor.agent.chatStatus.active'),
    className: "text-blue-500",
    badgeClassName: "bg-blue-500/10 text-blue-500",
    animationClassName: "animate-pulse",
    cardClassName: "",
  },
  completed: {
    icon: CheckCircle,
    label: t('editor.agent.chatStatus.completed'),
    className: "text-muted-foreground",
    badgeClassName: "bg-muted/50 text-muted-foreground",
    animationClassName: "",
    cardClassName: "opacity-70",
  },
});

// Use React.memo optimization to avoid unnecessary re-renders
export const ConversationList = memo(function ConversationList({
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  conversations,
  isLoading = false,
  isRefreshing = false,
  onCreateConversation,
}: ConversationListProps) {
  const t = useTranslations();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const statusConfig = getStatusConfig(t);

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

  // Format time
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('editor.agent.chatList.justNow');
    if (minutes < 60) return t('editor.agent.chatList.minutesAgo', { minutes });
    if (hours < 24) return t('editor.agent.chatList.hoursAgo', { hours });
    if (days < 7) return t('editor.agent.chatList.daysAgo', { days });
    return new Date(date).toLocaleDateString();
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
            {t('editor.agent.chatList.newChat')}
          </Button>
        </div>
      )}

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* 刷新指示器 */}
          {isRefreshing && conversations.length > 0 && (
            <div className="flex items-center justify-center py-2 mb-1">
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* 初始加载：只在列表为空时显示骨架屏 */}
          {isLoading && conversations.length === 0 ? (
            <div className="space-y-1">
              {[...Array(3)].map((_, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-lg border p-3 bg-card border-border"
                >
                  {/* Status Icon Skeleton */}
                  <Skeleton className="h-4 w-4 shrink-0 mt-0.5 rounded-full" />
                  
                  {/* Content Skeleton */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Title Skeleton */}
                    <div className="flex items-start justify-between gap-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-6 w-6 shrink-0 rounded" />
                    </div>
                    
                    {/* Badge and Time Skeleton */}
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('editor.agent.chatList.empty')}
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
                    "group flex items-start gap-3 rounded-lg border p-3 cursor-pointer",
                    "transition-all duration-200 ease-in-out",
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
                        title={t('common.delete')}
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
            <AlertDialogTitle>{t('editor.agent.chatList.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('editor.agent.chatList.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
