"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";
import { CREDIT_PACKAGES } from "@/types/payment";
import type { PackageType } from "@/types/payment";
import { useTranslations } from "next-intl";

export function PricingClientWrapper() {
  const t = useTranslations("credits");
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageType | undefined>();

  const handlePurchaseClick = (packageType: PackageType) => {
    setSelectedPackage(packageType);
    setPurchaseDialogOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {CREDIT_PACKAGES.map((pkg, index) => {
          const bonusCredits = Math.floor(pkg.credits * (pkg.bonusPercent / 100));
          const totalCredits = pkg.credits + bonusCredits;

          return (
            <motion.div
              key={pkg.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`relative overflow-hidden h-full flex flex-col transition-all duration-300 ${
                pkg.popular
                  ? "border-2 border-primary"
                  : "border hover:border-primary/50"
              }`}>
                {/* Popular badge */}
                {pkg.popular && (
                  <div className="absolute top-4 right-4 z-10">
                    <Badge className="gap-1 bg-primary">
                      <Zap className="h-3 w-3" />
                      {t("packages.popular")}
                    </Badge>
                  </div>
                )}

                <CardHeader className="flex-none">
                  <CardTitle className="text-xl">{pkg.name}</CardTitle>
                  <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between space-y-6">
                  {/* Price and Credits - Simplified */}
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold">${pkg.price}</span>
                      <span className="text-muted-foreground text-sm">{t("currency")}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-3xl font-bold text-primary">
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
                    onClick={() => handlePurchaseClick(pkg.type)}
                    className="w-full"
                    size="lg"
                    variant={pkg.popular ? "default" : "outline"}
                  >
                    {t("packages.buyNow")}
                  </Button>

                  {/* Value description */}
                  <p className="text-xs text-center text-muted-foreground">
                    {t("packages.value", {
                      images: Math.floor(totalCredits / 8),
                      seconds: Math.floor(totalCredits / 20),
                    })}
                  </p>

                  {/* Agent feature */}
                  <div className="flex items-center justify-center gap-2 pt-4 border-t">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {t("packages.agentChatFree")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        highlightPackage={selectedPackage}
      />
    </>
  );
}

