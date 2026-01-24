"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Coins, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetWithFullData } from "@/types/asset";
import Link from "next/link";

interface RegenerateConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetWithFullData | null;
  creditCost: number;
  costDetails: string;
  currentBalance: number;
  onConfirm: () => Promise<void>;
  isRegenerating: boolean;
}

export function RegenerateConfirmDialog({
  open,
  onOpenChange,
  asset,
  creditCost,
  costDetails,
  currentBalance,
  onConfirm,
  isRegenerating,
}: RegenerateConfirmDialogProps) {
  const t = useTranslations("editor.regenerateDialog");
  const tCommon = useTranslations("common");

  if (!asset) return null;

  const insufficientCredits = currentBalance < creditCost;

  const getAssetTypeName = (type: string) => {
    switch (type) {
      case "image":
        return "图片";
      case "video":
        return "视频";
      case "audio":
        return "音频";
      default:
        return "素材";
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            {/* 素材信息 */}
            <div className="text-sm text-foreground">
              <span className="font-medium">{asset.name}</span>
              <span className="text-muted-foreground ml-2">
                ({getAssetTypeName(asset.assetType)})
              </span>
            </div>

            <p className="text-sm text-muted-foreground">
              {t("description")}
            </p>

            {/* 积分消耗 */}
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {t("creditCost")}
                </span>
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-semibold",
                    insufficientCredits ? "text-red-500" : "text-foreground"
                  )}
                >
                  <Coins className="h-4 w-4" />
                  <span>{creditCost}</span>
                </div>
              </div>

              {/* 费用明细 */}
              <div className="text-xs text-muted-foreground">
                {costDetails}
              </div>

              {/* 当前余额 */}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm text-muted-foreground">
                  {t("currentBalance")}
                </span>
                <div className="flex items-center gap-1.5 text-sm">
                  <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={cn(
                    insufficientCredits && "text-red-500"
                  )}>
                    {currentBalance}
                  </span>
                </div>
              </div>
            </div>

            {/* 积分不足警告 */}
            {insufficientCredits && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    {t("insufficientCredits")}
                  </p>
                  <Link
                    href="/credits"
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline"
                    onClick={() => onOpenChange(false)}
                  >
                    {t("purchaseCredits")}
                  </Link>
                </div>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRegenerating}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={insufficientCredits || isRegenerating}
            className={cn(
              insufficientCredits && "opacity-50 cursor-not-allowed"
            )}
          >
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {tCommon("generating")}
              </>
            ) : (
              t("confirm")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
