"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import { createCheckoutSession } from "@/lib/actions/payment/checkout";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { CreditPackage, PackageType } from "@/types/payment";
import { CREDIT_PACKAGES, CREDIT_COSTS } from "@/types/payment";

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightPackage?: PackageType;
}

export function PurchaseDialog({
  open,
  onOpenChange,
  highlightPackage,
}: PurchaseDialogProps) {
  const t = useTranslations("credits");
  const [loadingPackage, setLoadingPackage] = useState<PackageType | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 弹窗打开时滚动到标准包（popular）位置
  useEffect(() => {
    if (open && scrollRef.current) {
      const popularIndex = CREDIT_PACKAGES.findIndex((pkg) => pkg.popular);
      if (popularIndex > 0) {
        const cardWidth = 180 + 16; // 卡片宽度 + gap
        const scrollPosition = popularIndex * cardWidth - scrollRef.current.clientWidth / 2 + cardWidth / 2;
        setTimeout(() => {
          scrollRef.current?.scrollTo({ left: Math.max(0, scrollPosition), behavior: "instant" });
        }, 0);
      }
    }
  }, [open]);

  const handlePurchase = async (pkg: CreditPackage) => {
    setLoadingPackage(pkg.type);
    try {
      const result = await createCheckoutSession({
        packageType: pkg.type,
      });

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error(result.error || t("errors.checkoutFailed"));
        setLoadingPackage(null);
      }
    } catch (error) {
      toast.error(t("errors.checkoutFailed"));
      console.error("Checkout session creation failed:", error);
      setLoadingPackage(null);
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Wallet className="h-6 w-6" />
            {t("purchase")}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium bg-gradient-to-r from-yellow-600 to-purple-600 bg-clip-text text-transparent">
              {t("packages.bonusHint")}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 mt-4 relative group">
          {/* Left navigation button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory px-2 pb-2 scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {CREDIT_PACKAGES.map((pkg) => {
              const bonusCredits = Math.floor(pkg.credits * (pkg.bonusPercent / 100));
              const totalCredits = pkg.credits + bonusCredits;
              const isHighlighted = highlightPackage === pkg.type;
              const isLoading = loadingPackage === pkg.type;

              return (
                <div
                  key={pkg.type}
                  className="flex-shrink-0 snap-start w-[180px]"
                >
                  <Card className={`relative overflow-hidden transition-all h-full flex flex-col ${
                    isHighlighted
                      ? "ring-2 ring-primary shadow-lg"
                      : pkg.popular
                      ? "border-primary shadow-md"
                      : "hover:border-primary/50"
                  }`}>
                    {pkg.popular && (
                      <div className="absolute top-2 right-2 z-10">
                        <Badge className="gap-1 bg-primary text-xs px-2 py-0.5">
                          <Zap className="h-3 w-3" />
                          {t("packages.popular")}
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{pkg.name}</CardTitle>
                      <CardDescription className="text-xs line-clamp-2">{pkg.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 flex-1 flex flex-col">
                      <div className="space-y-1.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold font-heading">${pkg.price}</span>
                          <span className="text-xs text-muted-foreground">{t("currency")}</span>
                        </div>

                        <div className="space-y-0.5">
                          <div className="text-xl font-bold text-primary">
                            {totalCredits.toLocaleString()} {t("creditsUnit")}
                          </div>
                          {bonusCredits > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {t("bonusLabel", { percent: pkg.bonusPercent })}
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground flex-1">
                        {t("packages.value", {
                          images: Math.floor(totalCredits / CREDIT_COSTS.IMAGE_GENERATION),
                          seconds: Math.floor(totalCredits / CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND),
                        })}
                      </p>

                      <Button
                        onClick={() => handlePurchase(pkg)}
                        disabled={isLoading || loadingPackage !== null}
                        className="w-full"
                        size="sm"
                        variant={pkg.popular || isHighlighted ? "default" : "outline"}
                      >
                        {isLoading ? t("packages.processing") : t("packages.buyNow")}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Right navigation button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
