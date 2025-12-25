"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BetaBannerProps {
  dismissible?: boolean;
  storageKey?: string;
  className?: string;
}

export function BetaBanner({ 
  dismissible = true, 
  storageKey = "beta-banner-dismissed",
  className 
}: BetaBannerProps) {
  const t = useTranslations("beta");
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // 检查 localStorage 是否已被关闭
    if (dismissible && typeof window !== "undefined") {
      const dismissed = localStorage.getItem(storageKey);
      setIsDismissed(dismissed === "true");
    } else {
      setIsDismissed(false);
    }
  }, [dismissible, storageKey]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, "true");
      setIsDismissed(true);
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div 
      className={cn(
        "bg-primary/5 border-b border-primary/10 animate-in slide-in-from-top duration-300",
        className
      )}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                <span className="font-semibold text-primary">{t("title")}: </span>
                <span className="text-muted-foreground">{t("description")}</span>
              </p>
            </div>
          </div>
          {dismissible && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 -mt-1"
              onClick={handleDismiss}
              aria-label="Dismiss beta notice"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

