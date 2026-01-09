"use client";

import { useState } from "react";
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
import { Zap, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

  const handlePurchase = async (pkg: CreditPackage) => {
    setLoadingPackage(pkg.type);
    try {
      const result = await createCheckoutSession({
        packageType: pkg.type,
      });

      if (result.success && result.checkoutUrl) {
        // Redirect to payment page
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          <AnimatePresence>
            {CREDIT_PACKAGES.map((pkg, index) => {
              const bonusCredits = Math.floor(pkg.credits * (pkg.bonusPercent / 100));
              const totalCredits = pkg.credits + bonusCredits;
              const isHighlighted = highlightPackage === pkg.type;
              const isLoading = loadingPackage === pkg.type;

              return (
                <motion.div
                  key={pkg.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`relative overflow-hidden transition-all ${
                    isHighlighted
                      ? "ring-2 ring-primary shadow-lg"
                      : pkg.popular
                      ? "border-primary shadow-md"
                      : "hover:border-primary/50"
                  }`}>
                    {/* Popular badge */}
                    {pkg.popular && (
                      <div className="absolute top-3 right-3 z-10">
                        <Badge className="gap-1 bg-primary">
                          <Zap className="h-3 w-3" />
                          {t("packages.popular")}
                        </Badge>
                      </div>
                    )}

                    <CardHeader>
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      <CardDescription className="text-xs">{pkg.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Price and Credits - Simplified */}
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold font-heading">${pkg.price}</span>
                          <span className="text-sm text-muted-foreground">{t("currency")}</span>
                        </div>
                        
                        <div className="space-y-0.5">
                          <div className="text-2xl font-bold text-primary">
                            {totalCredits.toLocaleString()} {t("creditsUnit")}
                          </div>
                          {bonusCredits > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {t("bonusLabel", { percent: pkg.bonusPercent })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Purchase button */}
                      <Button
                        onClick={() => handlePurchase(pkg)}
                        disabled={isLoading || loadingPackage !== null}
                        className="w-full"
                        variant={pkg.popular || isHighlighted ? "default" : "outline"}
                      >
                        {isLoading ? t("packages.processing") : t("packages.buyNow")}
                      </Button>

                      {/* Value description */}
                      <p className="text-xs text-center text-muted-foreground">
                        {t("packages.value", {
                          images: Math.floor(totalCredits / CREDIT_COSTS.IMAGE_GENERATION),
                          seconds: Math.floor(totalCredits / CREDIT_COSTS.VIDEO_GENERATION_PER_SECOND),
                        })}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

