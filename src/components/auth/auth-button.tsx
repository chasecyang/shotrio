"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/auth/user-nav";
import { ArrowRight } from "lucide-react";
import { useTranslations } from 'next-intl';

export function AuthButton() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('nav');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-[100px] h-9" /> // Placeholder
    );
  }

  if (session?.user) {
    return <UserNav user={session.user} />;
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Button 
        onClick={() => router.push('/login')} 
        variant="ghost"
        size="sm"
        className="hidden sm:inline-flex"
      >
        {t('login')}
      </Button>
      <Button 
        onClick={() => router.push('/login')}
        size="sm"
      >
        {t('startCreating')}
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
