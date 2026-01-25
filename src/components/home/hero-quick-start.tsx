"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { createProject, getUserProjects } from "@/lib/actions/project";
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
  const tProjects = useTranslations("projects");
  const { openLoginDialog } = useLoginDialog();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  // Get examples from translations
  const examples = t.raw("hero.examples") as string[];

  // 打字机效果
  useEffect(() => {
    // 如果用户已经输入内容或聚焦，停止打字机效果
    if (input || isFocused) {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }
      return;
    }

    let currentExampleIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;

    const typeWriter = () => {
      const currentExample = examples[currentExampleIndex];

      if (!isDeleting) {
        // 打字阶段
        if (currentCharIndex < currentExample.length) {
          setPlaceholder(currentExample.substring(0, currentCharIndex + 1));
          currentCharIndex++;
          typewriterRef.current = setTimeout(typeWriter, 100);
        } else {
          // 打完后暂停
          typewriterRef.current = setTimeout(() => {
            isDeleting = true;
            typeWriter();
          }, 2000);
        }
      } else {
        // 删除阶段
        if (currentCharIndex > 0) {
          setPlaceholder(currentExample.substring(0, currentCharIndex - 1));
          currentCharIndex--;
          typewriterRef.current = setTimeout(typeWriter, 50);
        } else {
          // 删完后切换到下一个示例
          isDeleting = false;
          currentExampleIndex = (currentExampleIndex + 1) % examples.length;
          typewriterRef.current = setTimeout(typeWriter, 500);
        }
      }
    };

    typeWriter();

    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }
    };
  }, [input, isFocused]);

  // 组件挂载时恢复保存的输入
  useEffect(() => {
    const savedMessage = sessionStorage.getItem("pendingQuickStartMessage");
    if (savedMessage) {
      setInput(savedMessage);
      sessionStorage.removeItem("pendingQuickStartMessage");
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isLoading) return;

    const userMessage = input.trim();

    // 未登录时保存输入并打开登录对话框
    if (!isAuthenticated) {
      if (userMessage) {
        sessionStorage.setItem("pendingQuickStartMessage", userMessage);
      }
      openLoginDialog("/");
      return;
    }

    setIsLoading(true);

    try {
      // 有输入内容时：创建项目 + 对话 + 跳转
      if (userMessage) {
        // 1. 创建项目
        const projectResult = await createProject({
          title: tProjects("defaultProjectTitle"),
          description: tProjects("defaultProjectDescription"),
        });

        if (!projectResult.success || !projectResult.data) {
          toast.error(projectResult.error || t("hero.createProjectFailed"));
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
          toast.error(convResult.error || t("hero.createChatFailed"));
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
      } else {
        // 无输入内容时：检查是否有项目，有则进入最近项目，无则创建默认项目
        const projects = await getUserProjects();

        if (projects && projects.length > 0) {
          // 有项目：跳转到最近的项目（已按 updatedAt 降序排列）
          router.push(`/projects/${projects[0].id}/editor`);
        } else {
          // 无项目：创建默认项目
          const projectResult = await createProject({
            title: tProjects("defaultProjectTitle"),
            description: tProjects("defaultProjectDescription"),
          });

          if (!projectResult.success || !projectResult.data) {
            toast.error(projectResult.error || t("hero.createProjectFailed"));
            return;
          }

          router.push(`/projects/${projectResult.data.id}/editor`);
        }
      }
    } catch (error) {
      console.error("Quick start failed:", error);
      toast.error(t("hero.startFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, router, isAuthenticated, openLoginDialog, t, tProjects]);

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
    <div className="w-full max-w-3xl mx-auto">
      <div className="relative flex items-center">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isLoading}
          className="h-16 pl-6 pr-16 text-lg rounded-full border-border/60 bg-background/80 backdrop-blur-sm shadow-lg dark:border-border/80 dark:shadow-2xl focus-visible:ring-primary/30 dark:focus-visible:ring-primary/50"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={isLoading}
          className="absolute right-2 h-12 w-12 rounded-full"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted-foreground/60 text-center">
        {t("hero.inputHint")}
      </p>
    </div>
  );
}
