"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLoginDialog } from "@/components/auth/login-dialog-context";
import { useTranslations } from "next-intl";

interface HomeLoginButtonProps {
  variant?: "hero" | "cta";
}

export function HomeLoginButton({ variant = "hero" }: HomeLoginButtonProps) {
  const { openLoginDialog } = useLoginDialog();
  const t = useTranslations("home");

  if (variant === "cta") {
    return (
      <Button
        size="lg"
        className="h-16 px-12 text-lg rounded-full font-bold"
        onClick={() => openLoginDialog()}
      >
        {t("cta.button")}
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      className="h-14 px-8 text-lg rounded-full"
      onClick={() => openLoginDialog()}
    >
      {t("getStarted")}
      <ArrowRight className="ml-2 h-5 w-5" />
    </Button>
  );
}
