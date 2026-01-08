"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { createProject } from "@/lib/actions/project";
import { createConversation } from "@/lib/actions/conversation/crud";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useLoginDialog } from "@/components/auth/login-dialog-context";

interface HeroQuickStartProps {
  isAuthenticated?: boolean;
}

export function HeroQuickStart({ isAuthenticated = false }: HeroQuickStartProps) {
  const router = useRouter();
  const t = useTranslations("home");
  const { openLoginDialog } = useLoginDialog();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 组件挂载时恢复保存的输入
  useEffect(() => {
    const savedMessage = sessionStorage.getItem("pendingQuickStartMessage");
    if (savedMessage) {
      setInput(savedMessage);
      sessionStorage.removeItem("pendingQuickStartMessage");
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();

    // 未登录时保存输入并打开登录对话框
    if (!isAuthenticated) {
      sessionStorage.setItem("pendingQuickStartMessage", userMessage);
      openLoginDialog("/");
      return;
    }

    setIsLoading(true);

    try {
      // 1. 创建项目
      const projectResult = await createProject({
        title: "未命名项目",
        description: "未命名描述",
      });

      if (!projectResult.success || !projectResult.data) {
        toast.error(projectResult.error || "创建项目失败");
        return;
      }

      const projectId = projectResult.data.id;

      // 2. 创建对话
      const convResult = await createConversation({
        projectId,
        title: userMessage.slice(0, 50),
        context: { projectId, recentJobs: [] },
      });

      if (!convResult.success || !convResult.conversationId) {
        toast.error(convResult.error || "创建对话失败");
        return;
      }

      const conversationId = convResult.conversationId;

      // 3. 存储 pending 信息到 sessionStorage
      sessionStorage.setItem(
        "pendingAgentMessage",
        JSON.stringify({
          conversationId,
          message: userMessage,
        })
      );

      // 4. 跳转到编辑器
      router.push(`/projects/${projectId}/editor`);
    } catch (error) {
      console.error("Quick start failed:", error);
      toast.error("启动失败，请重试");
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, router, isAuthenticated, openLoginDialog]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="relative flex items-center">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("hero.inputPlaceholder") || "告诉我你想创作什么..."}
          disabled={isLoading}
          className="h-14 pl-5 pr-14 text-base rounded-full border-primary/20 bg-background/80 backdrop-blur-sm shadow-lg focus-visible:ring-primary/30"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="absolute right-2 h-10 w-10 rounded-full"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground/60 text-center">
        {t("hero.inputHint") || "按 Enter 开始创作"}
      </p>
    </div>
  );
}
