"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CreditAccount } from "@/types/payment";

interface BalanceCardProps {
  balance: CreditAccount;
}

export function BalanceCard({ balance }: BalanceCardProps) {
  const t = useTranslations("credits.balance");
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden">
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t("title")}
          </CardTitle>
        </CardHeader>

        <CardContent className="relative space-y-6">
          {/* Current balance */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("current")}</p>
            <p className="text-5xl font-bold tracking-tight">
              {balance.balance.toLocaleString()}
            </p>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-green-500" />
                {t("totalEarned")}
              </div>
              <p className="text-xl font-semibold">
                {balance.totalEarned.toLocaleString()}
              </p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                {t("totalSpent")}
              </div>
              <p className="text-xl font-semibold">
                {balance.totalSpent.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

