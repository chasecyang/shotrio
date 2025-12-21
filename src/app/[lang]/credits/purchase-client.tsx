"use client";

import { useState } from "react";
import { PackageCard } from "@/components/credits/package-card";
import { createCheckoutSession } from "@/lib/actions/payment/checkout";
import { toast } from "sonner";
import type { CreditPackage } from "@/types/payment";

interface CreditsPurchaseClientProps {
  package: CreditPackage;
}

export function CreditsPurchaseClient({
  package: pkg,
}: CreditsPurchaseClientProps) {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const result = await createCheckoutSession({
        packageType: pkg.type,
      });

      if (result.success && result.checkoutUrl) {
        // 跳转到支付页面
        window.location.href = result.checkoutUrl;
      } else {
        toast.error(result.error || "创建支付会话失败");
        setLoading(false);
      }
    } catch (error) {
      toast.error("创建支付会话失败，请稍后重试");
      console.error("创建支付会话失败:", error);
      setLoading(false);
    }
  };

  return (
    <PackageCard
      package={pkg}
      onSelect={handlePurchase}
      loading={loading}
    />
  );
}

