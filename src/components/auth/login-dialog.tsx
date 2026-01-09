"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/auth-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BetaBadge } from "@/components/ui/beta-badge";
import { AlertCircle } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useLoginDialog } from "./login-dialog-context";

export function LoginDialog() {
  const { isOpen, closeLoginDialog, redirectTo } = useLoginDialog();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = useTranslations("auth");

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectTo,
      });
    } catch (err) {
      setError(t("loginError"));
      console.error("Login error:", err);
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeLoginDialog();
      setError("");
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-neutral-200 p-0 overflow-hidden">
        <div className="p-6 pb-0">
          <DialogHeader className="space-y-2">
            <div className="mx-auto mb-2 flex items-center justify-center gap-2">
              <span className="text-3xl font-bold font-heading">
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Shot</span>
                <span className="text-primary/40">Rio</span>
              </span>
              <BetaBadge variant="default" className="translate-y-[-4px]" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center">{t("title")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("subtitle")}
            </DialogDescription>
            <p className="text-center text-sm text-neutral-600">
              {t("description")}
            </p>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
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
                {t("loggingIn")}
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.6 10.2273C19.6 9.51819 19.5364 8.83637 19.4182 8.18182H10V12.05H15.3818C15.15 13.3 14.4455 14.3591 13.3864 15.0682V17.5773H16.6182C18.5091 15.8364 19.6 13.2727 19.6 10.2273Z" fill="#4285F4"/>
                  <path d="M10 20C12.7 20 14.9636 19.1045 16.6182 17.5773L13.3864 15.0682C12.4909 15.6682 11.3455 16.0227 10 16.0227C7.39545 16.0227 5.19091 14.2636 4.40455 11.9H1.06364V14.4909C2.70909 17.7591 6.09091 20 10 20Z" fill="#34A853"/>
                  <path d="M4.40455 11.9C4.20455 11.3 4.09091 10.6591 4.09091 10C4.09091 9.34092 4.20455 8.70001 4.40455 8.10001V5.50909H1.06364C0.386364 6.85909 0 8.38637 0 10C0 11.6136 0.386364 13.1409 1.06364 14.4909L4.40455 11.9Z" fill="#FBBC04"/>
                  <path d="M10 3.97727C11.4682 3.97727 12.7864 4.48182 13.8227 5.47273L16.6909 2.60455C14.9591 0.990909 12.6955 0 10 0C6.09091 0 2.70909 2.24091 1.06364 5.50909L4.40455 8.1C5.19091 5.73636 7.39545 3.97727 10 3.97727Z" fill="#EA4335"/>
                </svg>
                {t("googleLogin")}
              </span>
            )}
          </Button>
        </div>

        <div className="px-6 pb-6 text-xs text-center text-neutral-500">
          {t("agreeToTerms")}{" "}
          <Link href="/terms" className="text-orange-600 hover:underline" target="_blank">
            {t("termsOfService")}
          </Link>
          {" "}{t("and")}{" "}
          <Link href="/privacy" className="text-orange-600 hover:underline" target="_blank">
            {t("privacyPolicy")}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
