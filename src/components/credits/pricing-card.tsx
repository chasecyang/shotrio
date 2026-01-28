"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Sparkles, ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CreditPackage } from "@/types/payment";
import { CREDIT_COSTS } from "@/types/payment";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  pkg: CreditPackage;
  index?: number;
  isLoading?: boolean;
  isHighlighted?: boolean;
  onPurchase: (pkg: CreditPackage) => void;
  variant?: "page" | "dialog";
  disabled?: boolean;
}

export function PricingCard({
  pkg,
  index = 0,
  isLoading = false,
  isHighlighted = false,
  onPurchase,
  variant = "page",
  disabled = false,
}: PricingCardProps) {
  const t = useTranslations("credits");

  const bonusCredits = Math.floor(pkg.credits * (pkg.bonusPercent / 100));
  const totalCredits = pkg.credits + bonusCredits;
  const imagesCount = Math.floor(totalCredits / CREDIT_COSTS.IMAGE_GENERATION);
  const videoSeconds = Math.floor(totalCredits / CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND);

  const isCompact = variant === "dialog";
  const isPro = pkg.type === "pro" || pkg.type === "ultimate";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "group relative",
        isCompact ? "w-[200px] flex-shrink-0" : "w-full"
      )}
    >
      {/* Card container */}
      <div
        className={cn(
          "relative h-full flex flex-col overflow-hidden rounded-2xl border transition-all duration-300",
          "bg-gradient-to-b from-card to-card/80",
          pkg.popular
            ? "border-primary/50 shadow-lg shadow-primary/10"
            : isHighlighted
            ? "border-primary shadow-lg shadow-primary/20"
            : "border-border/50 hover:border-primary/30",
          isPro && "bg-gradient-to-br from-card via-card to-primary/5"
        )}
      >
        {/* Popular badge - floating style */}
        {pkg.popular && (
          <div className="absolute -top-px left-1/2 -translate-x-1/2 z-20">
            <div className="relative">
              <div className="absolute inset-0 bg-primary blur-md opacity-50" />
              <Badge className="relative gap-1.5 bg-primary text-primary-foreground px-4 py-1 rounded-b-lg rounded-t-none font-medium shadow-lg">
                <Zap className="h-3.5 w-3.5" />
                {t("packages.popular")}
              </Badge>
            </div>
          </div>
        )}

        {/* Bonus badge for packages with bonus */}
        {pkg.bonusPercent > 0 && !pkg.popular && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="secondary" className="gap-1 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              +{pkg.bonusPercent}%
            </Badge>
          </div>
        )}

        {/* Card content */}
        <div className={cn(
          "flex flex-col h-full",
          isCompact ? "p-4" : "p-6",
          pkg.popular && "pt-8"
        )}>
          {/* Package name */}
          <div className="mb-4">
            <h3 className={cn(
              "font-semibold tracking-tight",
              isCompact ? "text-base" : "text-lg"
            )}>
              {t(`packages.${pkg.type}`)}
            </h3>
            <p className={cn(
              "text-muted-foreground mt-1 line-clamp-2",
              isCompact ? "text-xs" : "text-sm"
            )}>
              {t(`packages.description.${pkg.type}`)}
            </p>
          </div>

          {/* Price section */}
          <div className="mb-4">
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "font-bold tracking-tight",
                isCompact ? "text-3xl" : "text-4xl"
              )}>
                ${pkg.price}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {t("currency")}
              </span>
            </div>
          </div>

          {/* Credits display */}
          <div className={cn(
            "rounded-xl p-3 mb-4",
            "bg-gradient-to-br from-primary/5 to-primary/10",
            "border border-primary/10"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center justify-center rounded-lg bg-primary/10",
                isCompact ? "w-8 h-8" : "w-10 h-10"
              )}>
                <Sparkles className={cn(
                  "text-primary",
                  isCompact ? "w-4 h-4" : "w-5 h-5"
                )} />
              </div>
              <div>
                <div className={cn(
                  "font-bold text-primary",
                  isCompact ? "text-xl" : "text-2xl"
                )}>
                  {totalCredits.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("creditsUnit")}
                  {bonusCredits > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                      (+{bonusCredits.toLocaleString()})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Value proposition */}
          <div className={cn(
            "space-y-2 mb-4 flex-1",
            isCompact ? "text-xs" : "text-sm"
          )}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>{t("packages.value", { images: imagesCount, seconds: videoSeconds })}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>{t("packages.agentChatFree")}</span>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            onClick={() => onPurchase(pkg)}
            disabled={isLoading || disabled}
            className={cn(
              "w-full font-medium transition-all duration-200",
              pkg.popular || isHighlighted
                ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                : "bg-secondary hover:bg-secondary/80"
            )}
            size={isCompact ? "sm" : "default"}
            variant={pkg.popular || isHighlighted ? "default" : "secondary"}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {t("packages.processing")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {t("packages.buyNow")}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
