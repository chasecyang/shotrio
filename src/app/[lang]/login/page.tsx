"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/projects";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRedirectInfo, setShowRedirectInfo] = useState(false);
  const t = useTranslations('auth');

  useEffect(() => {
    // 如果有 redirect 参数，显示提示信息
    if (searchParams.get("redirect")) {
      setShowRedirectInfo(true);
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      // Google OAuth 会自动重定向，不需要手动处理后续逻辑
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectTo,
      });
    } catch (err) {
      setError(t('loginError'));
      console.error("Login error:", err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      {/* 渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-orange-100/50"></div>
      
      {/* 装饰性图案 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-orange-100/30 to-yellow-100/30 rounded-full blur-3xl"></div>
      </div>

      {/* 浮动元素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-[10%] w-2 h-2 bg-orange-400/40 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
        <div className="absolute top-32 right-[15%] w-3 h-3 bg-orange-300/40 rounded-full animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
        <div className="absolute bottom-32 left-[20%] w-2 h-2 bg-orange-500/40 rounded-full animate-bounce" style={{ animationDelay: '2s', animationDuration: '5s' }}></div>
        <div className="absolute bottom-20 right-[25%] w-3 h-3 bg-yellow-400/40 rounded-full animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '3.5s' }}></div>
      </div>

      <Card className="w-full max-w-md relative z-10 rounded-3xl border-neutral-200 shadow-xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-2 pb-6">
          <div className="mx-auto mb-2 flex justify-center">
            <span className="text-4xl font-bold">
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Shot</span>
              <span className="text-primary/40">Rio</span>
            </span>
          </div>
          <CardTitle className="text-3xl font-bold text-center text-neutral-900">{t('title')}</CardTitle>
          <CardDescription className="text-center text-base">
            {t('subtitle')}
          </CardDescription>
          <p className="text-center text-sm text-neutral-600">
            {t('description')}
          </p>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="space-y-4">
            {showRedirectInfo && !error && (
              <Alert className="border-orange-200 bg-orange-50">
                <Info className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  {t('loginRequired')}
                </AlertDescription>
              </Alert>
            )}
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Button 
              onClick={handleGoogleLogin}
              className="w-full h-12 bg-white hover:bg-neutral-50 text-neutral-700 border-2 border-neutral-200 rounded-2xl font-medium shadow-sm hover:shadow transition-all duration-200" 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('loggingIn')}
                </span>
              ) : (
                <span className="flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.6 10.2273C19.6 9.51819 19.5364 8.83637 19.4182 8.18182H10V12.05H15.3818C15.15 13.3 14.4455 14.3591 13.3864 15.0682V17.5773H16.6182C18.5091 15.8364 19.6 13.2727 19.6 10.2273Z" fill="#4285F4"/>
                    <path d="M10 20C12.7 20 14.9636 19.1045 16.6182 17.5773L13.3864 15.0682C12.4909 15.6682 11.3455 16.0227 10 16.0227C7.39545 16.0227 5.19091 14.2636 4.40455 11.9H1.06364V14.4909C2.70909 17.7591 6.09091 20 10 20Z" fill="#34A853"/>
                    <path d="M4.40455 11.9C4.20455 11.3 4.09091 10.6591 4.09091 10C4.09091 9.34092 4.20455 8.70001 4.40455 8.10001V5.50909H1.06364C0.386364 6.85909 0 8.38637 0 10C0 11.6136 0.386364 13.1409 1.06364 14.4909L4.40455 11.9Z" fill="#FBBC04"/>
                    <path d="M10 3.97727C11.4682 3.97727 12.7864 4.48182 13.8227 5.47273L16.6909 2.60455C14.9591 0.990909 12.6955 0 10 0C6.09091 0 2.70909 2.24091 1.06364 5.50909L4.40455 8.1C5.19091 5.73636 7.39545 3.97727 10 3.97727Z" fill="#EA4335"/>
                  </svg>
                  {t('googleLogin')}
                </span>
              )}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 pt-0 pb-6">
          <div className="text-xs text-center text-neutral-500">
            {t('agreeToTerms')}{" "}
            <Link href="/terms" className="text-orange-600 hover:underline" target="_blank">
              {t('termsOfService')}
            </Link>
            {" "}{t('and')}{" "}
            <Link href="/privacy" className="text-orange-600 hover:underline" target="_blank">
              {t('privacyPolicy')}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
