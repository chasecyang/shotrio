"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CreditPackage } from "@/types/payment";

interface PackageCardProps {
  package: CreditPackage;
  onSelect: () => void;
  loading?: boolean;
}

export function PackageCard({
  package: pkg,
  onSelect,
  loading,
}: PackageCardProps) {
  const t = useTranslations("credits");
  const bonusCredits = Math.floor(pkg.credits * (pkg.bonusPercent / 100));
  const totalCredits = pkg.credits + bonusCredits;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`relative overflow-hidden transition-all ${
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

        <CardHeader>
          <CardTitle className="text-2xl">{pkg.name}</CardTitle>
          <CardDescription>{pkg.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
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
            onClick={onSelect}
            disabled={loading}
            className="w-full"
            size="lg"
            variant={pkg.popular ? "default" : "outline"}
          >
            {loading ? t("packages.processing") : t("packages.buyNow")}
          </Button>

          {/* Value description */}
          <p className="text-xs text-center text-muted-foreground">
            {t("packages.value", {
              images: Math.floor(totalCredits / 2),
              seconds: Math.floor(totalCredits / 3),
            })}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

