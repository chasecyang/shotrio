"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from 'next-intl';

/**
 * 注册页面现在重定向到登录页面
 * 因为使用 Google OAuth 时，登录和注册是同一个流程
 */
export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const t = useTranslations('common');

  useEffect(() => {
    // 保留 redirect 参数
    const loginUrl = redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login';
    router.replace(loginUrl);
  }, [router, redirectTo]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-neutral-600">{t('loading')}</p>
      </div>
    </div>
  );
}
