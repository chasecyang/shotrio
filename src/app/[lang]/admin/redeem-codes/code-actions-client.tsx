"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { updateRedeemCodeStatus } from "@/lib/actions/admin/manage-codes";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface RedeemCodeActionsProps {
  codeId: string;
  isActive: boolean;
}

export function RedeemCodeActions({
  codeId,
  isActive: initialActive,
}: RedeemCodeActionsProps) {
  const [isActive, setIsActive] = useState(initialActive);
  const [loading, setLoading] = useState(false);
  const t = useTranslations("admin.redeemCodes.actions");
  const tToast = useTranslations("toasts");

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    try {
      const result = await updateRedeemCodeStatus({
        codeId,
        isActive: checked,
      });

      if (result.success) {
        setIsActive(checked);
        toast.success(checked ? t("enable") : t("disable"));
      } else {
        toast.error(result.error || tToast("error.operationFailed"));
      }
    } catch (error) {
      toast.error(tToast("error.operationFailed"));
      console.error("[RedeemCodeActions] Update status failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Switch
      checked={isActive}
      onCheckedChange={handleToggle}
      disabled={loading}
    />
  );
}

