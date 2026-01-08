"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/auth/user-nav";
import { ArrowRight } from "lucide-react";
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLoginDialog } from "@/components/auth/login-dialog-context";

interface AuthButtonProps {
  initialUser?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string;
  } | null;
}

export function AuthButton({ initialUser }: AuthButtonProps) {
  const { openLoginDialog } = useLoginDialog();
  const { data: session } = authClient.useSession();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('nav');

  useEffect(() => {
    setMounted(true);
  }, []);

  // 使用客户端 session 或服务端传入的 initialUser
  const user = session?.user || initialUser;

  if (!mounted) {
    // 根据初始用户状态显示更准确的占位符
    if (initialUser) {
      // 已登录用户：显示头像占位符
      return (
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              {initialUser.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        </Button>
      );
    } else {
      // 未登录用户：显示按钮占位符
      return <div className="w-[100px] h-9" />;
    }
  }

  if (user) {
    return <UserNav user={user} />;
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Button
        onClick={() => openLoginDialog()}
        variant="ghost"
        size="sm"
        className="hidden sm:inline-flex"
      >
        {t('login')}
      </Button>
      <Button
        onClick={() => openLoginDialog()}
        size="sm"
      >
        {t('startCreating')}
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
