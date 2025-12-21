"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { updateRedeemCodeStatus } from "@/lib/actions/admin/manage-codes";
import { toast } from "sonner";

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

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    try {
      const result = await updateRedeemCodeStatus({
        codeId,
        isActive: checked,
      });

      if (result.success) {
        setIsActive(checked);
        toast.success(checked ? "已启用" : "已禁用");
      } else {
        toast.error(result.error || "操作失败");
      }
    } catch (error) {
      toast.error("操作失败，请稍后重试");
      console.error("更新兑换码状态失败:", error);
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

