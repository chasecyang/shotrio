"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Loader2 } from "lucide-react";
import {
  hasClaimedWelcomeBonus,
  claimWelcomeBonus,
} from "@/lib/actions/credits/transactions";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const SIGNUP_BONUS_CREDITS = 200;

export function WelcomeBonusDialog() {
  const t = useTranslations("credits.welcome");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    checkAndShowDialog();
  }, []);

  async function checkAndShowDialog() {
    // 检查是否已领取过注册奖励
    const result = await hasClaimedWelcomeBonus();
    if (result.success && !result.claimed) {
      setOpen(true);
    }
  }

  async function handleClaim() {
    setClaiming(true);
    try {
      const result = await claimWelcomeBonus();
      if (result.success) {
        setOpen(false);
        // 触发积分变化事件，更新 header 中的积分显示
        window.dispatchEvent(new CustomEvent("credits-changed"));
        router.refresh();
      }
    } finally {
      setClaiming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-md overflow-hidden">
        {/* 装饰性背景 */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />

        <DialogHeader className="relative text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-4 ring-primary/10">
            <Gift className="h-10 w-10 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-bold">{t("title")}</DialogTitle>
          <DialogDescription className="text-base">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            <span className="text-4xl font-bold text-primary">{SIGNUP_BONUS_CREDITS}</span>
            <span className="text-lg font-medium text-muted-foreground">
              {t("credits")}
            </span>
          </div>
        </div>

        <Button
          onClick={handleClaim}
          className="w-full"
          size="lg"
          disabled={claiming}
        >
          {claiming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("claiming")}
            </>
          ) : (
            <>
              <Gift className="mr-2 h-4 w-4" />
              {t("claim")}
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
