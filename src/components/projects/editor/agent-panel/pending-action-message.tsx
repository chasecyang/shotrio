"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertCircle, Coins, Plus, Check, X } from "lucide-react";
import type { PendingActionInfo } from "@/lib/services/agent-engine";
import { formatParametersForConfirmation } from "@/lib/utils/agent-params-formatter";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";

interface PendingActionMessageProps {
  action: PendingActionInfo;
  onConfirm: (actionId: string) => void;
  onCancel: (actionId: string) => void;
  currentBalance?: number;
}

export const PendingActionMessage = memo(function PendingActionMessage({
  action,
  onConfirm,
  onCancel,
  currentBalance,
}: PendingActionMessageProps) {
  const t = useTranslations();
  const totalCost = action.creditCost?.total || 0;
  const insufficientBalance = currentBalance !== undefined && totalCost > currentBalance;
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);

  // 在 Agent 架构中，PendingActionInfo 只在需要确认时存在
  // 不需要 status 字段，因为它的存在本身就表示 "pending" 状态
  const borderColor = "border-primary/20";
  const bgColor = "bg-accent/30";
  const iconBg = "bg-primary/10";
  const iconColor = "text-primary";

  return (
    <div className={`rounded-lg backdrop-blur-sm border overflow-hidden ${bgColor} ${borderColor}`}>
      <div className="p-3 space-y-3">
        {/* Header with Icon and Title */}
        <div className="flex items-start gap-2.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 mt-0.5 ${iconBg}`}>
            <AlertCircle className={`h-4 w-4 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t('agent.action.pending')}
            </p>
            {action.message && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {action.message}
              </p>
            )}
          </div>
        </div>

        {/* Function Call Details */}
        <div className="space-y-2 pl-9">
          <div className="rounded-md bg-background/50 border border-border/50 p-2.5">
            {/* Operation Description */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-medium text-foreground">
                {action.functionCall.displayName || action.functionCall.name}
              </span>
            </div>

            {/* Key Parameters */}
            {Object.keys(action.functionCall.arguments).length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {Object.entries(action.functionCall.arguments).slice(0, 3).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-1">
                    <span className="font-medium">{key}:</span>
                    <span>{String(value).slice(0, 50)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Credit Cost and Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
          {/* Credit Cost */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background text-xs">
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">{t('agent.credits.total')}</span>
            <span className="font-semibold text-foreground">{totalCost}</span>
            <span className="text-muted-foreground">{t('credits.creditsUnit')}</span>
            {insufficientBalance && (
              <span className="text-red-600 dark:text-red-400 ml-1">
                ({t('agent.credits.insufficient')}: {currentBalance}<button
                  onClick={() => setShowPurchaseDialog(true)}
                  className="inline-flex items-center justify-center w-4 h-4 ml-0.5 rounded-sm text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                  title={t('credits.addCredits')}
                  type="button"
                >
                  <Plus className="w-3 h-3" />
                </button>)
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => onCancel(action.id)}
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              {t('editor.agent.pendingAction.reject')}
            </Button>
            <Button
              onClick={() => onConfirm(action.id)}
              disabled={insufficientBalance}
              size="sm"
              className="h-7 px-3 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              {t('editor.agent.pendingAction.confirm')}
            </Button>
          </div>
        </div>
      </div>

      {/* Purchase Dialog */}
      <PurchaseDialog
        open={showPurchaseDialog}
        onOpenChange={setShowPurchaseDialog}
      />
    </div>
  );
});
