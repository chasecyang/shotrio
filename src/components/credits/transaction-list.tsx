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
import { zhCN } from "date-fns/locale";
import type { CreditTransaction } from "@/types/payment";
import { TransactionType } from "@/lib/db/schemas/payment";

interface TransactionListProps {
  transactions: CreditTransaction[];
}

const transactionConfig = {
  [TransactionType.PURCHASE]: {
    label: "充值",
    icon: ArrowUpCircle,
    color: "text-green-600",
    badgeVariant: "default" as const,
  },
  [TransactionType.SPEND]: {
    label: "消费",
    icon: ArrowDownCircle,
    color: "text-orange-600",
    badgeVariant: "secondary" as const,
  },
  [TransactionType.REFUND]: {
    label: "退款",
    icon: RefreshCw,
    color: "text-blue-600",
    badgeVariant: "outline" as const,
  },
  [TransactionType.BONUS]: {
    label: "奖励",
    icon: Gift,
    color: "text-yellow-600",
    badgeVariant: "default" as const,
  },
  [TransactionType.REDEEM]: {
    label: "兑换",
    icon: Ticket,
    color: "text-purple-600",
    badgeVariant: "default" as const,
  },
};

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>交易记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>暂无交易记录</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>交易记录</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类型</TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead className="text-right">余额</TableHead>
                <TableHead className="text-right">时间</TableHead>
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
                        {config.label}
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
                        locale: zhCN,
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

