"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, X, Coins, Plus } from "lucide-react";
import type { PendingAction } from "@/types/agent";
import { formatParametersForConfirmation } from "@/lib/utils/agent-params-formatter";
import { generateActionDescription } from "@/lib/utils/action-description-generator";
import { PurchaseDialog } from "@/components/credits/purchase-dialog";

interface PendingActionMessageProps {
  action: PendingAction;
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
  const hasMultipleCalls = action.functionCalls.length > 1;
  const totalCost = action.creditCost?.total || 0;
  const insufficientBalance = currentBalance !== undefined && totalCost > currentBalance;
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);

  // Determine status display
  const isPending = action.status === "pending";
  const isAccepted = action.status === "accepted";
  const isRejected = action.status === "rejected";

  // Status-based styling
  const borderColor = isAccepted 
    ? "border-green-500/30" 
    : isRejected 
    ? "border-gray-500/30" 
    : "border-primary/20";
  
  const bgColor = isAccepted
    ? "bg-green-500/10"
    : isRejected
    ? "bg-gray-500/10"
    : "bg-accent/30";

  const iconBg = isAccepted
    ? "bg-green-500/20"
    : isRejected
    ? "bg-gray-500/20"
    : "bg-primary/10";

  const iconColor = isAccepted
    ? "text-green-600 dark:text-green-400"
    : isRejected
    ? "text-gray-600 dark:text-gray-400"
    : "text-primary";

  return (
    <div className={`rounded-lg backdrop-blur-sm border overflow-hidden ${bgColor} ${borderColor}`}>
      <div className="p-3 space-y-3">
        {/* Header with Icon and Title */}
        <div className="flex items-start gap-2.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 mt-0.5 ${iconBg}`}>
            {isAccepted ? (
              <Check className={`h-4 w-4 ${iconColor}`} />
            ) : isRejected ? (
              <X className={`h-4 w-4 ${iconColor}`} />
            ) : (
              <AlertCircle className={`h-4 w-4 ${iconColor}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {isAccepted 
                ? t('agent.action.executing') 
                : isRejected 
                ? t('agent.action.reject') 
                : t('agent.action.pending')}
            </p>
            {action.message && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {action.message}
              </p>
            )}
          </div>
        </div>

        {/* Function Calls */}
        <div className="space-y-2 pl-9">
          {action.functionCalls.map((call, index) => {
            const description = generateActionDescription(call);
            const formattedParams = formatParametersForConfirmation(call.parameters);
            const keyParams = formattedParams.slice(0, 3); // 只显示前3个关键参数

            return (
              <div
                key={call.id}
                className="rounded-md bg-background/50 border border-border/50 p-2.5"
              >
                {/* Operation Description */}
                <div className="flex items-center gap-2 mb-1.5">
                  {hasMultipleCalls && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary shrink-0">
                      {index + 1}
                    </span>
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {description}
                  </span>
                </div>

                {/* Key Parameters */}
                {keyParams.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {keyParams.map((param) => (
                      <div key={param.key} className="flex items-center gap-1">
                        <span className="font-medium">{param.label}:</span>
                        <span>{param.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reason (if provided) */}
                {call.reason && (
                  <p className="text-xs text-muted-foreground mt-1.5 italic">
                    {call.reason}
                  </p>
                )}
              </div>
            );
          })}
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
            {isPending ? (
              <>
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
              </>
            ) : (
              <span className="text-xs text-muted-foreground px-2 py-1">
                {isAccepted ? t('editor.agent.pendingAction.executing') : t('common.cancel')}
              </span>
            )}
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
