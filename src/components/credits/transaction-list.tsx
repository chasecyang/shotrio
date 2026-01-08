"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, Gift, RefreshCw, Ticket } from "lucide-react";
import { format } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import type { CreditTransaction } from "@/types/payment";
import { TransactionType } from "@/lib/db/schemas/payment";
import { useTranslations, useLocale } from "next-intl";

interface TransactionListProps {
  transactions: CreditTransaction[];
}

const transactionConfig = {
  [TransactionType.PURCHASE]: {
    labelKey: "types.purchase",
    icon: ArrowUpCircle,
    color: "text-green-600",
    badgeVariant: "default" as const,
  },
  [TransactionType.SPEND]: {
    labelKey: "types.spend",
    icon: ArrowDownCircle,
    color: "text-orange-600",
    badgeVariant: "secondary" as const,
  },
  [TransactionType.REFUND]: {
    labelKey: "types.refund",
    icon: RefreshCw,
    color: "text-blue-600",
    badgeVariant: "outline" as const,
  },
  [TransactionType.BONUS]: {
    labelKey: "types.bonus",
    icon: Gift,
    color: "text-yellow-600",
    badgeVariant: "default" as const,
  },
  [TransactionType.REDEEM]: {
    labelKey: "types.redeem",
    icon: Ticket,
    color: "text-purple-600",
    badgeVariant: "default" as const,
  },
};

export function TransactionList({ transactions }: TransactionListProps) {
  const t = useTranslations("credits.transactions");
  const locale = useLocale();
  const dateLocale = locale === "zh" ? zhCN : enUS;

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>{t("empty")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">{t("balance")}</TableHead>
                <TableHead className="text-right">{t("time")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                const config = transactionConfig[transaction.type];
                const Icon = config.icon;

                return (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <Badge variant={config.badgeVariant} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {t(config.labelKey)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.description}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${config.color}`}>
                      {transaction.amount > 0 ? "+" : ""}
                      {transaction.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {transaction.balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(transaction.createdAt), "yyyy-MM-dd HH:mm", {
                        locale: dateLocale,
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

