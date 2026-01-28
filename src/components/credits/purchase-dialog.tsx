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
import { Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import { createCheckoutSession } from "@/lib/actions/payment/checkout";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { CreditPackage, PackageType } from "@/types/payment";
import { CREDIT_PACKAGES } from "@/types/payment";
import { PricingCard } from "./pricing-card";

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

  useEffect(() => {
    if (open && scrollRef.current) {
      const targetIndex = highlightPackage
        ? CREDIT_PACKAGES.findIndex((pkg) => pkg.type === highlightPackage)
        : CREDIT_PACKAGES.findIndex((pkg) => pkg.popular);

      if (targetIndex > 0) {
        const cardWidth = 200 + 16;
        const scrollPosition = targetIndex * cardWidth - scrollRef.current.clientWidth / 2 + cardWidth / 2;
        setTimeout(() => {
          scrollRef.current?.scrollTo({ left: Math.max(0, scrollPosition), behavior: "instant" });
        }, 0);
      }
    }
  }, [open, highlightPackage]);

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
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wallet className="h-5 w-5" />
            {t("purchase")}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              {t("packages.bonusHint")}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 mt-4 relative group">
          {/* Left navigation button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory px-2 pb-4 scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {CREDIT_PACKAGES.map((pkg, index) => (
              <div key={pkg.type} className="snap-start">
                <PricingCard
                  pkg={pkg}
                  index={index}
                  isLoading={loadingPackage === pkg.type}
                  isHighlighted={highlightPackage === pkg.type}
                  disabled={loadingPackage !== null && loadingPackage !== pkg.type}
                  onPurchase={handlePurchase}
                  variant="dialog"
                />
              </div>
            ))}
          </div>

          {/* Right navigation button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
